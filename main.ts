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

/**
 * GET /
 * Serves the main index page of the SheetBot web interface.
 * @returns {HTML} The main application page
 */
app.get("/", createIndexHandler());

/**
 * GET /openapi.yaml
 * Serves the OpenAPI specification file for the API.
 * @returns {YAML} OpenAPI 3.0 specification
 */
app.get("/openapi.yaml", createOpenApiHandler());

/**
 * POST /login
 * Authenticates a user and returns a JWT token.
 * @param {Object} body - Login credentials
 * @param {string} body.username - Username
 * @param {string} body.password - Password
 * @returns {Object} Authentication response with JWT token
 * @returns {string} token - JWT token for authenticated requests
 */
app.post("/login", createLoginHandler(userdb));

// Task Management Routes

/**
 * GET /tasks
 * Retrieves a list of all tasks in the system.
 * @requires Authentication
 * @returns {Array<Task>} Array of task objects
 */
app.get("/tasks", requiresLogin, createGetTasksHandler(db));

/**
 * POST /tasks
 * Creates a new task with the provided configuration.
 * Supports file uploads for task artefacts.
 * @requires Authentication, createTasks permission
 * @param {Object} body - Task configuration
 * @param {string} body.script - Task script content
 * @param {string} [body.name] - Optional task name
 * @param {string} body.type - Task type (deno, python, etc.)
 * @param {Object} [body.data] - Initial task data
 * @param {Object} [body.capabilitiesSchema] - JSON schema for capabilities
 * @param {Array} [body.transitions] - Task state transitions
 * @param {Array} [body.dependsOn] - Task dependencies
 * @param {number} [body.status] - Initial task status
 * @param {File[]} [files] - Uploaded artefact files
 * @returns {Task} Created task object
 */
app.post("/tasks", requiresLogin, requiresPermission("createTasks"), ...createCreateTaskHandler(db, transitionTracker, taskTrackingMiddleware));

/**
 * GET /tasks/:id
 * Retrieves a specific task by its ID.
 * @requires Authentication, viewTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @returns {Task} Task object
 * @returns {404} If task not found
 */
app.get("/tasks/:id", requiresLogin, requiresPermission("viewTasks"), createGetTaskHandler(db));

/**
 * DELETE /tasks/:id
 * Permanently deletes a task from the system.
 * @requires Authentication, deleteTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @returns {204} Success, no content
 * @returns {404} If task not found
 */
app.delete("/tasks/:id", requiresLogin, requiresPermission("deleteTasks"), createDeleteTaskHandler(db));

/**
 * PATCH /tasks/:id
 * Updates a task's status or other properties.
 * @requires Authentication, updateTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @param {Object} body - Update data
 * @param {number} [body.status] - New task status
 * @returns {204} Success, no content
 * @returns {404} If task not found
 */
app.patch("/tasks/:id", requiresLogin, requiresPermission("updateTasks"), createUpdateTaskHandler(db, transitionTracker));

/**
 * POST /tasks/:id/accept
 * Marks a task as accepted and changes its status to RUNNING.
 * Used by agents to claim tasks for execution.
 * @requires Authentication, performTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @returns {Object} Success response
 * @returns {404} If task not found or not in AWAITING status
 */
app.post("/tasks/:id/accept", requiresLogin, requiresPermission("performTasks"), createAcceptTaskHandler(db, transitionTracker));

/**
 * POST /tasks/:id/complete
 * Marks a task as completed with the provided result data.
 * @requires Authentication, performTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @param {Object} body - Completion data
 * @param {Object} body.data - Task execution results
 * @returns {Object} Success response
 * @returns {404} If task not found or not in RUNNING status
 */
app.post("/tasks/:id/complete", requiresLogin, requiresPermission("performTasks"), ...createCompleteTaskHandler(db, transitionTracker, taskTrackingMiddleware));

/**
 * POST /tasks/:id/data
 * Updates a task's data object with additional information.
 * @requires Authentication, performTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @param {Object} body - Data to merge
 * @param {Object} body.data - Data to add/update
 * @returns {Object} Success response
 * @returns {404} If task not found
 */
app.post("/tasks/:id/data", requiresLogin, requiresPermission("performTasks"), createUpdateTaskDataHandler(db));

/**
 * POST /tasks/:id/failed
 * Marks a task as failed, typically called by agents when execution fails.
 * @requires Authentication, performTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @returns {Object} Success response
 * @returns {404} If task not found or not in RUNNING status
 */
app.post("/tasks/:id/failed", requiresLogin, requiresPermission("performTasks"), ...createFailTaskHandler(db, transitionTracker, taskTrackingMiddleware));

/**
 * POST /tasks/:id/clone
 * Creates a copy of an existing task with all its artefacts.
 * @requires Authentication, createTasks permission
 * @param {string} id - Task ID to clone (URL parameter)
 * @returns {Task} New cloned task object
 * @returns {404} If original task not found
 */
app.post("/tasks/:id/clone", requiresLogin, requiresPermission("createTasks"), createCloneTaskHandler(db));

/**
 * POST /tasks/get
 * Retrieves the next available task for an agent to execute.
 * @requires Authentication, performTasks permission
 * @param {Object} body - Agent capabilities
 * @param {string} body.type - Agent type (deno, python, etc.)
 * @param {Object} [body.capabilities] - Agent capabilities object
 * @returns {Object} Task assignment or empty object if none available
 * @returns {string} script - URL to task script
 * @returns {string} id - Task ID
 * @returns {string} type - Task type
 */
app.post("/tasks/get", requiresLogin, requiresPermission("performTasks"), ...createGetTaskToCompleteHandler(db, agentTrackingMiddleware));

/**
 * POST /tasks/:id/artefacts
 * Uploads a file artefact for a task.
 * @requires Authentication, performTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @param {File} file - File to upload
 * @returns {Object} Upload result with URLs
 * @returns {string} url - Relative URL to access the artefact
 * @returns {string} directURL - Direct file URL
 * @returns {400} If task not found
 */
app.post('/tasks/:id/artefacts', requiresLogin, requiresPermission("performTasks"), ...createUploadArtefactHandler(db));

/**
 * GET /tasks/:id/artefacts/:filename
 * Downloads a specific artefact file from a task.
 * @param {string} id - Task ID (URL parameter)
 * @param {string} filename - Artefact filename (URL parameter)
 * @returns {File} The requested artefact file
 * @returns {404} If task or artefact not found
 */
app.get('/tasks/:id/artefacts/:filename', createGetArtefactHandler(db));

/**
 * DELETE /tasks/:id/artefacts/:filename
 * Removes an artefact file from a task.
 * @requires Authentication, deleteTasks permission
 * @param {string} id - Task ID (URL parameter)
 * @param {string} filename - Artefact filename (URL parameter)
 * @returns {204} Success, no content
 * @returns {404} If task or artefact not found
 */
app.delete('/tasks/:id/artefacts/:filename', requiresLogin, requiresPermission("deleteTasks"), createDeleteTaskArtefactHandler(db));

// Library Routes

/**
 * GET /library
 * Retrieves the library of available scripts/templates.
 * @requires Authentication
 * @returns {Array} Array of available scripts with metadata
 * @returns {string} filename - Script filename
 * @returns {string} name - Human-readable name
 * @returns {Object} capabilitiesSchema - JSON schema for capabilities
 * @returns {Object} suggestedData - Suggested initial data
 * @returns {string} comments - Additional comments/help text
 */
app.get("/library", requiresLogin, createGetLibraryHandler());

// Monitoring Routes

/**
 * GET /tasktracker
 * Retrieves task execution statistics and metrics.
 * @requires Authentication
 * @param {number} [minutes=1440] - Time window in minutes (query parameter)
 * @returns {Object} Task tracking statistics
 */
app.get("/tasktracker", requiresLogin, createGetTaskTrackerHandler(taskTracker));

/**
 * GET /agenttracker
 * Retrieves agent activity statistics and metrics.
 * @requires Authentication
 * @param {number} [minutes=1440] - Time window in minutes (query parameter)
 * @returns {Object} Agent tracking statistics
 */
app.get("/agenttracker", requiresLogin, createGetAgentTrackerHandler(agentTracker));

/**
 * GET /transitiontracker
 * Retrieves task transition evaluation statistics.
 * @requires Authentication
 * @param {number} [minutes=1440] - Time window in minutes (query parameter)
 * @returns {Object} Transition evaluation statistics
 */
app.get("/transitiontracker", requiresLogin, createGetTransitionTrackerHandler(transitionTracker));

// Script Routes

/**
 * Static file serving for scripts directory.
 * Serves script files and templates.
 */
app.use('/scripts', express.static('scripts'));

/**
 * GET /scripts/agent(.ts|.py)?
 * Serves agent template scripts for different languages.
 * @param {string} [extension] - File extension (.ts or .py)
 * @returns {File} Agent template script
 */
app.get("/scripts/agent(\.ts|\.py)?", createGetAgentTemplateHandler());

/**
 * GET /scripts/:id.*
 * Serves the script for a specific task, with dependency injection.
 * @param {string} id - Task ID (URL parameter)
 * @param {string} [extension] - File extension
 * @returns {File} Task script with injected dependencies
 * @returns {404} If task not found
 */
app.get("/scripts/:id\.?.*", ...createGetTaskScriptHandler(db));

// Sheet Data Routes

/**
 * POST /sheets/:id/data
 * Inserts or updates data in a sheet.
 * @requires Authentication, putSheetData permission
 * @param {string} id - Sheet ID (URL parameter)
 * @param {Object} body - Data to upsert
 * @param {string} body.key - Primary key for the row
 * @returns {200} Success
 * @returns {500} If invalid sheet name or data format
 */
app.post("/sheets/:id/data", requiresLogin, requiresPermission("putSheetData"), createUpsertSheetDataHandler());

/**
 * DELETE /sheets/:id/data/:key
 * Deletes a row from a sheet by its primary key.
 * @requires Authentication, putSheetData permission
 * @param {string} id - Sheet ID (URL parameter)
 * @param {string} key - Row primary key (URL parameter)
 * @returns {204} Success, no content
 * @returns {500} If invalid sheet name
 */
app.delete("/sheets/:id/data/:key", requiresLogin, requiresPermission("putSheetData"), createDeleteSheetRowHandler());

/**
 * GET /sheets/:id
 * Retrieves all data from a specific sheet.
 * @requires Authentication
 * @param {string} id - Sheet ID (URL parameter)
 * @returns {Object} Sheet data
 * @returns {Array} columns - Column schema
 * @returns {Array} rows - Row data
 * @returns {404} If sheet not found
 * @returns {500} If invalid sheet name
 */
app.get("/sheets/:id", requiresLogin, createGetSheetHandler());

/**
 * GET /sheets
 * Lists all available sheets in the system.
 * @requires Authentication
 * @returns {Array<string>} Array of sheet IDs
 */
app.get("/sheets", requiresLogin, createListSheetsHandler());

// Artefact Routes

/**
 * Static file serving for artefacts directory.
 * Serves uploaded artefact files.
 */
app.use('/artefacts', express.static('artefacts'));

/**
 * DELETE /artefacts/*
 * Deletes artefact files from the system.
 * @requires Authentication, deleteTasks permission
 * @param {string} path - Artefact file path (wildcard)
 * @returns {204} Success, no content
 * @returns {404} If file not found
 */
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
