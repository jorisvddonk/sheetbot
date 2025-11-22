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
import { setupAuthRoutes } from "./routes/auth.ts";
import { setupTaskRoutes } from "./routes/tasks.ts";
import { setupLibraryRoutes } from "./routes/library.ts";
import { setupTrackerRoutes } from "./routes/tracker.ts";
import { setupScriptRoutes } from "./routes/scripts.ts";
import { setupSheetRoutes } from "./routes/sheets.ts";
import { setupArtefactRoutes } from "./routes/artefacts.ts";

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

// Setup routes
setupAuthRoutes(app);
setupTaskRoutes(app, db, taskTracker, agentTracker, transitionTracker, taskTrackingMiddleware, agentTrackingMiddleware);
setupLibraryRoutes(app);
setupTrackerRoutes(app, taskTracker, agentTracker, transitionTracker);
setupScriptRoutes(app, db);
setupSheetRoutes(app);
setupArtefactRoutes(app);

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
