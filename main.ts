import express from "npm:express";
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const IN_MEMORY = false;

const db = new DB("tasks.db");
if (!IN_MEMORY) {
    db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
        id STRING PRIMARY KEY,
        script TEXT,
        status INT,
        data JSON
        )
    `);
}

const app = express();
app.use(express.json());
app.use(express.static('static'))

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

interface Task {
    id: string,
    script: string,
    status: TaskStatus,
    data: Object,
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
        data: {}
    }
}
function addTask(task: Task) {
    if (IN_MEMORY) {
        tasks.set(task.id, task);
    } else {
        const query = db.prepareQuery<never, never, { id: string, script: string, status: TaskStatus, data: string }>("INSERT INTO tasks (id, script, status, data) VALUES (:id, :script, :status, :data)");
        query.execute({
            id: task.id,
            script: task.script,
            status: task.status,
            data: JSON.stringify(task.data)
        });
    }
}

function parseOneSQLTask(obj) {
    if (obj !== undefined) {
        return {...obj, data: JSON.parse(obj.data)};
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
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data FROM tasks");
            return parseOneSQLTask(query.firstEntry());
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data FROM tasks WHERE status = :status");
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
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data FROM tasks");
            return parseAllSQLTasks(query.allEntries());
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data FROM tasks WHERE status = :status");
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
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data FROM tasks WHERE id = :id");
            return parseOneSQLTask(query.firstEntry({id: taskId}));
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus, data: Object }>("SELECT id, script, status, data FROM tasks WHERE id = :id AND status = :status");
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

const javascript = (strings, ...values) => String.raw({ raw: strings }, ...values);
addTask(taskify(javascript`
import shell from "npm:shelljs"
import tmp from "npm:tmp"
import $ from "https://deno.land/x/dax/mod.ts";

async function subtask_statusupdate(subtaskname, completed) {
    const data = {};
    data["subtask/" + subtaskname] = completed ? true : false;
    await fetch(Deno.env.get("SHEETBOX_TASK_DATAURL"), {
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
`));

app.get("/", function (req, res) {
  res.send("Hello World");
});

app.get("/tasks", (req, res) => {
    res.json(Array.from(getTasks()));
});

app.get("/tasks/get", (req, res) => {
    const task = getFirstTask(TaskStatus.AWAITING);
    if (task) {
        const taskScriptURL = `${req.protocol}://${req.get('host')}/scripts/${task.id}`;
        res.json({script: taskScriptURL, id: task.id, type: "deno"})
        return;
    }
    res.json({});
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

app.get("/scripts/:id", (req, res) => {
    if (req.params.id == 'agent') {
        res.send(javascript`
        const response = await fetch("${req.protocol}://${req.get('host')}/tasks/get")
        const json = await response.json();
        if (json.hasOwnProperty("script")) {

            Deno.env.set("SHEETBOX_TASK_ID", json.id);
            Deno.env.set("SHEETBOX_TASK_BASEURL", "${req.protocol}://${req.get('host')}/tasks/" + json.id);
            Deno.env.set("SHEETBOX_TASK_ACCEPTURL", "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/accept");
            Deno.env.set("SHEETBOX_TASK_COMPLETEURL", "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/complete");
            Deno.env.set("SHEETBOX_TASK_FAILEDURL", "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/failed");
            Deno.env.set("SHEETBOX_TASK_DATAURL", "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/data");

            await fetch(Deno.env.get("SHEETBOX_TASK_ACCEPTURL"), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            try {
                const data = await import(json.script);
                await fetch(Deno.env.get("SHEETBOX_TASK_COMPLETEURL"), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({data: data})
                });
            } catch (e) {
                console.error(e);
                await fetch(Deno.env.get("SHEETBOX_TASK_FAILEDURL"), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({})
                });
            }
        }`);
    } else {
        const task = getTask(req.params.id);
        if (task) {
            res.send(task.script);
        } else {
            res.status(404);
            res.send();
        }
    }
});


app.listen(3000);
console.log("listening on http://localhost:3000/");
