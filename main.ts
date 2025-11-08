import jsonwebtoken from "npm:jsonwebtoken@9.0.2";
import Ajv, { JSONSchemaType } from "npm:ajv@8.17.1";
import https from "node:https";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";
import express from "npm:express@4.18.3";
import multer from "npm:multer@2.0.2";
import { DatabaseSync } from "node:sqlite";
import { validateSheetName } from "./lib/sheet_validator.ts";
import { upsert, validateTableName } from "./lib/data_providers/sqlite/lib.ts";
import { SheetDB } from "./lib/data_providers/sqlite/sheetdb.ts";
import { UserDB } from "./lib/data_providers/sqlite/userdb.ts";
import { createInjectDependenciesMiddleware, createGetScriptMiddleware, createGetTaskMiddleware } from "./lib/middleware.ts";
import { TaskTracker } from "./lib/tasktracker.ts";
import { TaskEventEmitter } from "./lib/task-events.ts";
import { createTaskTrackingMiddleware } from "./lib/task-tracking-middleware.ts";
import { AgentTracker } from "./lib/agenttracker.ts";
import { AgentEventEmitter } from "./lib/agent-events.ts";
import { createAgentTrackingMiddleware } from "./lib/agent-tracking-middleware.ts";
import OpenApiValidator from "npm:express-openapi-validator@5.6.0";

const ajv = new (Ajv as any)();

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

const SECRET_KEY = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));

const PERMISSION_VIEW_TASKS = "viewTasks";
const PERMISSION_CREATE_TASKS = "createTasks";
const PERMISSION_PERFORM_TASKS = "performTasks";
const PERMISSION_DELETE_TASKS = "deleteTasks";
const PERMISSION_UPDATE_TASKS = "updateTasks";
const PERMISSION_PUT_SHEET_DATA = "putSheetData";

const db = new DatabaseSync("tasks.db");
db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    name TEXT,
    script TEXT,
    status INTEGER,
    data TEXT,
    artefacts TEXT,
    dependsOn TEXT,
    transitions TEXT,
    type TEXT NOT NULL,
    capabilitiesSchema TEXT
)
`);

db.exec(`
CREATE TABLE IF NOT EXISTS transitions_schedule (
    task_id TEXT NOT NULL,
    transition_index INTEGER NOT NULL,
    scheduled_at INTEGER NOT NULL,
    PRIMARY KEY (task_id, transition_index),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
)
`);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_transitions_schedule_scheduled_at ON transitions_schedule(scheduled_at)
`);

db.exec(`
CREATE INDEX IF NOT EXISTS idx_transitions_schedule_task_status ON transitions_schedule(task_id)
`);

const app = express();
app.use(express.json());
app.use(express.static('static'))
const upload = multer({ dest: './artefacts/' });

const userdb = new UserDB();
const taskEventEmitter = new TaskEventEmitter();
const taskTracker = new TaskTracker(taskEventEmitter);
const taskTrackingMiddleware = createTaskTrackingMiddleware(taskEventEmitter);
const agentEventEmitter = new AgentEventEmitter();
const agentTracker = new AgentTracker(agentEventEmitter);
const agentTrackingMiddleware = createAgentTrackingMiddleware(agentEventEmitter);

// Start background worker for transitions
setInterval(processScheduledTransitions, 1000); // Check every second

// API validation middleware (only in development)
if (Deno.env.get("NODE_ENV") !== "production") {
    app.use(OpenApiValidator.middleware({
        apiSpec: './openapi.yaml',
        validateRequests: true,
        validateResponses: true,
        ignorePaths: /^\/(static|scripts|artefacts|\.well-known)/,
    }));

    // Error handler for validation errors
    app.use((err, req, res, next) => {
        console.error(`Validation error for ${req.method} ${req.path}:`, err.message, err.stack);
        res.status(err.status || 400).json({ error: err.message });
    });
}

interface Transition {
    statuses: string[],
    condition: Record<string, unknown>,
    timing: {
        every?: string,
        immediate?: boolean
    },
    transitionTo: string,
    dataMutations?: Record<string, unknown>
}

interface Task {
    id: string,
    name?: string,
    script: string,
    status: TaskStatus,
    data: Record<string, unknown>,
    artefacts: string[],
    dependsOn: string[],
    transitions: Transition[],
    type: string,
    capabilitiesSchema: Record<string, unknown>
}

interface TaskQ extends Task {
    [name: string]: unknown
}

enum TaskStatus {
    AWAITING = 0,
    RUNNING = 1,
    COMPLETED = 2,
    FAILED = 3,
    PAUSED = 4,
    DELETED = 5,
}

enum Ephemeralness {
    PERSISTENT = 0, // task will not get auto-deleted on completion
    EPHEMERAL_ON_SUCCESS = 1, // task will get auto-deleted, but only if completed successful; this allows you to debug failures
    EPHEMERAL_ALWAYS = 2 // task will get auto-deleted when completed, regardless of if it completed succesfully or not
}

function statusToString(status: TaskStatus): string {
    switch (status) {
        case TaskStatus.AWAITING: return "AWAITING";
        case TaskStatus.RUNNING: return "RUNNING";
        case TaskStatus.COMPLETED: return "COMPLETED";
        case TaskStatus.FAILED: return "FAILED";
        case TaskStatus.PAUSED: return "PAUSED";
        case TaskStatus.DELETED: return "DELETED";
        default: return "UNKNOWN";
    }
}

function stringToStatus(statusStr: string): TaskStatus {
    switch (statusStr) {
        case "AWAITING": return TaskStatus.AWAITING;
        case "RUNNING": return TaskStatus.RUNNING;
        case "COMPLETED": return TaskStatus.COMPLETED;
        case "FAILED": return TaskStatus.FAILED;
        case "PAUSED": return TaskStatus.PAUSED;
        case "DELETED": return TaskStatus.DELETED;
        default: return TaskStatus.AWAITING;
    }
}

function evaluateTransitions(task: Task): Transition | null {
    const currentStatusStr = statusToString(task.status);
    for (const transition of task.transitions) {
        if (transition.statuses.includes(currentStatusStr)) {
            // Validate condition against task (excluding status since it's checked above)
            const taskForValidation = { ...task };
            delete taskForValidation.status; // Status is handled by statuses array
            const validate = ajv.compile(transition.condition);
            if (validate(taskForValidation)) {
                return transition;
            }
        }
    }
    return null;
}

function executeTransition(task: Task, transition: Transition) {
    // Apply data mutations if any
    if (transition.dataMutations) {
        const mergedData = { ...task.data, ...transition.dataMutations };
        updateTaskData(task.id, mergedData);
        task.data = mergedData;
    }

    // Special handling for DELETED
    if (transition.transitionTo === "DELETED") {
        removeTaskFromAllDependsOn(task.id);
        deleteTask(task.id);
    } else {
        // Update status
        updateTaskStatus(task.id, stringToStatus(transition.transitionTo));
    }
}

function scheduleTransition(task: Task, transition: Transition) {
    // Calculate scheduled time
    const now = Date.now();
    const scheduledAt = Math.floor((now + parseDuration(transition.timing.every!)) / 1000);
    console.log(`[DEBUG] Scheduling transition for task ${task.id} at ${scheduledAt} (${new Date(scheduledAt * 1000).toISOString()})`);

    // Insert into transitions_schedule
    const stmt = db.prepare(`
        INSERT INTO transitions_schedule (task_id, transition_index, scheduled_at)
        VALUES (?, ?, ?)
    `);
    const transitionIndex = task.transitions.indexOf(transition);
    stmt.run(task.id, transitionIndex, scheduledAt);
}

function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's': return value * 1000;
        case 'm': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return 0;
    }
}

function processScheduledTransitions() {
    const now = Math.floor(Date.now() / 1000);
    console.log(`[DEBUG] Checking scheduled transitions at ${now}`);
    const stmt = db.prepare(`
        SELECT ts.*, t.* FROM transitions_schedule ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.scheduled_at <= ?
        ORDER BY ts.scheduled_at ASC
    `);
    const results = stmt.all(now);
    console.log(`[DEBUG] Found ${results.length} scheduled transitions`);

    for (const result of results) {
        const task = parseOneSQLTask(result);
        const transitionIndex = Number(result.transition_index);
        const transition = task.transitions[transitionIndex];
        console.log(`[DEBUG] Processing task ${task.id}, transition ${transitionIndex}, status ${task.status}`);

        if (transition) {
            console.log(`[DEBUG] Transition: ${JSON.stringify(transition)}`);
            // Re-evaluate condition
            const currentTransition = evaluateTransitions(task);
            if (currentTransition === transition) {
                console.log(`[DEBUG] Executing transition to ${transition.transitionTo}`);
                // Execute transition
                executeTransition(task, transition);

                // Remove from schedule
                const deleteStmt = db.prepare(`
                    DELETE FROM transitions_schedule WHERE task_id = ? AND transition_index = ?
                `);
                deleteStmt.run(task.id, transitionIndex);

                // Re-schedule if every is set
                if (transition.timing.every) {
                    console.log(`[DEBUG] Re-scheduling transition`);
                    scheduleTransition(task, transition);
                }
            } else {
                console.log(`[DEBUG] Condition not met, removing from schedule`);
                // Condition no longer met, remove from schedule
                const deleteStmt = db.prepare(`
                    DELETE FROM transitions_schedule WHERE task_id = ? AND transition_index = ?
                `);
                deleteStmt.run(task.id, transitionIndex);
            }
        } else {
            console.log(`[DEBUG] Transition not found at index ${transitionIndex}`);
        }
    }
}

function taskify(script: string): Task {
    return {
        id: crypto.randomUUID(),
        script,
        status: TaskStatus.AWAITING,
        data: {},
        artefacts: [],
        dependsOn: [],
        transitions: [],
        type: "deno",
        capabilitiesSchema: {}
    }
}
function addTask(task: Task) {
    const stmt = db.prepare(`
        INSERT INTO tasks (id, name, script, status, data, artefacts, dependsOn, transitions, type, capabilitiesSchema)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        task.id,
        task.name || null,
        task.script,
        task.status,
        JSON.stringify(task.data),
        JSON.stringify(task.artefacts),
        JSON.stringify(task.dependsOn),
        JSON.stringify(task.transitions),
        task.type,
        JSON.stringify(task.capabilitiesSchema)
    );
}

function parseOneSQLTask(obj: any) {
    if (obj !== undefined) {
        return {
            ...obj,
            data: JSON.parse(obj.data || '{}'),
            artefacts: JSON.parse(obj.artefacts || '[]'),
            dependsOn: JSON.parse(obj.dependsOn || '[]'),
            transitions: JSON.parse(obj.transitions || '[]'),
            capabilitiesSchema: JSON.parse(obj.capabilitiesSchema || '{}')
        };
    }
    return obj;
}

function parseAllSQLTasks(array: any[]) {
    if (array !== undefined) {
        return array.map(a => parseOneSQLTask(a));
    }
    return [];
}

function getTaskToComplete(type: string, capabilities?: object, filter_by_status?: TaskStatus) {
    // Get the task to complete, ensuring it's available, does not have any dependencies remaining, and its capabilities schema (if any) matches the provided capabilities.
    let sql = `SELECT * FROM tasks WHERE type = ?`;
    const params: any[] = [type];
    
    if (filter_by_status !== undefined) {
        sql += ` AND status = ?`;
        params.push(filter_by_status);
    }
    
    const stmt = db.prepare(sql);
    const tasks = stmt.all(...params);
    
    for (const taskRaw of tasks) {
        const task = parseOneSQLTask(taskRaw);
        // Check if all dependencies are completed
        let depsCompleted = true;
        for (const depId of task.dependsOn) {
            const depTask = getTask(depId);
            if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
                depsCompleted = false;
                break;
            }
        }
        if (!depsCompleted) continue;
        if (Object.hasOwn(task, "capabilitiesSchema")) {
            const validateResult = ajv.validate(task.capabilitiesSchema || {}, capabilities);
            if (typeof validateResult === 'boolean') {
                if (validateResult) {
                    // Task acceptable! Return it.
                    return task;
                }
            } else { // assuming it's a promise then
                console.warn("Task submitted with asynchronous capabilitiesSchema; ignoring!");
                // async schemas not supported! Ignore...
            }
        } else {
            return task;
        }
    }
}

function getTasks(filter_by_status?: TaskStatus) {
    if (filter_by_status === undefined) {
        const stmt = db.prepare("SELECT * FROM tasks");
        return parseAllSQLTasks(stmt.all());
    } else {
        const stmt = db.prepare("SELECT * FROM tasks WHERE status = ?");
        return parseAllSQLTasks(stmt.all(filter_by_status));
    }
}

function getTask(taskId: string, filter_by_status?: TaskStatus) {
    if (filter_by_status === undefined) {
        const stmt = db.prepare("SELECT * FROM tasks WHERE id = ?");
        const result = stmt.get(taskId);
        return parseOneSQLTask(result);
    } else {
        const stmt = db.prepare("SELECT * FROM tasks WHERE id = ? AND status = ?");
        const result = stmt.get(taskId, filter_by_status);
        return parseOneSQLTask(result);
    }
}

const getTaskMiddleware = createGetTaskMiddleware(getTask);
const getScript = createGetScriptMiddleware(getTask);
const injectDependencies = createInjectDependenciesMiddleware(getTask);

function checkTransitions(task: Task) {
    console.log(`[DEBUG] Checking transitions for task ${task.id}, status ${task.status}`);
    const transition = evaluateTransitions(task);
    if (transition) {
        console.log(`[DEBUG] Found transition: ${JSON.stringify(transition)}`);
        if (transition.timing.immediate) {
            console.log(`[DEBUG] Executing immediate transition`);
            // Execute transition immediately
            executeTransition(task, transition);
        } else if (transition.timing.every) {
            console.log(`[DEBUG] Scheduling transition`);
            // Schedule transition
            scheduleTransition(task, transition);
        }
    } else {
        console.log(`[DEBUG] No transition found`);
    }
}

function updateTaskStatus(taskId: string, status: TaskStatus) {
    const stmt = db.prepare("UPDATE tasks SET status = ? WHERE id = ?");
    stmt.run(status, taskId);

    // Check for transitions
    const task = getTask(taskId);
    if (task) {
        task.status = status; // Update the task object
        checkTransitions(task);
    }
}

function deleteTask(taskId: string) {
    const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
    stmt.run(taskId);
}

function setTaskStatus(taskId: string, status: number) {
    if (typeof status === "number" && (status === 0 || status === 1 || status === 2 || status === 3 || status === 4)) {
        const stmt = db.prepare("UPDATE tasks SET status = ? WHERE id = ?");
        stmt.run(status, taskId);
    }
}

function updateTaskData(taskId: string, data: Record<string, unknown>) {
    const currentTask = getTask(taskId);
    if (currentTask) {
        const updatedData = { ...currentTask.data, ...data };
        const stmt = db.prepare("UPDATE tasks SET data = ? WHERE id = ?");
        stmt.run(JSON.stringify(updatedData), taskId);
    }
}

function updateTaskAddArtefact(taskId, newArtefact: string) {
    const task = getTask(taskId);
    if (task !== undefined) {
        const artefacts = Array.from(new Set(task.artefacts.concat(newArtefact)));
        const stmt = db.prepare("UPDATE tasks SET artefacts = ? WHERE id = ?");
        stmt.run(JSON.stringify(artefacts), taskId);
        // console.log(`Added artefact ${newArtefact} to task ${taskId}`);
    }
}
function updateTaskRemoveArtefact(taskId, artefact: string) {
    const task = getTask(taskId);
    if (task !== undefined) {
        const artefacts = Array.from(task.artefacts.filter(x => x !== artefact));
        const stmt = db.prepare("UPDATE tasks SET artefacts = ? WHERE id = ?");
        stmt.run(JSON.stringify(artefacts), taskId);
        // console.log(`Added artefact ${newArtefact} to task ${taskId}`);
    }
}

function getAllTasksThatDependOn(taskId: string) {
    const stmt = db.prepare("SELECT * FROM tasks");
    const allTasks = stmt.all();
    const dependentTasks = allTasks.filter(task => {
        try {
            const dependsOn = JSON.parse(String(task.dependsOn) || '[]');
            return dependsOn.includes(taskId);
        } catch (e) {
            return false;
        }
    });
    return parseAllSQLTasks(dependentTasks);
}

function removeTaskFromAllDependsOn(taskId: string) {
    const stmt = db.prepare("SELECT * FROM tasks");
    const allTasks = stmt.all();
    
    allTasks.forEach(task => {
        try {
            const dependsOn = JSON.parse(String(task.dependsOn) || '[]');
            const depIndex = dependsOn.indexOf(taskId);
            if (depIndex !== -1) {
                dependsOn.splice(depIndex, 1);
                const updateStmt = db.prepare("UPDATE tasks SET dependsOn = ? WHERE id = ?");
                updateStmt.run(JSON.stringify(dependsOn), task.id);
            }
        } catch (e) {
            // Skip tasks with malformed dependsOn
        }
    });
}

const requiresLogin = (req, res, next) => {
    const hdr = req.header('Authorization');
    if (hdr === undefined) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const hdrs = hdr.split(" ")
    if (hdrs[0].toLowerCase() !== "bearer") {
        return res.status(401).json({ error: 'Unknown authorization scheme' });
    }
    const token = hdrs[1];
    if (!token) {
        return res.status(401).json({ error: 'Authentication failed' });
    }

    jsonwebtoken.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error(err);
            return res.status(403).json({ error: 'Authentication failed' });
        }
        req.user = user;
        next();
    });
}

const requiresPermission = (permission) => {
    return (req, res, next) => {
        if (!Object.hasOwn(req.user, "permissions")) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (req.user.permissions.indexOf("*") === -1 && req.user.permissions.indexOf(permission) === -1) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    }
}

app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = userdb.findUser(username);
        const loginvalid = await userdb.verifyLogin(username, password);
        if (!loginvalid) {
          return res.status(401).json({ error: 'Authentication failed' });
        }
        const token = jsonwebtoken.sign({ userId: username, permissions: String(user.permissions).split(",") }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
      } catch (e) {
        console.log(e); 
        return res.status(500).json({ error: 'Authentication failed' });
      }
});

app.get("/", function (req, res) {
  res.sendFile("static/index.html", { root: "." });
});

app.get("/openapi.yaml", function (req, res) {
  res.contentType("application/yaml");
  res.send(new TextDecoder().decode(Deno.readFileSync("openapi.yaml")));
});

app.get("/tasks", (req, res) => {
    res.json(Array.from(getTasks()));
});

app.get("/library", requiresLogin, (req, res) => {
    const scriptFiles = Array.from(Deno.readDirSync("./scripts/").filter(x => (x.name.endsWith(".ts") || x.name.endsWith(".js") || x.name.endsWith(".py")) && !x.name.includes(".template.")));
    const library = scriptFiles.map(file => {
        const scriptText = new TextDecoder().decode(Deno.readFileSync(`./scripts/${file.name}`));
        let capabilitiesSchema = {};
        if (scriptText.includes("<capabilitiesSchema>")) {
            try {
                let capabilitiesText = scriptText.substring(scriptText.indexOf("<capabilitiesSchema>") + 20, scriptText.indexOf("</capabilitiesSchema>"));
                capabilitiesText = capabilitiesText.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                capabilitiesSchema = JSON.parse(capabilitiesText);
            } catch (e) {
                // ignore
            }
        }
        let suggestedData = {};
        if (scriptText.includes("<data>")) {
            try {
                let dataText = scriptText.substring(scriptText.indexOf("<data>") + 6, scriptText.indexOf("</data>"));
                dataText = dataText.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                suggestedData = JSON.parse(dataText);
            } catch (e) {
                // ignore
            }
        }
        let name = "";
        if (scriptText.includes("<name>")) {
            try {
                name = scriptText.substring(scriptText.indexOf("<name>") + 6, scriptText.indexOf("</name>"));
            } catch (e) {
                // ignore
            }
        }
        let comments = "";
        if (scriptText.includes("<addTaskComments>")) {
            try {
                comments = scriptText.substring(scriptText.indexOf("<addTaskComments>") + 17, scriptText.indexOf("</addTaskComments>"));
            } catch (e) {
                // ignore
            }
        }
        return {
            filename: file.name,
            name,
            capabilitiesSchema,
            suggestedData,
            comments
        };
    });
    res.json(library);
});

app.get("/tasktracker", requiresLogin, (req, res) => {
    const minutes = parseInt(req.query.minutes as string) || 1440;
    res.json(taskTracker.getStats(minutes));
});

app.get("/agenttracker", requiresLogin, (req, res) => {
    const minutes = parseInt(req.query.minutes as string) || 1440;
    res.json(agentTracker.getStats(minutes));
});

app.post("/tasks", requiresLogin, requiresPermission(PERMISSION_CREATE_TASKS), taskTrackingMiddleware.onTaskCreated, upload.array('file'), async (req, res) => {
    const task = taskify(req.body.script);
    if (req.body.id) {
        task.id = req.body.id;
    }
    try {
        task.data = JSON.parse(req.body.data);
    } catch (e) {
        task.data = req.body.data || {};
    }
    try {
        task.capabilitiesSchema = JSON.parse(req.body.capabilitiesSchema);
    } catch (e) {
        task.capabilitiesSchema = req.body.capabilitiesSchema || {};
    }
    task.name = req.body.name;
    task.type = req.body.type;
    try {
        task.transitions = JSON.parse(req.body.transitions);
    } catch (e) {
        task.transitions = req.body.transitions || [];
    }

    // Validate transitions
    for (const transition of task.transitions) {
        if (!transition.statuses || !Array.isArray(transition.statuses)) {
            return res.status(400).json({ error: "Invalid transition: statuses must be an array" });
        }
        if (!transition.condition || typeof transition.condition !== 'object') {
            return res.status(400).json({ error: "Invalid transition: condition must be an object" });
        }
        if (!transition.timing || typeof transition.timing !== 'object') {
            return res.status(400).json({ error: "Invalid transition: timing must be an object" });
        }
        if (transition.timing.every && !/^(\d+[smhd])$/.test(transition.timing.every)) {
            return res.status(400).json({ error: "Invalid transition: timing.every must be in format like '1s', '30m', '1h', '1d'" });
        }
        if (typeof transition.transitionTo !== 'string' || !["AWAITING", "RUNNING", "COMPLETED", "FAILED", "PAUSED", "DELETED"].includes(transition.transitionTo)) {
            return res.status(400).json({ error: "Invalid transition: transitionTo must be a valid status name" });
        }
    }
    let dependsOn: string[] = [];
    try {
        if (typeof req.body.dependsOn == "object") {
            dependsOn = req.body.dependsOn;
        } else if (req.body.dependsOn !== undefined) {
            dependsOn = JSON.parse(req.body.dependsOn);
        } else {
            dependsOn = [];
        }
    } catch (e) {
        dependsOn = [];
    }
    task.status = req.body.status !== undefined ? parseInt(req.body.status) : TaskStatus.AWAITING;
    const dirpath = `./artefacts/tasks/${task.id}`;
    await Deno.mkdir(dirpath, { recursive: true });
    const artefacts = [];
    if (req.files !== undefined) {
        for (const file of req.files) {
            await Deno.rename(file.path, `${dirpath}/${file.originalname}`);
            artefacts.push(file.originalname);
        }
    }
    task.artefacts = artefacts;
    task.dependsOn = dependsOn || [];
    addTask(task);
    checkTransitions(task); // Schedule transitions for initial status
    res.locals.taskId = task.id; // Set for middleware
    res.json(task);
    res.send();
});

app.post("/tasks/get", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), agentTrackingMiddleware.onAgentConnected, (req, res) => {
    const task = getTaskToComplete(req.body.type, req.body.capabilities, TaskStatus.AWAITING);
    if (task) {
        const extension = req.body.type === "python" ? ".py" : ".ts";
        const taskScriptURL = `${req.protocol}://${req.get('host')}/scripts/${task.id}${extension}`;
        res.json({script: taskScriptURL, id: task.id, type: req.body.type})
        return;
    }
    res.json({});
});

app.get("/tasks/:id", requiresLogin, requiresPermission(PERMISSION_VIEW_TASKS), (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        res.json(task);
        return;
    }
    res.status(404);
    res.send();
});
app.delete("/tasks/:id", requiresLogin, requiresPermission(PERMISSION_DELETE_TASKS), (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        deleteTask(task.id);
        res.status(204);
        res.send();
    } else {
        res.status(404);
        res.send();
    }
});
app.patch("/tasks/:id", requiresLogin, requiresPermission(PERMISSION_UPDATE_TASKS), (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        try {
            if (Object.hasOwn(req.body, "status")) {
                // updating status
                setTaskStatus(task.id, req.body.status);
            }
        } catch (e) {
            res.status(500);
            res.send();
        } finally {
            res.status(204);
            res.send();
        }
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/accept", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), (req, res) => {
    const task = getTask(req.params.id, TaskStatus.AWAITING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.RUNNING);
        res.json({});
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/complete", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), taskTrackingMiddleware.onTaskCompleted, (req, res) => {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
    if (task) {
        updateTaskData(task.id, req.body.data);
        updateTaskStatus(task.id, TaskStatus.COMPLETED);

        res.json({});
        console.log(`Task ${req.params.id} completed with data ${JSON.stringify(req.body.data)}`);
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/data", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        res.json({});
        console.log(`Adding data to task ${req.params.id}: ${JSON.stringify(req.body.data)}`);
        updateTaskData(task.id, req.body.data);
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/failed", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), taskTrackingMiddleware.onTaskFailed, (req, res) => {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.FAILED);

        res.json({});
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/clone", requiresLogin, requiresPermission(PERMISSION_CREATE_TASKS), async (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        const oldTaskid = task.id;
        task.id = crypto.randomUUID();
        // clone all of the artefacts from the old task
        const dirpath = `./artefacts/tasks/${task.id}`;
        await Deno.mkdir(dirpath, { recursive: true });
        for (const artefact of task.artefacts) {
            await Deno.copyFile(`./artefacts/tasks/${oldTaskid}/${artefact}`, `${dirpath}/${artefact}`);
        }
        addTask(task);
        res.json(task);
        res.send();
    } else {
        res.status(404);
        res.send();
    }
});

app.use('/scripts', express.static('scripts'));
app.get("/scripts/agent(\.ts|\.py)?", (req, res) => {
    if (req.path.endsWith(".py")) {
        res.contentType("text/x-python");
        res.send(new TextDecoder().decode(
            Deno.readFileSync("./scripts/agent.template.py")
        )
        .replaceAll("${req.protocol}", req.protocol)
        .replaceAll("${req.get('host')}", req.get('host')
        ));
    } else {
        if (req.path.endsWith(".ts")) {
            res.contentType("application/typescript");
        } else if (req.path.endsWith(".js")) {
            res.contentType("application/javascript");
        }
        res.send(new TextDecoder().decode(
            Deno.readFileSync("./scripts/agent.template.ts")
        )
        .replaceAll("${req.protocol}", req.protocol)
        .replaceAll("${req.get('host')}", req.get('host')
        ));
    }
});

app.get("/scripts/:id\.?.*", getTaskMiddleware, getScript, injectDependencies, (req, res) => {
    const task = res.locals.task;
    if (task) {
        if (req.path.endsWith(".ts")) {
            res.contentType("application/typescript");
        } else if (req.path.endsWith(".js")) {
            res.contentType("application/javascript");
        } else if (req.path.endsWith(".py")) {
            res.contentType("text/x-python");
        }
        res.send(res.locals.script);
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/sheets/:id/data", requiresLogin, requiresPermission(PERMISSION_PUT_SHEET_DATA), (req, res) => {
    if (!validateSheetName(req.params.id) || !validateTableName(req.params.id)) {
        res.status(500);
        res.send("Invalid sheet name");
        return;
    }

    if (!Object.prototype.hasOwnProperty.call(req.body, "key")) {
        res.status(500);
        res.send("Data needs to be JSON with a 'key' property");
        return;
    }
    
    const sheetdb = new SheetDB(`./sheets/${req.params.id}.db`, false); // TODO: move to a map? what's the performance of this?
    const data = Object.entries(Object.assign({key: req.body.key}, req.body)); // Need to put the primary key first... This is terrible and I guess slow as well, but it works.
    // console.log('Upsert data:', data);
    sheetdb.upsertData(data);
    sheetdb.close();
    res.status(200);
    res.send();
});
app.delete("/sheets/:id/data/:key", requiresLogin, requiresPermission(PERMISSION_PUT_SHEET_DATA), (req, res) => {
    if (!validateSheetName(req.params.id) || !validateTableName(req.params.id)) {
        res.status(500);
        res.send("Invalid sheet name");
        return;
    }

    const sheetdb = new SheetDB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
    sheetdb.deleteRow(req.params.key);
    sheetdb.close();
    res.status(204);
    res.send();
});

app.get("/sheets/:id", requiresLogin, (req, res) => {
    if (!validateSheetName(req.params.id) || !validateTableName(req.params.id)) {
        res.status(500);
        res.send("Invalid sheet name");
        return;
    }

    let sheetdb;
    try {
        sheetdb = new SheetDB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
    } catch (e) {
        if (e.name === 'NotFoundError') {
            res.status(404);
        } else {
            res.status(500);
        }
        res.send();
        return;
    }
    const schema = sheetdb.getSchema();
    const rows = sheetdb.getRows();
    sheetdb.close();
    res.json({columns: schema, rows});
    res.send();
});

app.get("/sheets", requiresLogin, (req, res) => {
    const retval = [];
    for (const dirEntry of Deno.readDirSync("./sheets/")) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".db")) {
            retval.push(dirEntry.name.replace(/\.db$/,""));
        }
    }

    res.json(retval);
});

app.post('/tasks/:id/artefacts', requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), upload.single('file'), async function (req, res) {
    const task = getTask(req.params.id);
    if (task) {
        const dirpath = `./artefacts/tasks/${req.params.id}`;
        await Deno.mkdir(dirpath, { recursive: true });
        await Deno.rename(req.file.path, `${dirpath}/${req.file.originalname}`);
        const artefactURL = `${req.protocol}://${req.get('host')}/tasks/${req.params.id}/artefacts/${req.file.originalname}`;
        updateTaskAddArtefact(task.id, req.file.originalname);
        const directURL = `${req.protocol}://${req.get('host')}/artefacts/tasks/${req.params.id}/${req.file.originalname}`
        res.json({url: artefactURL, directURL: directURL });
        res.send();
    } else {
        res.status(400);
        res.send();
        await Deno.remove(req.file.path); // TODO: would it be possible to not even *accept* the file, and bail out earlier in the upload?
    }
});
app.get('/tasks/:id/artefacts/:filename', function (req, res) {
    const task = getTask(req.params.id);
    if (task) {
        res.redirect(307, `/artefacts/tasks/${req.params.id}/${req.params.filename}`);
    } else {
        res.status(404);
        res.send();
    }
});
app.delete('/tasks/:id/artefacts/:filename', requiresLogin, requiresPermission(PERMISSION_DELETE_TASKS), async function (req, res) {
    const task = getTask(req.params.id);
    if (task) {
        const dirpath = `./artefacts/tasks/${req.params.id}`;
        await Deno.remove(`${dirpath}/${req.params.filename}`);
        updateTaskRemoveArtefact(task.id, req.params.filename);
        res.status(204);
        res.send();
    } else {
        res.status(404);
        res.send();
    }
});


app.use('/artefacts', express.static('artefacts'));
app.delete('/artefacts/*', requiresLogin, requiresPermission(PERMISSION_DELETE_TASKS), async function (req, res) {
    if (req.params[0].indexOf("..") === -1) {
        const filepath = `./artefacts/${req.params[0]}`;
        try {
            await Deno.remove(`${filepath}`);
            res.status(204);
            res.send();
        } catch (e) {
            res.status(404);
            res.send();
        }
    } else {
        res.status(404);
        res.send();
    }
});

app.set('trust proxy', (ip) => {
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
