import https from "node:https";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";
import express from "npm:express@4.18.3";
import OpenApiValidator from "npm:express-openapi-validator@5.6.0";
import { initDatabase, startTransitionWorker } from "./lib/db.ts";
import { TaskTracker } from "./lib/tasktracker.ts";
import { TaskEventEmitter } from "./lib/task-events.ts";
import { createTaskTrackingMiddleware } from "./lib/task-tracking-middleware.ts";
import { AgentTracker } from "./lib/agenttracker.ts";
import { AgentEventEmitter } from "./lib/agent-events.ts";
import { createAgentTrackingMiddleware } from "./lib/agent-tracking-middleware.ts";
import { TransitionTracker } from "./lib/transitiontracker.ts";
import { requiresLogin, requiresPermission } from "./lib/auth.ts";
import { UserDB } from "./lib/data_providers/sqlite/userdb.ts";
import { createLoginHandler, createIndexHandler, createOpenApiHandler } from "./lib/handlers/auth.ts";
import { createGetTasksHandler, createCreateTaskHandler, createGetTaskHandler, createDeleteTaskHandler, createUpdateTaskHandler, createAcceptTaskHandler, createCompleteTaskHandler, createUpdateTaskDataHandler, createFailTaskHandler, createCloneTaskHandler, createGetTaskToCompleteHandler, createUploadArtefactHandler, createGetArtefactHandler, createDeleteArtefactHandler as createDeleteTaskArtefactHandler } from "./lib/handlers/tasks.ts";
import { createGetLibraryHandler } from "./lib/handlers/library.ts";
import { createGetTaskTrackerHandler, createGetAgentTrackerHandler, createGetTransitionTrackerHandler } from "./lib/handlers/tracker.ts";
import { createGetAgentTemplateHandler, createGetTaskScriptHandler } from "./lib/handlers/scripts.ts";
import { createUpsertSheetDataHandler, createDeleteSheetRowHandler, createGetSheetHandler, createListSheetsHandler } from "./lib/handlers/sheets.ts";
import { createDeleteArtefactHandler } from "./lib/handlers/artefacts.ts";

// Init system
const initDir = "./init/";
try {
    await Deno.mkdir(initDir, { recursive: true });
} catch {
    // ignore
}
const initFiles = Array.from(Deno.readDirSync(initDir))
    .filter(entry => entry.isFile && entry.name.endsWith('.ts'))
    .sort((a, b) => a.name.localeCompare(b.name));
for (const file of initFiles) {
    const module = await import(`${initDir}${file.name}`);
    if (module.default && typeof module.default === 'function') {
        await module.default();
    }
}

const db = initDatabase();
const taskEventEmitter = new TaskEventEmitter();
const taskTracker = new TaskTracker(taskEventEmitter);
const taskTrackingMiddleware = createTaskTrackingMiddleware(taskEventEmitter);
const agentEventEmitter = new AgentEventEmitter();
const agentTracker = new AgentTracker(agentEventEmitter);
const agentTrackingMiddleware = createAgentTrackingMiddleware(agentEventEmitter);
const transitionTracker = new TransitionTracker();
transitionTracker.startCleanup();

startTransitionWorker(db, transitionTracker);

const userdb = new UserDB();

const app = express();
app.use(express.json());
app.use(express.static('static'));

// API validation middleware (only in development)
if (Deno.env.get("NODE_ENV") !== "production") {
    app.use(OpenApiValidator.middleware({
        apiSpec: './openapi.yaml',
        validateRequests: true,
        validateResponses: true,
        ignorePaths: /^\/(static|scripts|artefacts|\.well-known)/,
    }));

    // Error handler for validation errors
    app.use((err: any, req: any, res: any, next: any) => {
        console.error(`Validation error for ${req.method} ${req.path}:`, err.message, err.stack);
        res.status(err.status || 400).json({ error: err.message });
    });
}

// Define routes directly
app.get("/", createIndexHandler());
app.get("/openapi.yaml", createOpenApiHandler());
app.post("/login", createLoginHandler(userdb));

app.get("/tasks", requiresLogin, createGetTasksHandler(db));
app.post("/tasks", requiresLogin, requiresPermission("createTasks"), ...createCreateTaskHandler(db, transitionTracker, taskTrackingMiddleware));
app.get("/tasks/:id", requiresLogin, requiresPermission("viewTasks"), createGetTaskHandler(db));
app.delete("/tasks/:id", requiresLogin, requiresPermission("deleteTasks"), createDeleteTaskHandler(db));
app.patch("/tasks/:id", requiresLogin, requiresPermission("updateTasks"), createUpdateTaskHandler(db, transitionTracker));
app.post("/tasks/:id/accept", requiresLogin, requiresPermission("performTasks"), createAcceptTaskHandler(db, transitionTracker));
app.post("/tasks/:id/complete", requiresLogin, requiresPermission("performTasks"), ...createCompleteTaskHandler(db, transitionTracker, taskTrackingMiddleware));
app.post("/tasks/:id/data", requiresLogin, requiresPermission("performTasks"), createUpdateTaskDataHandler(db));
app.post("/tasks/:id/failed", requiresLogin, requiresPermission("performTasks"), ...createFailTaskHandler(db, transitionTracker, taskTrackingMiddleware));
app.post("/tasks/:id/clone", requiresLogin, requiresPermission("createTasks"), createCloneTaskHandler(db));
app.post("/tasks/get", requiresLogin, requiresPermission("performTasks"), ...createGetTaskToCompleteHandler(db, agentTrackingMiddleware));
app.post('/tasks/:id/artefacts', requiresLogin, requiresPermission("performTasks"), ...createUploadArtefactHandler(db));
app.get('/tasks/:id/artefacts/:filename', createGetArtefactHandler(db));
app.delete('/tasks/:id/artefacts/:filename', requiresLogin, requiresPermission("deleteTasks"), createDeleteTaskArtefactHandler(db));

app.get("/library", requiresLogin, createGetLibraryHandler());

app.get("/tasktracker", requiresLogin, createGetTaskTrackerHandler(taskTracker));
app.get("/agenttracker", requiresLogin, createGetAgentTrackerHandler(agentTracker));
app.get("/transitiontracker", requiresLogin, createGetTransitionTrackerHandler(transitionTracker));

app.use('/scripts', express.static('scripts'));
app.get("/scripts/agent(\.ts|\.py)?", createGetAgentTemplateHandler());
app.get("/scripts/:id\.?.*", ...createGetTaskScriptHandler(db));

app.post("/sheets/:id/data", requiresLogin, requiresPermission("putSheetData"), createUpsertSheetDataHandler());
app.delete("/sheets/:id/data/:key", requiresLogin, requiresPermission("putSheetData"), createDeleteSheetRowHandler());
app.get("/sheets/:id", requiresLogin, createGetSheetHandler());
app.get("/sheets", requiresLogin, createListSheetsHandler());

app.use('/artefacts', express.static('artefacts'));
app.delete('/artefacts/*', requiresLogin, requiresPermission("deleteTasks"), createDeleteArtefactHandler());

app.set('trust proxy', (ip: string) => {
    if (ip === '127.0.0.1') {
        return true; // trusted IPs
    } else {
        return false;
    }
});

app.listen(3000);
console.log("listening on http://localhost:3000/");

if (existsSync("./key.pem") && existsSync("./cert.pem")) {
    const key = new TextDecoder().decode(Deno.readFileSync('./key.pem'));
    const cert = new TextDecoder().decode(Deno.readFileSync('./cert.pem'));
    https.createServer({key: key, cert: cert}, app).listen(443);
    console.log("listening on http://localhost:443/");
} else {
    console.log("No key.pem and cert.pem exist, so not setting up HTTPS!");
}
