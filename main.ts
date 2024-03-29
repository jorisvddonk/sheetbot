import jsonwebtoken from "npm:jsonwebtoken";
import Ajv from "npm:ajv";
import https from "node:https";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";
import express from "npm:express";
import multer from "npm:multer";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { validateSheetName } from "./lib/sheet_validator.ts";
import { upsert, validateTableName } from "./lib/data_providers/sqlite/lib.ts";
import { SheetDB } from "./lib/data_providers/sqlite/sheetdb.ts";
import { UserDB } from "./lib/data_providers/sqlite/userdb.ts";

const SECRET_KEY = new TextDecoder().decode(Deno.readFileSync("./secret.txt"));

const PERMISSION_VIEW_TASKS = "viewTasks";
const PERMISSION_CREATE_TASKS = "createTasks";
const PERMISSION_PERFORM_TASKS = "performTasks";
const PERMISSION_DELETE_TASKS = "deleteTasks";
const PERMISSION_PUT_SHEET_DATA = "putSheetData";

const db = new DB("tasks.db");
db.execute(`
CREATE TABLE IF NOT EXISTS tasks (
    id STRING PRIMARY KEY,
    script TEXT,
    status INT,
    data JSON,
    artefacts JSON,
    dependsOn JSON,
    ephemeral NUMERIC REQUIRED,
    type STRING REQUIRED,
    capabilitiesSchema JSON
    )
`);

const app = express();
app.use(express.json());
app.use(express.static('static'))
const upload = multer({ dest: './artefacts/' });

const userdb = new UserDB();

const ajv = new Ajv();

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

interface Task {
    id: string,
    script: string,
    status: TaskStatus,
    data: Object,
    artefacts: string[],
    dependsOn: string[],
    ephemeral: Ephemeralness,
    type: string,
    capabilitiesSchema: Object
}

interface TaskQ extends Task {
    [name: string]: string | string[]
}

enum TaskStatus {
    AWAITING = 0,
    RUNNING = 1,
    COMPLETED = 2,
    FAILED = 3
}

enum Ephemeralness {
    PERSISTENT = 0, // task will not get auto-deleted on completion
    EPHEMERAL_ON_SUCCESS = 1, // task will get auto-deleted, but only if completed successful; this allows you to debug failures
    EPHEMERAL_ALWAYS = 2 // task will get auto-deleted when completed, regardless of if it completed succesfully or not
}

function taskify(script: string): Task {
    return {
        id: crypto.randomUUID(),
        script,
        status: TaskStatus.AWAITING,
        data: {},
        artefacts: [],
        dependsOn: [],
        ephemeral: Ephemeralness.PERSISTENT,
        type: "deno",
        capabilitiesSchema: {}
    }
}
function addTask(task: Task) {
    const query = db.prepareQuery<never, never, { id: string, script: string, status: TaskStatus, data: string, artefacts: string, dependsOn: string, type: string, ephemeral: number, capabilitiesSchema: string }>("INSERT INTO tasks (id, script, status, data, artefacts, dependsOn, ephemeral, type, capabilitiesSchema) VALUES (:id, :script, :status, :data, :artefacts, :dependsOn, :ephemeral, :type, :capabilitiesSchema)");
    query.execute({
        id: task.id,
        script: task.script,
        status: task.status,
        data: JSON.stringify(task.data),
        artefacts: JSON.stringify(task.artefacts),
        dependsOn: JSON.stringify(task.dependsOn),
        type: task.type,
        ephemeral: task.ephemeral,
        capabilitiesSchema: JSON.stringify(task.capabilitiesSchema)
    });
}

function parseOneSQLTask(obj) {
    if (obj !== undefined) {
        return {...obj, data: JSON.parse(obj.data), artefacts: JSON.parse(obj.artefacts), dependsOn: JSON.parse(obj.dependsOn), capabilitiesSchema: JSON.parse(obj.capabilitiesSchema)};
    }
    return obj;
}

function parseAllSQLTasks(array) {
    if (array !== undefined) {
        return array.map(a => parseOneSQLTask(a), []);
    }
    return array;
}

function getTaskToComplete(type: string, capabilities?: object, filter_by_status?: TaskStatus) {
    // Get the task to complete, ensuring it's available, does not have any dependencies remaining, and its capabilities schema (if any) matches the provided capabilities.
    const query = db.prepareQuery<[string, string, TaskStatus], TaskQ>(`SELECT * FROM tasks WHERE type = :type AND (dependsOn IS NULL OR json_array_length(dependsOn) = 0) ${filter_by_status === undefined ? '' : 'AND status = :status'}`);
    const tasks = query.allEntries({type: type, status: filter_by_status});
    for (const taskRaw of tasks) {
        const task = parseOneSQLTask(taskRaw);
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
        const query = db.prepareQuery<[string, string, TaskStatus], TaskQ>("SELECT * FROM tasks");
        return parseAllSQLTasks(query.allEntries());
    } else {
        const query = db.prepareQuery<[string, string, TaskStatus], TaskQ>("SELECT * FROM tasks WHERE status = :status");
        return parseAllSQLTasks(query.allEntries({status: filter_by_status}));
    }
}

function getTask(taskId: string, filter_by_status?: TaskStatus) {
    if (filter_by_status === undefined) {
        const query = db.prepareQuery<[string, string, TaskStatus], TaskQ>("SELECT * FROM tasks WHERE id = :id");
        return parseOneSQLTask(query.firstEntry({id: taskId}));
    } else {
        const query = db.prepareQuery<[string, string, TaskStatus], TaskQ>("SELECT * FROM tasks WHERE id = :id AND status = :status");
        return parseOneSQLTask(query.firstEntry({id: taskId, status: filter_by_status}));
    }
}

function updateTaskStatus(taskId: string, status: TaskStatus) {
    const query = db.prepareQuery<never, never, { id: string, status: TaskStatus }>("UPDATE tasks SET status = :status WHERE id = :id");
    query.execute({id: taskId, status: status});
}

function deleteTask(taskId: string) {
    const query = db.prepareQuery<never, never, { id: string }>("DELETE FROM tasks WHERE id = :id");
    query.execute({id: taskId});
}

function updateTaskData(taskId: string, data: Object) {
    for (const [key, value] of Object.entries(data)) {
        const query = db.prepareQuery<never, never, { id: string, key: string, value: string}>("UPDATE tasks SET data=(select json_set(data, :key, :value) from tasks where id == :id) where id == :id");
        query.execute({id: taskId, key: `$.${key}`, value: value});
    }
}

function updateTaskAddArtefact(taskId, newArtefact: string) {
    const task = getTask(taskId);
    if (task !== undefined) {
        const artefacts = Array.from(new Set(task.artefacts.concat(newArtefact)));
        const query = db.prepareQuery<never, never, { id: string, artefacts: string}>("UPDATE tasks SET artefacts=:artefacts where id == :id");
        query.execute({id: taskId, artefacts: JSON.stringify(artefacts)});
        // console.log(`Added artefact ${newArtefact} to task ${taskId}`);
    }
}
function updateTaskRemoveArtefact(taskId, artefact: string) {
    const task = getTask(taskId);
    if (task !== undefined) {
        const artefacts = Array.from(task.artefacts.filter(x => x !== artefact));
        const query = db.prepareQuery<never, never, { id: string, artefacts: string}>("UPDATE tasks SET artefacts=:artefacts where id == :id");
        query.execute({id: taskId, artefacts: JSON.stringify(artefacts)});
        // console.log(`Added artefact ${newArtefact} to task ${taskId}`);
    }
}

function getAllTasksThatDependOn(taskId: string) {
    const q = db.prepareQuery("SELECT *, (SELECT key FROM json_each(dependsOn) WHERE value = :taskid) as _json_array_key from tasks WHERE _json_array_key IS NOT NULL");
    const rows = q.allEntries({taskid: taskId}).map(r => {
        delete r["_json_array_key"];
        return r;
    });
    return parseAllSQLTasks(rows);
}

function removeTaskFromAllDependsOn(taskId: string) {
    // This doesn't work in a single query for some reason in this version of sqlite... :(
    const q = db.prepareQuery("SELECT *, (SELECT key FROM json_each(dependsOn) WHERE value = :taskid) as key from tasks WHERE key IS NOT NULL");
    const rows = q.allEntries({taskid: taskId});
    rows.forEach(row => {
        const query = db.prepareQuery("UPDATE tasks SET dependsOn = JSON_REMOVE(dependsOn, '$[' || :k || ']')");
        query.execute({k: row.key as string});
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
        if (!req.user.hasOwnProperty("permissions")) {
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
        const user = await userdb.findUser(username);
        const loginvalid = await userdb.verifyLogin(username, password);
        if (!loginvalid) {
          return res.status(401).json({ error: 'Authentication failed' });
        }
        const token = jsonwebtoken.sign({ userId: username, permissions: user.permissions.split(",") }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
      } catch (e) {
        console.log(e); 
        return res.status(500).json({ error: 'Authentication failed' });
      }
});

app.get("/", function (req, res) {
  res.send("Hello World");
});

app.get("/tasks", requiresLogin, requiresPermission(PERMISSION_VIEW_TASKS), (req, res) => {
    res.json(Array.from(getTasks()));
});


app.post("/tasks", requiresLogin, requiresPermission(PERMISSION_CREATE_TASKS), upload.array('file'), async (req, res) => {
    const task = taskify(req.body.script);
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
    task.type = req.body.type;
    task.ephemeral = req.body.ephemeral || Ephemeralness.PERSISTENT;
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
    task.dependsOn = [];
    for (const dep of (dependsOn || [])) {
        const dependentTask = getTask(dep)
        if (dependentTask) { // only add tasks that actually exist and haven't failed or completed yet
            if (dependentTask.status !== TaskStatus.FAILED && dependentTask.status !== TaskStatus.COMPLETED) {
                task.dependsOn.push(dep);
            } else {
                console.log("WARN: dependent task was not in a valid state");
            }
        } else {
            console.log("WARN: dependent task was not found");
        }
    }
    addTask(task);
    res.json(task);
    res.send();
});

app.post("/tasks/get", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), (req, res) => {
    const task = getTaskToComplete(req.body.type, req.body.capabilities, TaskStatus.AWAITING);
    if (task) {
        const taskScriptURL = `${req.protocol}://${req.get('host')}/scripts/${task.id}.ts`;
        res.json({script: taskScriptURL, id: task.id, type: "deno"})
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

app.post("/tasks/:id/complete", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), (req, res) => {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.COMPLETED);
        removeTaskFromAllDependsOn(task.id);
        res.json({});
        console.log(`Task ${req.params.id} completed with data ${JSON.stringify(req.body.data)}`);
        updateTaskData(task.id, req.body.data);
        if (task.ephemeral === Ephemeralness.EPHEMERAL_ALWAYS || task.ephemeral == Ephemeralness.EPHEMERAL_ON_SUCCESS) {
            deleteTask(task.id);
        }
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

app.post("/tasks/:id/failed", requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), (req, res) => {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.FAILED);
        if (task.ephemeral === Ephemeralness.EPHEMERAL_ALWAYS) {
            // delete all tasks that depend on this ephemeral task that just failed
            getAllTasksThatDependOn(task.id).forEach(t => {
                deleteTask(t.id);
            });
            // delete this task
            deleteTask(task.id);
        }
        res.json({});
    } else {
        res.status(404);
        res.send();
    }
});

app.use('/scripts', express.static('scripts'));
app.get("/scripts/agent(\.ts)?", (req, res) => {
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
});

app.get("/scripts/:id\.?.*", (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        if (req.path.endsWith(".ts")) {
            res.contentType("application/typescript");
        } else if (req.path.endsWith(".js")) {
            res.contentType("application/javascript");
        }
        res.send(task.script);
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
    
    const sheetdb = new SheetDB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
    const data = Object.entries(Object.assign({key: req.body.key}, req.body)); // Need to put the primary key first... This is terrible and I guess slow as well, but it works.
    sheetdb.upsertData(data); 
    sheetdb.close();
    res.status(200);
    res.send();
});

app.get("/sheets/:id", (req, res) => {
    if (!validateSheetName(req.params.id) || !validateTableName(req.params.id)) {
        res.status(500);
        res.send("Invalid sheet name");
        return;
    }

    const sheetdb = new SheetDB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
    const schema = sheetdb.getSchema();
    const rows = sheetdb.getRows();
    sheetdb.close();
    res.json({columns: schema, rows});
    res.send();
});

app.get("/sheets", (req, res) => {
    const retval = [];
    for (const dirEntry of Deno.readDirSync("./sheets/")) {
        if (dirEntry.isFile && dirEntry.name.endsWith(".db")) {
            retval.push(dirEntry.name.replace(/\.db$/,""));
        }
    }

    res.json(retval);
    res.send();
});

app.post('/tasks/:id/artefacts', requiresLogin, requiresPermission(PERMISSION_PERFORM_TASKS), upload.single('file'), async function (req, res) {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
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
        res.json({});
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
            res.json({});
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
