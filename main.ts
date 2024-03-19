import express from "npm:express";
import multer from "npm:multer";
import { DB } from "https://deno.land/x/sqlite/mod.ts";
import { validateSheetName } from "./lib/sheet_validator.ts";
import { upsert, validateTableName } from "./lib/data_providers/sqlite/lib.ts";

const IN_MEMORY = false;

const db = new DB("tasks.db");
if (!IN_MEMORY) {
    db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
        id STRING PRIMARY KEY,
        script TEXT,
        status INT,
        data JSON,
        artefacts JSON
        )
    `);
}

const app = express();
app.use(express.json());
app.use(express.static('static'))
const upload = multer({ dest: './artefacts/' });

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

interface Task {
    id: string,
    script: string,
    status: TaskStatus,
    data: Object,
    artefacts: string[]
}

enum TaskStatus {
    AWAITING = 0,
    RUNNING = 1,
    COMPLETED = 2,
    FAILED = 3
}

const tasks: Map<string, Task> = new Map();
function taskify(script: string): Task {
    return {
        id: crypto.randomUUID(),
        script,
        status: TaskStatus.AWAITING,
        data: {},
        artefacts: []
    }
}
function addTask(task: Task) {
    if (IN_MEMORY) {
        tasks.set(task.id, task);
    } else {
        const query = db.prepareQuery<never, never, { id: string, script: string, status: TaskStatus, data: string, artefacts: string }>("INSERT INTO tasks (id, script, status, data, artefacts) VALUES (:id, :script, :status, :data, :artefacts)");
        query.execute({
            id: task.id,
            script: task.script,
            status: task.status,
            data: JSON.stringify(task.data),
            artefacts: JSON.stringify(task.artefacts)
        });
    }
}

function parseOneSQLTask(obj) {
    if (obj !== undefined) {
        return {...obj, data: JSON.parse(obj.data), artefacts: JSON.parse(obj.artefacts)};
    }
    return obj;
}

function parseAllSQLTasks(array) {
    if (array !== undefined) {
        return array.map(a => parseOneSQLTask(a), []);
    }
    return array;
}

function getFirstTask(filter_by_status?: TaskStatus) {
    if (IN_MEMORY) {
        for (const [taskid, task] of tasks.entries()) {
            if (filter_by_status !== undefined && task.status === filter_by_status) {
                return task;
            } else {
                return task;
            }
        }
    } else {
        if (filter_by_status === undefined) {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data, artefacts FROM tasks");
            return parseOneSQLTask(query.firstEntry());
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data, artefacts FROM tasks WHERE status = :status");
            return parseOneSQLTask(query.firstEntry({status: filter_by_status}));
        }
    }
}

function getTasks(filter_by_status?: TaskStatus) {
    if (IN_MEMORY) {
        const tasks_c = [];
        for (const [taskid, task] of tasks.entries()) {
            if (filter_by_status !== undefined && task.status === filter_by_status) {
                tasks_c.push(task);
            } else {
                tasks_c.push(task);
            }
        }
        return tasks_c;
    } else {
        if (filter_by_status === undefined) {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data, artefacts FROM tasks");
            return parseAllSQLTasks(query.allEntries());
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data, artefacts FROM tasks WHERE status = :status");
            return parseAllSQLTasks(query.allEntries({status: filter_by_status}));
        }
    }
}

function getTask(taskId: string, filter_by_status?: TaskStatus) {
    if (IN_MEMORY) {
        let task = tasks.get(taskId);
        if (filter_by_status !== undefined && task !== undefined && task.status !== filter_by_status) {
            task = undefined;
        }
        return task;
    } else {
        if (filter_by_status === undefined) {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data, artefacts FROM tasks WHERE id = :id");
            return parseOneSQLTask(query.firstEntry({id: taskId}));
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data, artefacts FROM tasks WHERE id = :id AND status = :status");
            return parseOneSQLTask(query.firstEntry({id: taskId, status: filter_by_status}));
        }
    }
}

function updateTaskStatus(taskId: string, status: TaskStatus) {
    if (IN_MEMORY) {
        let task = tasks.get(taskId);
        if (task !== undefined) {
            task.status = status;
        }
    } else {
        const query = db.prepareQuery<never, never, { id: string, status: TaskStatus }>("UPDATE tasks SET status = :status WHERE id = :id");
        query.execute({id: taskId, status: status});
    }
}

function updateTaskData(taskId: string, data: Object) {
    if (IN_MEMORY) {
        let task = tasks.get(taskId);
        if (task !== undefined) {
            task.data = Object.assign({}, task.data, data);
        }
    } else {
        for (const [key, value] of Object.entries(data)) {
            const query = db.prepareQuery<never, never, { id: string, key: string, value: string}>("UPDATE tasks SET data=(select json_set(data, :key, :value) from tasks where id == :id) where id == :id");
            query.execute({id: taskId, key: `$.${key}`, value: value});
        }
    }
}

function updateTaskAddArtefact(taskId, newArtefact: string) {
    const task = getTask(taskId);
    if (IN_MEMORY) {
        if (task !== undefined) {
            task.artefacts = Array.from(new Set(task.artefacts.concat(newArtefact)));
        }
    } else {
        if (task !== undefined) {
            const artefacts = Array.from(new Set(task.artefacts.concat(newArtefact)));
            const query = db.prepareQuery<never, never, { id: string, artefacts: string}>("UPDATE tasks SET artefacts=:artefacts where id == :id");
            query.execute({id: taskId, artefacts: JSON.stringify(artefacts)});
            // console.log(`Added artefact ${newArtefact} to task ${taskId}`);
        }
    }
}

const javascript = (strings, ...values) => String.raw({ raw: strings }, ...values);
/*addTask(taskify(javascript`
import shell from "npm:shelljs"
import tmp from "npm:tmp"
import $ from "https://deno.land/x/dax/mod.ts";

async function subtask_statusupdate(subtaskname, completed) {
    const data = {};
    data["subtask/" + subtaskname] = completed ? true : false;
    await fetch(Deno.env.get("SHEETBOT_TASK_DATAURL"), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({data: data})
    });
}


let tmpdir = tmp.dirSync().name;
$.cd(tmpdir);
await subtask_statusupdate("git checkout", false);
await $\`git clone https://github.com/jorisvddonk/tzo-c .\`
await subtask_statusupdate("git checkout", true);
await subtask_statusupdate("build", false);
await $\`mkdir build\`
await $\`cmake -S . -B build/\`
await $\`cmake --build build/\`
await subtask_statusupdate("build", true);
shell.ls().forEach(file => {
    shell.echo(file);
});
`));*/

app.get("/", function (req, res) {
  res.send("Hello World");
});

app.get("/tasks", (req, res) => {
    res.json(Array.from(getTasks()));
});

app.post("/tasks", upload.array('file'), async (req, res) => {
    const task = taskify(req.body.script);
    try {
        task.data = JSON.parse(req.body.data);
    } catch (e) {
        task.data = req.body.data;
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
    addTask(task);
    res.json(task);
    res.send();
});

app.get("/tasks/get", (req, res) => {
    const task = getFirstTask(TaskStatus.AWAITING);
    if (task) {
        const taskScriptURL = `${req.protocol}://${req.get('host')}/scripts/${task.id}.ts`;
        res.json({script: taskScriptURL, id: task.id, type: "deno"})
        return;
    }
    res.json({});
});

app.get("/tasks/:id", (req, res) => {
    const task = getTask(req.params.id);
    if (task) {
        res.json(task);
        return;
    }
    res.status(404);
    res.send();
});

app.post("/tasks/:id/accept", (req, res) => {
    const task = getTask(req.params.id, TaskStatus.AWAITING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.RUNNING);
        res.json({});
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/complete", (req, res) => {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.COMPLETED);
        res.json({});
        console.log(`Task ${req.params.id} completed with data ${JSON.stringify(req.body.data)}`);
        updateTaskData(task.id, req.body.data);
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/data", (req, res) => {
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

app.post("/tasks/:id/failed", (req, res) => {
    const task = tasks.get(req.params.id, TaskStatus.RUNNING);
    if (task) {
        updateTaskStatus(task.id, TaskStatus.FAILED);
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

app.post("/sheets/:id/data", (req, res) => {
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

    const sheet_db = new DB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
    sheet_db.execute(`
        CREATE TABLE IF NOT EXISTS "${req.params.id}" (
            key STRING PRIMARY KEY
        )`);
    const data = Object.entries(Object.assign({key: req.body.key}, req.body)); // Need to put the primary key first... This is terrible and I guess slow as well, but it works.
    upsert(sheet_db, req.params.id, data); 
    sheet_db.close();
    res.status(200);
    res.send();
});

app.get("/sheets/:id", (req, res) => {
    if (!validateSheetName(req.params.id) || !validateTableName(req.params.id)) {
        res.status(500);
        res.send("Invalid sheet name");
        return;
    }

    const sheet_db = new DB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
    sheet_db.execute(`
        CREATE TABLE IF NOT EXISTS "${req.params.id}" (
            key STRING PRIMARY KEY
        )`);
    const schema = sheet_db.queryEntries(`pragma table_info("${req.params.id}");`);
    const schemaMap = schema.reduce((memo, value: any, index) => { // TODO: value should have a typedef corresponding to an obj with keys cid, name, type, notnull, dflt_value and pk
        memo[value.name] = value;
        return memo;
    }, {});
    const columns = schema.map(s => s.name);
    const rowEntries = sheet_db.queryEntries(`SELECT * FROM "${req.params.id}"`);
    const rows = rowEntries.map(rowEntry => {
        const returnrow = [];
        Object.entries(rowEntry).forEach(re => {
            if (schemaMap[re[0]].type === "JSON") {
                try {
                    re[1] = JSON.parse(re[1]);
                } catch (e) {
                    re[1] = re[1]; // data is actually a string, so return a string
                }
            }
            returnrow.push(re[1]);
        })
        return returnrow;
    });
    sheet_db.close();
    res.json({schema: schemaMap, columnNames: columns, rows});
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

app.post('/tasks/:id/artefacts', upload.single('file'), async function (req, res) {
    const task = getTask(req.params.id, TaskStatus.RUNNING);
    if (task) {
        const dirpath = `./artefacts/tasks/${req.params.id}`;
        await Deno.mkdir(dirpath, { recursive: true });
        await Deno.rename(req.file.path, `${dirpath}/${req.file.originalname}`);
        const artefactURL = `${req.protocol}://${req.get('host')}/tasks/${req.params.id}/artefacts/${req.file.originalname}`;
        updateTaskAddArtefact(task.id, req.file.originalname);
        res.json({url: artefactURL});
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

app.use('/artefacts', express.static('artefacts'));


app.listen(3000);
console.log("listening on http://localhost:3000/");
