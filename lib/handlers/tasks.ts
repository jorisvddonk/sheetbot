import multer from "npm:multer@2.0.2";
import { DatabaseSync } from "node:sqlite";
import { TaskTracker } from "../tasktracker.ts";
import { AgentTracker } from "../agenttracker.ts";
import { TransitionTracker } from "../transitiontracker.ts";
import { createTaskTrackingMiddleware } from "../task-tracking-middleware.ts";
import { createAgentTrackingMiddleware } from "../agent-tracking-middleware.ts";
import { taskify, addTask, getTasks, getTask, updateTaskStatus, deleteTask, updateTaskData, getTaskToComplete, checkTransitions, updateTaskAddArtefact, updateTaskRemoveArtefact } from "../tasks.ts";
import { TaskStatus } from "../models.ts";

const PERMISSION_VIEW_TASKS = "viewTasks";
const PERMISSION_CREATE_TASKS = "createTasks";
const PERMISSION_PERFORM_TASKS = "performTasks";
const PERMISSION_DELETE_TASKS = "deleteTasks";
const PERMISSION_UPDATE_TASKS = "updateTasks";

export function createGetTasksHandler(db: DatabaseSync) {
    return (req: any, res: any) => {
        res.json(Array.from(getTasks(db)));
    };
}

export function createCreateTaskHandler(db: DatabaseSync, transitionTracker: TransitionTracker, taskTrackingMiddleware: any) {
    const upload = multer({ dest: './artefacts/' });
    return [
        taskTrackingMiddleware.onTaskCreated,
        upload.array('file'),
        async (req: any, res: any) => {
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
            addTask(db, task);
            checkTransitions(db, transitionTracker, task); // Schedule transitions for initial status
            res.locals.taskId = task.id; // Set for middleware
            res.json(task);
            res.send();
        }
    ];
}

export function createGetTaskHandler(db: DatabaseSync) {
    return (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            res.json(task);
            return;
        }
        res.status(404);
        res.send();
    };
}

export function createDeleteTaskHandler(db: DatabaseSync) {
    return (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            deleteTask(db, task.id);
            res.status(204);
            res.send();
        } else {
            res.status(404);
            res.send();
        }
    };
}

export function createUpdateTaskHandler(db: DatabaseSync, transitionTracker: TransitionTracker) {
    return (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            try {
                if (Object.hasOwn(req.body, "status")) {
                    // updating status
                    updateTaskStatus(db, transitionTracker, task.id, req.body.status);
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
    };
}

export function createAcceptTaskHandler(db: DatabaseSync, transitionTracker: TransitionTracker) {
    return (req: any, res: any) => {
        const task = getTask(db, req.params.id, TaskStatus.AWAITING);
        if (task) {
            updateTaskStatus(db, transitionTracker, task.id, TaskStatus.RUNNING);
            res.json({});
        } else {
            res.status(404);
            res.send();
        }
    };
}

export function createCompleteTaskHandler(db: DatabaseSync, transitionTracker: TransitionTracker, taskTrackingMiddleware: any) {
    return [
        taskTrackingMiddleware.onTaskCompleted,
        (req: any, res: any) => {
            const task = getTask(db, req.params.id, TaskStatus.RUNNING);
            if (task) {
                updateTaskData(db, task.id, req.body.data);
                updateTaskStatus(db, transitionTracker, task.id, TaskStatus.COMPLETED);

                res.json({});
                console.log(`Task ${req.params.id} completed with data ${JSON.stringify(req.body.data)}`);
            } else {
                res.status(404);
                res.send();
            }
        }
    ];
}

export function createUpdateTaskDataHandler(db: DatabaseSync) {
    return (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            res.json({});
            console.log(`Adding data to task ${req.params.id}: ${JSON.stringify(req.body.data)}`);
            updateTaskData(db, task.id, req.body.data);
        } else {
            res.status(404);
            res.send();
        }
    };
}

export function createFailTaskHandler(db: DatabaseSync, transitionTracker: TransitionTracker, taskTrackingMiddleware: any) {
    return [
        taskTrackingMiddleware.onTaskFailed,
        (req: any, res: any) => {
            const task = getTask(db, req.params.id, TaskStatus.RUNNING);
            if (task) {
                updateTaskStatus(db, transitionTracker, task.id, TaskStatus.FAILED);

                res.json({});
            } else {
                res.status(404);
                res.send();
            }
        }
    ];
}

export function createCloneTaskHandler(db: DatabaseSync) {
    return async (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            const oldTaskid = task.id;
            task.id = crypto.randomUUID();
            // clone all of the artefacts from the old task
            const dirpath = `./artefacts/tasks/${task.id}`;
            await Deno.mkdir(dirpath, { recursive: true });
            for (const artefact of task.artefacts) {
                await Deno.copyFile(`./artefacts/tasks/${oldTaskid}/${artefact}`, `${dirpath}/${artefact}`);
            }
            addTask(db, task);
            res.json(task);
            res.send();
        } else {
            res.status(404);
            res.send();
        }
    };
}

export function createGetTaskToCompleteHandler(db: DatabaseSync, agentTrackingMiddleware: any) {
    return [
        agentTrackingMiddleware.onAgentConnected,
        (req: any, res: any) => {
            const task = getTaskToComplete(db, req.body.type, req.body.capabilities, TaskStatus.AWAITING);
            if (task) {
                const extension = req.body.type === "python" ? ".py" : ".ts";
                const taskScriptURL = `${req.protocol}://${req.get('host')}/scripts/${task.id}${extension}`;
                res.json({script: taskScriptURL, id: task.id, type: req.body.type})
                return;
            }
            res.json({});
        }
    ];
}

export function createUploadArtefactHandler(db: DatabaseSync) {
    const upload = multer({ dest: './artefacts/' });
    return [
        upload.single('file'),
        async (req: any, res: any) => {
            const task = getTask(db, req.params.id);
            if (task) {
                const dirpath = `./artefacts/tasks/${req.params.id}`;
                await Deno.mkdir(dirpath, { recursive: true });
                await Deno.rename(req.file.path, `${dirpath}/${req.file.originalname}`);
                const artefactURL = `${req.protocol}://${req.get('host')}/tasks/${req.params.id}/artefacts/${req.file.originalname}`;
                updateTaskAddArtefact(db, task.id, req.file.originalname);
                const directURL = `${req.protocol}://${req.get('host')}/artefacts/tasks/${req.params.id}/${req.file.originalname}`
                res.json({url: artefactURL, directURL: directURL });
                res.send();
            } else {
                res.status(400);
                res.send();
                await Deno.remove(req.file.path); // TODO: would it be possible to not even *accept* the file, and bail out earlier in the upload?
            }
        }
    ];
}

export function createGetArtefactHandler(db: DatabaseSync) {
    return (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            res.redirect(307, `/artefacts/tasks/${req.params.id}/${req.params.filename}`);
        } else {
            res.status(404);
            res.send();
        }
    };
}

export function createDeleteArtefactHandler(db: DatabaseSync) {
    return async (req: any, res: any) => {
        const task = getTask(db, req.params.id);
        if (task) {
            const dirpath = `./artefacts/tasks/${req.params.id}`;
            await Deno.remove(`${dirpath}/${req.params.filename}`);
            updateTaskRemoveArtefact(db, task.id, req.params.filename);
            res.status(204);
            res.send();
        } else {
            res.status(404);
            res.send();
        }
    };
}