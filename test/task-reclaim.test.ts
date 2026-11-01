import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { addTask, taskify, claimTask, getTask, reclaimStaleRunningTasks } from "../lib/tasks.ts";
import { TransitionTracker } from "../lib/transitiontracker.ts";
import { TaskStatus } from "../lib/models.ts";
import { createTaskDb } from "./helpers.ts";

function addClaimedTask(db: DatabaseSync): string {
    const task = taskify("console.log('hello')");
    task.type = "node";
    addTask(db, task);
    assert.ok(claimTask(db, new TransitionTracker(), task.id));
    return task.id;
}

test("reclaimStaleRunningTasks requeues an old RUNNING task without a lease", () => {
    const db = createTaskDb();
    const taskId = addClaimedTask(db);
    const oldRunAt = Date.now() - 60_000;
    db.prepare("UPDATE tasks SET lastRunAt = ?, leaseId = NULL, leaseExpiresAt = NULL WHERE id = ?").run(oldRunAt, taskId);

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
    assert.equal(task?.leaseId, null);
});

test("reclaimStaleRunningTasks leaves a leased RUNNING task alone", () => {
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

    assert.equal(reclaimed, 0);
    assert.equal(getTask(db, taskId)?.status, TaskStatus.RUNNING);
});
