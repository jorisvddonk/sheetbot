import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { addTask, taskify, claimTask, getTask } from "../lib/tasks.ts";
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

test("claimTask allows exactly one claim of an AWAITING task", () => {
    const db = createTaskDb();
    const task = taskify("console.log('hello')");
    task.type = "node";
    addTask(db, task);

    const tracker = new TransitionTracker();
    assert.equal(claimTask(db, tracker, task.id), true);
    assert.equal(claimTask(db, tracker, task.id), false);

    const stored = getTask(db, task.id);
    assert.equal(stored?.status, TaskStatus.RUNNING);
    assert.equal(typeof stored?.lastRunAt, "number");
});

test("claimTask does not claim a task that is not AWAITING", () => {
    const db = createTaskDb();
    const task = taskify("console.log('hello')");
    task.type = "node";
    task.status = TaskStatus.COMPLETED;
    addTask(db, task);

    const tracker = new TransitionTracker();
    assert.equal(claimTask(db, tracker, task.id), false);
    assert.equal(getTask(db, task.id)?.status, TaskStatus.COMPLETED);
});
