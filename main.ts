import express from "npm:express";
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
    tasks.set(task.id, task);
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
    res.json(Array.from(tasks.values()));
});

app.get("/tasks/get", (req, res) => {
    for (const [taskid, task] of tasks.entries()) {
        if (task.status === TaskStatus.AWAITING) {
            const taskScriptURL = `${req.protocol}://${req.get('host')}/scripts/${task.id}`;
            res.json({script: taskScriptURL, id: task.id, type: "deno"})
            return;
        }
    }
    res.json({});
});

app.post("/tasks/:id/accept", (req, res) => {
    const task = tasks.get(req.params.id);
    if (task && task.status === TaskStatus.AWAITING) {
        task.status = TaskStatus.RUNNING;
        res.json({});
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/complete", (req, res) => {
    const task = tasks.get(req.params.id);
    if (task && task.status === TaskStatus.RUNNING) {
        task.status = TaskStatus.COMPLETED;
        res.json({});
        console.log(`Task ${req.params.id} completed with data ${JSON.stringify(req.body.data)}`);
    } else {
        res.status(404);
        res.send();
    }
});

app.post("/tasks/:id/failed", (req, res) => {
    const task = tasks.get(req.params.id);
    if (task && task.status === TaskStatus.RUNNING) {
        task.status = TaskStatus.FAILED;
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
        let task = tasks.get(req.params.id);
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
