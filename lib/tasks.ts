import { DatabaseSync } from "node:sqlite";
import Ajv from "npm:ajv@8.17.1";
import { Task, Transition, TaskStatus, statusToString, stringToStatus } from "./models.ts";
import { TransitionTracker } from "./transitiontracker.ts";
import { TaskEventEmitter } from "./task-events.ts";

const ajv = new (Ajv as any)();

export function taskify(script: string): Task {
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

export function addTask(db: DatabaseSync, task: Task, eventEmitter?: TaskEventEmitter) {
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
    eventEmitter?.emitTaskAdded(task);
}

export function parseOneSQLTask(obj: any): Task | undefined {
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

export function parseAllSQLTasks(array: any[]): Task[] {
    if (array !== undefined) {
        return array.map(a => parseOneSQLTask(a)).filter(t => t !== undefined) as Task[];
    }
    return [];
}

export function getTaskToComplete(db: DatabaseSync, type: string, capabilities?: object, filter_by_status?: TaskStatus): Task | undefined {
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
        if (!task) continue;
        // Check if all dependencies are completed
        let depsCompleted = true;
        for (const depId of task.dependsOn) {
            const depTask = getTask(db, depId);
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
    return undefined;
}

export function getTasks(db: DatabaseSync, filter_by_status?: TaskStatus): Task[] {
    if (filter_by_status === undefined) {
        const stmt = db.prepare("SELECT * FROM tasks");
        return parseAllSQLTasks(stmt.all());
    } else {
        const stmt = db.prepare("SELECT * FROM tasks WHERE status = ?");
        return parseAllSQLTasks(stmt.all(filter_by_status));
    }
}

export function getTask(db: DatabaseSync, taskId: string, filter_by_status?: TaskStatus): Task | undefined {
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

export function checkTransitions(db: DatabaseSync, transitionTracker: TransitionTracker, task: Task, eventEmitter?: TaskEventEmitter) {
    console.log(`[DEBUG] Checking transitions for task ${task.id}, status ${task.status}`);
    const currentStatusStr = statusToString(task.status);

    // Handle immediate transitions (first-match)
    const transition = evaluateTransitions(transitionTracker, task);
    if (transition && transition.timing.immediate) {
        console.log(`[DEBUG] Executing immediate transition: ${JSON.stringify(transition)}`);
        executeTransition(db, transitionTracker, task, transition, eventEmitter);
    }

    // Schedule all transitions with every that match the current status
    for (const trans of task.transitions) {
        if (trans.statuses.includes(currentStatusStr) && trans.timing.every) {
            console.log(`[DEBUG] Scheduling transition: ${JSON.stringify(trans)}`);
            scheduleTransition(db, task, trans);
        }
    }
}

export function updateTaskStatus(db: DatabaseSync, transitionTracker: TransitionTracker, taskId: string, status: TaskStatus, eventEmitter?: TaskEventEmitter) {
    const task = getTask(db, taskId);
    const oldStatus = task?.status;
    
    const stmt = db.prepare("UPDATE tasks SET status = ? WHERE id = ?");
    stmt.run(status, taskId);

    if (oldStatus !== undefined && oldStatus !== status) {
        eventEmitter?.emitTaskStatusChanged(taskId, oldStatus, status);
    }

    // Check for transitions
    const updatedTask = getTask(db, taskId);
    if (updatedTask) {
        updatedTask.status = status; // Update the task object
        eventEmitter?.emitTaskChanged(updatedTask, { status });
        checkTransitions(db, transitionTracker, updatedTask, eventEmitter);
    }
}

export function deleteTask(db: DatabaseSync, taskId: string, eventEmitter?: TaskEventEmitter) {
    const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
    stmt.run(taskId);
    eventEmitter?.emitTaskDeleted(taskId);
}

export function updateTaskData(db: DatabaseSync, taskId: string, data: Record<string, unknown>, eventEmitter?: TaskEventEmitter) {
    const currentTask = getTask(db, taskId);
    if (currentTask) {
        const updatedData = { ...currentTask.data, ...data };
        const stmt = db.prepare("UPDATE tasks SET data = ? WHERE id = ?");
        stmt.run(JSON.stringify(updatedData), taskId);
        currentTask.data = updatedData;
        eventEmitter?.emitTaskChanged(currentTask, { data });
    }
}

export function updateTaskAddArtefact(db: DatabaseSync, taskId: string, newArtefact: string, eventEmitter?: TaskEventEmitter) {
    const task = getTask(db, taskId);
    if (task !== undefined) {
        const artefacts = Array.from(new Set(task.artefacts.concat(newArtefact)));
        const stmt = db.prepare("UPDATE tasks SET artefacts = ? WHERE id = ?");
        stmt.run(JSON.stringify(artefacts), taskId);
        task.artefacts = artefacts;
        eventEmitter?.emitTaskChanged(task, { artefacts });
    }
}

export function updateTaskRemoveArtefact(db: DatabaseSync, taskId: string, artefact: string, eventEmitter?: TaskEventEmitter) {
    const task = getTask(db, taskId);
    if (task !== undefined) {
        const artefacts = Array.from(task.artefacts.filter(x => x !== artefact));
        const stmt = db.prepare("UPDATE tasks SET artefacts = ? WHERE id = ?");
        stmt.run(JSON.stringify(artefacts), taskId);
        task.artefacts = artefacts;
        eventEmitter?.emitTaskChanged(task, { artefacts });
    }
}

export function getAllTasksThatDependOn(db: DatabaseSync, taskId: string): Task[] {
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

export function removeTaskFromAllDependsOn(db: DatabaseSync, taskId: string) {
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

export function evaluateTransitions(transitionTracker: TransitionTracker, task: Task): Transition | null {
    const startTime = performance.now();
    const currentStatusStr = statusToString(task.status);
    for (const transition of task.transitions) {
        if (transition.statuses.includes(currentStatusStr)) {
            // Validate condition against task
            const taskForValidation = { ...task };
            const validate = ajv.compile(transition.condition);
            if (validate(taskForValidation)) {
                const endTime = performance.now();
                const evaluationTimeMs = endTime - startTime;
                transitionTracker.recordEvaluation({
                    taskId: task.id,
                    transitionIndex: task.transitions.indexOf(transition),
                    evaluationTimeMs,
                    successful: true,
                    transitionTo: transition.transitionTo
                });
                return transition;
            }
        }
    }
    const endTime = performance.now();
    const evaluationTimeMs = endTime - startTime;
    // Record failed evaluation (no transition found)
    transitionTracker.recordEvaluation({
        taskId: task.id,
        transitionIndex: -1, // No specific transition
        evaluationTimeMs,
        successful: false,
        transitionTo: ""
    });
    return null;
}

export function executeTransition(db: DatabaseSync, transitionTracker: TransitionTracker, task: Task, transition: Transition, eventEmitter?: TaskEventEmitter) {
    // Apply data mutations if any
    if (transition.dataMutations) {
        const mergedData = { ...task.data, ...transition.dataMutations };
        updateTaskData(db, task.id, mergedData, eventEmitter);
        task.data = mergedData;
    }

    // Special handling for DELETED
    if (transition.transitionTo === "DELETED") {
        removeTaskFromAllDependsOn(db, task.id);
        deleteTask(db, task.id, eventEmitter);
    } else {
        // Update status
        updateTaskStatus(db, transitionTracker, task.id, stringToStatus(transition.transitionTo), eventEmitter);
    }
}

export function scheduleTransition(db: DatabaseSync, task: Task, transition: Transition) {
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

export function parseDuration(duration: string): number {
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

export function processScheduledTransitions(db: DatabaseSync, transitionTracker: TransitionTracker, eventEmitter?: TaskEventEmitter) {
    const now = Math.floor(Date.now() / 1000);
    //console.log(`[DEBUG] Checking scheduled transitions at ${now}`);
    const stmt = db.prepare(`
        SELECT ts.*, t.* FROM transitions_schedule ts
        JOIN tasks t ON ts.task_id = t.id
        WHERE ts.scheduled_at <= ?
        ORDER BY ts.scheduled_at ASC
    `);
    const results = stmt.all(now);
    if (results.length > 0) {
        console.log(`[DEBUG] Found ${results.length} scheduled transitions`);
    }

    for (const result of results) {
        const task = parseOneSQLTask(result);
        if (!task) continue;
        const transitionIndex = Number(result.transition_index);
        const transition = task.transitions[transitionIndex];
        console.log(`[DEBUG] Processing task ${task.id}, transition ${transitionIndex}, status ${task.status}`);

        if (transition) {
            console.log(`[DEBUG] Transition: ${JSON.stringify(transition)}`);
            // Re-evaluate condition
            const currentTransition = evaluateTransitions(transitionTracker, task);
            if (currentTransition === transition) {
                console.log(`[DEBUG] Executing transition to ${transition.transitionTo}`);
                // Execute transition
                executeTransition(db, transitionTracker, task, transition, eventEmitter);

                // Remove from schedule
                const deleteStmt = db.prepare(`
                    DELETE FROM transitions_schedule WHERE task_id = ? AND transition_index = ?
                `);
                deleteStmt.run(task.id, transitionIndex);

                // Re-schedule if every is set and not deleting the task
                if (transition.timing.every && transition.transitionTo !== "DELETED") {
                    console.log(`[DEBUG] Re-scheduling transition`);
                    scheduleTransition(db, task, transition);
                }
            } else {
                console.log(`[DEBUG] Condition not met, checking if still active`);
                const currentStatusStr = statusToString(task.status);
                if (transition.statuses.includes(currentStatusStr)) {
                    console.log(`[DEBUG] Re-scheduling transition`);
                    scheduleTransition(db, task, transition);
                } else {
                    console.log(`[DEBUG] Status no longer matches, removing from schedule`);
                    const deleteStmt = db.prepare(`
                        DELETE FROM transitions_schedule WHERE task_id = ? AND transition_index = ?
                    `);
                    deleteStmt.run(task.id, transitionIndex);
                }
            }
        } else {
            console.log(`[DEBUG] Transition not found at index ${transitionIndex}`);
        }
    }
}