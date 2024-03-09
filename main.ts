import express from "npm:express";
import { DB } from "https://deno.land/x/sqlite/mod.ts";

const IN_MEMORY = false;

const db = new DB("tasks.db");
if (!IN_MEMORY) {
    db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
        id STRING PRIMARY KEY,
        script TEXT,
        status INT
        )
    `);
}

const app = express();
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

interface Task {
    id: string,
    script: string
    status: TaskStatus
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
        status: TaskStatus.AWAITING
    }
}
function addTask(task: Task) {
    if (IN_MEMORY) {
        tasks.set(task.id, task);
    } else {
        const query = db.prepareQuery<never, never, { id: string, script: string, status: TaskStatus }>("INSERT INTO tasks (id, script, status) VALUES (:id, :script, :status)");
        query.execute(task);
    }
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
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus }>("SELECT id, script, status FROM tasks");
            return query.firstEntry();
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus }>("SELECT id, script, status FROM tasks WHERE status = :status");
            return query.firstEntry({status: filter_by_status});
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
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus }>("SELECT id, script, status FROM tasks");
            return query.allEntries();
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus }>("SELECT id, script, status FROM tasks WHERE status = :status");
            return query.allEntries({status: filter_by_status});
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
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus }>("SELECT id, script, status FROM tasks WHERE id = :id");
            return query.firstEntry({id: taskId});
        } else {
            const query = db.prepareQuery<[string, string, TaskStatus], { id: string, script: string, status: TaskStatus }>("SELECT id, script, status FROM tasks WHERE id = :id AND status = :status");
            return query.firstEntry({id: taskId, status: filter_by_status});
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

const javascript = (strings, ...values) => String.raw({ raw: strings }, ...values);
addTask(taskify(javascript`
import shell from "npm:shelljs"
import tmp from "npm:tmp"
import $ from "https://deno.land/x/dax/mod.ts";

let tmpdir = tmp.dirSync().name;
$.cd(tmpdir);
await $\`git clone https://github.com/jorisvddonk/tzo-c .\`
await $\`mkdir build\`
await $\`cmake -S . -B build/\`
await $\`cmake --build build/\`
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
            await fetch("${req.protocol}://${req.get('host')}/tasks/" + json.id + "/accept", {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            try {
                const data = await import(json.script);
                await fetch("${req.protocol}://${req.get('host')}/tasks/" + json.id + "/complete", {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({data: data})
                });
            } catch (e) {
                await fetch("${req.protocol}://${req.get('host')}/tasks/" + json.id + "/failed", {
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
