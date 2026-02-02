// ██ ███    ███ ██████   ██████  ██████  ████████ ███████
// ██ ████  ████ ██   ██ ██    ██ ██   ██    ██    ██
// ██ ██ ████ ██ ██████  ██    ██ ██████     ██    ███████
// ██ ██  ██  ██ ██      ██    ██ ██   ██    ██         ██
// ██ ██      ██ ██       ██████  ██   ██    ██    ███████

import https from "node:https";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";
import express from "npm:express@4.18.3";
import OpenApiValidator from "npm:express-openapi-validator@5.6.0";
import { openDatabase, startTransitionWorker } from "./lib/db.ts";
import { TaskTracker } from "./lib/tasktracker.ts";
import { TaskEventEmitter } from "./lib/task-events.ts";
import { createTaskTrackingMiddleware } from "./lib/task-tracking-middleware.ts";
import { AgentTracker } from "./lib/agenttracker.ts";
import { AgentEventEmitter } from "./lib/agent-events.ts";
import { createAgentTrackingMiddleware, chainDetermineAgentId, sheetbotAgentIdDetermineAgentId, hostnameBasedDetermineAgentId, ipBasedDetermineAgentId } from "./lib/agent-tracking-middleware.ts";
import { TransitionTracker } from "./lib/transitiontracker.ts";
import { requiresLogin, requiresPermission } from "./lib/auth.ts";
import { UserDB } from "./lib/data_providers/sqlite/userdb.ts";
import { createLoginHandler, createIndexHandler, createOpenApiHandler } from "./lib/handlers/auth.ts";
import { createGetTasksHandler, createCreateTaskHandler, createGetTaskHandler, createDeleteTaskHandler, createUpdateTaskHandler, createAcceptTaskHandler, createCompleteTaskHandler, createUpdateTaskDataHandler, createFailTaskHandler, createCloneTaskHandler, createGetTaskToCompleteHandler, createUploadArtefactHandler, createGetArtefactHandler, createDeleteArtefactHandler as createDeleteTaskArtefactHandler } from "./lib/handlers/tasks.ts";
import { createGetLibraryHandler } from "./lib/handlers/library.ts";
import { createGetTaskTrackerHandler, createGetAgentTrackerHandler, createGetTransitionTrackerHandler } from "./lib/handlers/tracker.ts";
import { createGetAgentTemplateHandler, createGetTaskScriptHandler } from "./lib/handlers/scripts.ts";
import { createUpsertSheetDataHandler, createDeleteSheetRowHandler, createGetSheetHandler, createListSheetsHandler } from "./lib/handlers/sheets.ts";
import { createDeleteArtefactHandler, createListArtefactsHandler, createPutArtefactHandler, createPostArtefactHandler } from "./lib/handlers/artefacts.ts";
import { createAwsCredentialsHandler } from "./lib/handlers/aws-credentials.ts";
import { extractAWSCredentialsIfPresent } from "./lib/middleware.ts";

// ██ ███    ██ ██ ████████     ███████ ██    ██ ███████ ████████ ███████ ███    ███
// ██ ████   ██ ██    ██        ██       ██  ██  ██         ██    ██      ████  ████
// ██ ██ ██  ██ ██    ██        ███████   ████   ███████    ██    █████   ██ ████ ██
// ██ ██  ██ ██ ██    ██             ██    ██         ██    ██    ██      ██  ██  ██
// ██ ██   ████ ██    ██        ███████    ██    ███████    ██    ███████ ██      ██

const initDir = "./init/";
try {
    if (!Deno.existsSync(initDir)) {
        await Deno.mkdir(initDir, { recursive: true });
    }
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

// ███    ███ ██ ██████  ██████  ██      ███████ ██     ██  █████  ██████  ███████     ███████ ███████ ████████ ██    ██ ██████
// ████  ████ ██ ██   ██ ██   ██ ██      ██      ██     ██ ██   ██ ██   ██ ██          ██      ██         ██    ██    ██ ██   ██
// ██ ████ ██ ██ ██   ██ ██   ██ ██      █████   ██  █  ██ ███████ ██████  █████       ███████ █████      ██    ██    ██ ██████
// ██  ██  ██ ██ ██   ██ ██   ██ ██      ██      ██ ███ ██ ██   ██ ██   ██ ██               ██ ██         ██    ██    ██ ██
// ██      ██ ██ ██████  ██████  ███████ ███████  ███ ███  ██   ██ ██   ██ ███████     ███████ ███████    ██     ██████  ██

const db = openDatabase();
const taskEventEmitter = new TaskEventEmitter();
const taskTracker = new TaskTracker(taskEventEmitter);
const taskTrackingMiddleware = createTaskTrackingMiddleware(taskEventEmitter);
const agentEventEmitter = new AgentEventEmitter();
const agentTracker = new AgentTracker(agentEventEmitter);
const agentTrackingMiddleware = createAgentTrackingMiddleware(agentEventEmitter, chainDetermineAgentId([sheetbotAgentIdDetermineAgentId, hostnameBasedDetermineAgentId], ipBasedDetermineAgentId));
const transitionTracker = new TransitionTracker();
transitionTracker.startCleanup();

startTransitionWorker(db, transitionTracker, taskEventEmitter);

const userdb = new UserDB();

// ███████ ██   ██ ██████  ██████  ███████ ███████ ███████      █████  ██████  ██████      ███████ ███████ ████████ ██    ██ ██████
// ██       ██ ██  ██   ██ ██   ██ ██      ██      ██          ██   ██ ██   ██ ██   ██     ██      ██         ██    ██    ██ ██   ██
// █████     ███   ██████  ██████  █████   ███████ ███████     ███████ ██████  ██████      ███████ █████      ██    ██    ██ ██████
// ██       ██ ██  ██      ██   ██ ██           ██      ██     ██   ██ ██      ██               ██ ██         ██    ██    ██ ██
// ███████ ██   ██ ██      ██   ██ ███████ ███████ ███████     ██   ██ ██      ██          ███████ ███████    ██     ██████  ██

const app = express();

// Request logging middleware
app.use((req: any, res: any, next: any) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${timestamp}] ${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - IP: ${ip}`);
    });

    next();
});

app.use(express.json());
app.use(express.static('static'));

app.set('trust proxy', (ip: string) => {
    if (ip === '127.0.0.1') {
        return true; // trusted IPs
    } else {
        return false;
    }
});

// API validation middleware (only in development)
if (Deno.env.get("NODE_ENV") === "development") {
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

// ██████   █████  ███████ ██  ██████     ██████   ██████  ██    ██ ████████ ███████ ███████
// ██   ██ ██   ██ ██      ██ ██          ██   ██ ██    ██ ██    ██    ██    ██      ██
// ███████ ███████ ███████ ██ ██          ██████  ██    ██ ██    ██    ██    █████   ███████
// ██   ██ ██   ██      ██ ██ ██          ██   ██ ██    ██ ██    ██    ██    ██           ██
// ██████  ██   ██ ███████ ██  ██████     ██   ██  ██████   ██████     ██    ███████ ███████

// GET / - Serves the main index page of the SheetBot web interface
app.get("/", createIndexHandler());

// GET /openapi.yaml - Serves the OpenAPI specification file for the API
app.get("/openapi.yaml", createOpenApiHandler());

//  █████  ██    ██ ████████ ██   ██     ██████   ██████  ██    ██ ████████ ███████ ███████ 
// ██   ██ ██    ██    ██    ██   ██     ██   ██ ██    ██ ██    ██    ██    ██      ██      
// ███████ ██    ██    ██    ███████     ██████  ██    ██ ██    ██    ██    █████   ███████ 
// ██   ██ ██    ██    ██    ██   ██     ██   ██ ██    ██ ██    ██    ██    ██           ██ 
// ██   ██  ██████     ██    ██   ██     ██   ██  ██████   ██████     ██    ███████ ███████ 

// POST /login - Authenticates a user and returns a JWT token
app.post("/login", createLoginHandler(userdb));

// POST /artefacts-credentials - Issues temporary AWS-compatible credentials for S3 API access
app.post("/artefacts-credentials", requiresLogin, createAwsCredentialsHandler());

// ████████  █████  ███████ ██   ██     ███    ███  █████  ███    ██  █████   ██████  ███████ ███    ███ ███████ ███    ██ ████████     ██████   ██████  ██    ██ ████████ ███████ ███████
//    ██    ██   ██ ██      ██  ██      ████  ████ ██   ██ ████   ██ ██   ██ ██       ██      ████  ████ ██      ████   ██    ██        ██   ██ ██    ██ ██    ██    ██    ██      ██
//    ██    ███████ ███████ █████       ██ ████ ██ ███████ ██ ██  ██ ███████ ██   ███ █████   ██ ████ ██ █████   ██ ██  ██    ██        ██████  ██    ██ ██    ██    ██    █████   ███████
//    ██    ██   ██      ██ ██  ██      ██  ██  ██ ██   ██ ██  ██ ██ ██   ██ ██    ██ ██      ██  ██  ██ ██      ██  ██ ██    ██        ██   ██ ██    ██ ██    ██    ██    ██           ██
//    ██    ██   ██ ███████ ██   ██     ██      ██ ██   ██ ██   ████ ██   ██  ██████  ███████ ██      ██ ███████ ██   ████    ██        ██   ██  ██████   ██████     ██    ███████ ███████

// GET /tasks - Retrieves a list of all tasks in the system
app.get("/tasks", requiresLogin, createGetTasksHandler(db));

// POST /tasks - Creates a new task with the provided configuration
app.post("/tasks", requiresLogin, requiresPermission("createTasks"), ...createCreateTaskHandler(db, transitionTracker, taskTrackingMiddleware, taskEventEmitter));

// GET /tasks/:id - Retrieves a specific task by its ID
app.get("/tasks/:id", requiresLogin, requiresPermission("viewTasks"), createGetTaskHandler(db));

// DELETE /tasks/:id - Permanently deletes a task from the system
app.delete("/tasks/:id", requiresLogin, requiresPermission("deleteTasks"), createDeleteTaskHandler(db, taskEventEmitter));

// PATCH /tasks/:id - Updates a task's status or other properties
app.patch("/tasks/:id", requiresLogin, requiresPermission("updateTasks"), createUpdateTaskHandler(db, transitionTracker, taskEventEmitter));

// POST /tasks/:id/accept - Marks a task as accepted and changes its status to RUNNING
app.post("/tasks/:id/accept", requiresLogin, requiresPermission("performTasks"), createAcceptTaskHandler(db, transitionTracker, taskEventEmitter));

// POST /tasks/:id/complete - Marks a task as completed with the provided result data
app.post("/tasks/:id/complete", requiresLogin, requiresPermission("performTasks"), ...createCompleteTaskHandler(db, transitionTracker, taskTrackingMiddleware, taskEventEmitter));

// POST /tasks/:id/data - Updates a task's data object with additional information
app.post("/tasks/:id/data", requiresLogin, requiresPermission("performTasks"), createUpdateTaskDataHandler(db, taskEventEmitter));

// POST /tasks/:id/failed - Marks a task as failed, typically called by agents when execution fails
app.post("/tasks/:id/failed", requiresLogin, requiresPermission("performTasks"), ...createFailTaskHandler(db, transitionTracker, taskTrackingMiddleware, taskEventEmitter));

// POST /tasks/:id/clone - Creates a copy of an existing task with all its artefacts
app.post("/tasks/:id/clone", requiresLogin, requiresPermission("createTasks"), createCloneTaskHandler(db, taskEventEmitter));

// POST /tasks/get - Retrieves the next available task for an agent to execute
app.post("/tasks/get", requiresLogin, requiresPermission("performTasks"), ...createGetTaskToCompleteHandler(db, agentTrackingMiddleware));

// POST /tasks/:id/artefacts - Uploads a file artefact for a task
app.post('/tasks/:id/artefacts', requiresLogin, requiresPermission("performTasks"), ...createUploadArtefactHandler(db, taskEventEmitter));

// GET /tasks/:id/artefacts/:filename - Downloads a specific artefact file from a task
app.get('/tasks/:id/artefacts/:filename', createGetArtefactHandler(db));

// DELETE /tasks/:id/artefacts/:filename - Removes an artefact file from a task
app.delete('/tasks/:id/artefacts/:filename', requiresLogin, requiresPermission("deleteTasks"), createDeleteTaskArtefactHandler(db, taskEventEmitter));

// ██      ██ ██████  ██████   █████  ██████  ██    ██     ██████   ██████  ██    ██ ████████ ███████ ███████
// ██      ██ ██   ██ ██   ██ ██   ██ ██   ██  ██  ██      ██   ██ ██    ██ ██    ██    ██    ██      ██
// ██      ██ ██████  ██████  ███████ ██████    ████       ██████  ██    ██ ██    ██    ██    █████   ███████
// ██      ██ ██   ██ ██   ██ ██   ██ ██   ██    ██        ██   ██ ██    ██ ██    ██    ██    ██           ██
// ███████ ██ ██████  ██   ██ ██   ██ ██   ██    ██        ██   ██  ██████   ██████     ██    ███████ ███████

// GET /library - Retrieves the library of available scripts/templates
app.get("/library", requiresLogin, createGetLibraryHandler());

// ███    ███  ██████  ███    ██ ██ ████████  ██████  ██████  ██ ███    ██  ██████      ██████   ██████  ██    ██ ████████ ███████ ███████
// ████  ████ ██    ██ ████   ██ ██    ██    ██    ██ ██   ██ ██ ████   ██ ██           ██   ██ ██    ██ ██    ██    ██    ██      ██
// ██ ████ ██ ██    ██ ██ ██  ██ ██    ██    ██    ██ ██████  ██ ██ ██  ██ ██   ███     ██████  ██    ██ ██    ██    ██    █████   ███████
// ██  ██  ██ ██    ██ ██  ██ ██ ██    ██    ██    ██ ██   ██ ██ ██  ██ ██ ██    ██     ██   ██ ██    ██ ██    ██    ██    ██           ██
// ██      ██  ██████  ██   ████ ██    ██     ██████  ██   ██ ██ ██   ████  ██████      ██   ██  ██████   ██████     ██    ███████ ███████

// GET /tasktracker - Retrieves task execution statistics and metrics
app.get("/tasktracker", requiresLogin, createGetTaskTrackerHandler(taskTracker));

// GET /agenttracker - Retrieves agent activity statistics and metrics
app.get("/agenttracker", requiresLogin, createGetAgentTrackerHandler(agentTracker));

// GET /transitiontracker - Retrieves task transition evaluation statistics
app.get("/transitiontracker", requiresLogin, createGetTransitionTrackerHandler(transitionTracker));

// ███████  ██████ ██████  ██ ██████  ████████     ██████   ██████  ██    ██ ████████ ███████ ███████
// ██      ██      ██   ██ ██ ██   ██    ██        ██   ██ ██    ██ ██    ██    ██    ██      ██
// ███████ ██      ██████  ██ ██████     ██        ██████  ██    ██ ██    ██    ██    █████   ███████
//      ██ ██      ██   ██ ██ ██         ██        ██   ██ ██    ██ ██    ██    ██    ██           ██
// ███████  ██████ ██   ██ ██ ██         ██        ██   ██  ██████   ██████     ██    ███████ ███████

// Static file serving for scripts directory - Serves agent template files
app.use('/scripts', express.static('scripts'));

// Static file serving for library directory - Serves automation scripts
app.use('/library', express.static('library'));

// GET /scripts/agent(.ts|.py|.sh)? - Serves agent template scripts for different languages
app.get("/scripts/agent(\.ts|\.py|\.sh)?", createGetAgentTemplateHandler());

// GET /scripts/:id.* - Serves the script for a specific task, with dependency injection
app.get("/scripts/:id\.?.*", ...createGetTaskScriptHandler(db));

// ███████ ██   ██ ███████ ███████ ████████     ██████   █████  ████████  █████      ██████   ██████  ██    ██ ████████ ███████ ███████
// ██      ██   ██ ██      ██         ██        ██   ██ ██   ██    ██    ██   ██     ██   ██ ██    ██ ██    ██    ██    ██      ██
// ███████ ███████ █████   █████      ██        ██   ██ ███████    ██    ███████     ██████  ██    ██ ██    ██    ██    █████   ███████
//      ██ ██   ██ ██      ██         ██        ██   ██ ██   ██    ██    ██   ██     ██   ██ ██    ██ ██    ██    ██    ██           ██
// ███████ ██   ██ ███████ ███████    ██        ██████  ██   ██    ██    ██   ██     ██   ██  ██████   ██████     ██    ███████ ███████

// POST /sheets/:id/data - Inserts or updates data in a sheet
app.post("/sheets/:id/data", requiresLogin, requiresPermission("putSheetData"), createUpsertSheetDataHandler());

// DELETE /sheets/:id/data/:key - Deletes a row from a sheet by its primary key
app.delete("/sheets/:id/data/:key", requiresLogin, requiresPermission("putSheetData"), createDeleteSheetRowHandler());

// GET /sheets/:id - Retrieves all data from a specific sheet
app.get("/sheets/:id", requiresLogin, createGetSheetHandler());

// GET /sheets - Lists all available sheets in the system
app.get("/sheets", requiresLogin, createListSheetsHandler());

// █████  ██████  ████████ ███████ ███████  █████   ██████ ████████     ██████   ██████  ██    ██ ████████ ███████ ███████
// ██   ██ ██   ██    ██    ██      ██      ██   ██ ██         ██        ██   ██ ██    ██ ██    ██    ██    ██      ██
// ███████ ██████     ██    █████   █████   ███████ ██         ██        ██████  ██    ██ ██    ██    ██    █████   ███████
// ██   ██ ██   ██    ██    ██      ██      ██   ██ ██         ██        ██   ██ ██    ██ ██    ██    ██    ██           ██
// ██   ██ ██   ██    ██    ███████ ██      ██   ██  ██████    ██        ██   ██  ██████   ██████     ██    ███████ ███████

// GET /artefacts/public - Lists artefacts in the public bucket without login
//app.get('/artefacts/public', createListArtefactsHandler('public'));

// GET /artefacts/public/* - Retrieves public artefact files without login
//app.get('/artefacts/public/*', createListArtefactsHandler('public'));

// POST /artefacts/{bucket}/* - Handles multipart upload operations, S3-style
app.post('/artefacts/:bucket/*', extractAWSCredentialsIfPresent(), requiresLogin, requiresPermission("createArtefacts"), createPostArtefactHandler());

// PUT /artefacts/{bucket}/* - Uploads artefact files or parts, S3-style
app.put('/artefacts/:bucket/*', extractAWSCredentialsIfPresent(), requiresLogin, requiresPermission("createArtefacts"), express.raw({ type: () => true, limit: '10mb' }), createPutArtefactHandler());

// GET /artefacts/:bucket - Lists artefacts in a bucket, S3-style
app.get('/artefacts/:bucket', extractAWSCredentialsIfPresent(), requiresLogin, requiresPermission("viewArtefacts"), createListArtefactsHandler());

// GET /artefacts/:bucket/* - Lists artefacts in a bucket/prefix, S3-style
app.get('/artefacts/:bucket/*', extractAWSCredentialsIfPresent(), requiresLogin, requiresPermission("viewArtefacts"), createListArtefactsHandler());

// DELETE /artefacts/* - Deletes artefact files from the system
app.delete('/artefacts/*', extractAWSCredentialsIfPresent(), requiresLogin, requiresPermission("deleteArtefacts"), createDeleteArtefactHandler());

// ███████ ███████ ██████  ██    ██ ███████ ██████      ███████ ████████  █████  ██████  ████████ ██    ██ ██████
// ██      ██      ██   ██ ██    ██ ██      ██   ██     ██         ██    ██   ██ ██   ██    ██    ██    ██ ██   ██
// ███████ █████   ██████  ██    ██ █████   ██████      ███████    ██    ███████ ██████     ██    ██    ██ ██████
//      ██ ██      ██   ██  ██  ██  ██      ██   ██          ██    ██    ██   ██ ██   ██    ██    ██    ██ ██
// ███████ ███████ ██   ██   ████   ███████ ██   ██     ███████    ██    ██   ██ ██   ██    ██     ██████  ██

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
