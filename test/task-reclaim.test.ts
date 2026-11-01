import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { addTask, taskify, claimTask, getTask, reclaimStaleRunningTasks } from "../lib/tasks.ts";
import { TransitionTracker } from "../lib/transitiontracker.ts";
import { TaskStatus } from "../lib/models.ts";

function createTaskDb(): DatabaseSync {
    const db = new DatabaseSync(":memory:");
    db.exec(`
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            name TEXT,
            script TEXT,
            status INTEGER,
            data TEXT,
            artefacts TEXT,
            dependsOn TEXT,
            transitions TEXT,
            type TEXT NOT NULL,
            capabilitiesSchema TEXT,
            lastRunAt INTEGER
        )
    `);
    return db;
}

function addClaimedTask(db: DatabaseSync): string {
    const task = taskify("console.log('hello')");
    task.type = "node";
    addTask(db, task);
    assert.equal(claimTask(db, new TransitionTracker(), task.id), true);
    return task.id;
}

test("reclaimStaleRunningTasks requeues an old RUNNING task", () => {
    const db = createTaskDb();
    const taskId = addClaimedTask(db);
    const oldRunAt = Date.now() - 60_000;
    db.prepare("UPDATE tasks SET lastRunAt = ? WHERE id = ?").run(oldRunAt, taskId);

    const reclaimed = reclaimStaleRunningTasks(
        db,
        new TransitionTracker(),
        undefined,
        30_000,
        Date.now()
    );

    assert.equal(reclaimed, 1);
    const task = getTask(db, taskId);
    assert.equal(task?.status, TaskStatus.AWAITING);
    assert.equal(task?.lastRunAt, null);
});

test("reclaimStaleRunningTasks leaves a fresh RUNNING task alone", () => {
    const db = createTaskDb();
    const taskId = addClaimedTask(db);

    const reclaimed = reclaimStaleRunningTasks(
        db,
        new TransitionTracker(),
        undefined,
        30_000,
        Date.now()
    );

    assert.equal(reclaimed, 0);
    assert.equal(getTask(db, taskId)?.status, TaskStatus.RUNNING);
});
