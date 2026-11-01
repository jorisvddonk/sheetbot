import test from "node:test";
import assert from "node:assert/strict";
import { addTask, taskify, claimTask, getTask } from "../lib/tasks.ts";
import { TransitionTracker } from "../lib/transitiontracker.ts";
import { TaskStatus } from "../lib/models.ts";
import { createTaskDb } from "./helpers.ts";

test("claimTask allows exactly one claim of an AWAITING task", () => {
    const db = createTaskDb();
    const task = taskify("console.log('hello')");
    task.type = "node";
    addTask(db, task);

    const tracker = new TransitionTracker();
    const first = claimTask(db, tracker, task.id);
    const second = claimTask(db, tracker, task.id);

    assert.ok(first);
    assert.equal(second, null);
    assert.ok(first.leaseId);
    assert.ok(first.leaseExpiresAt > Date.now());

    const stored = getTask(db, task.id);
    assert.equal(stored?.status, TaskStatus.RUNNING);
    assert.equal(typeof stored?.lastRunAt, "number");
    assert.equal(stored?.leaseId, first.leaseId);
    assert.equal(stored?.leaseExpiresAt, first.leaseExpiresAt);
});

test("claimTask does not claim a task that is not AWAITING", () => {
    const db = createTaskDb();
    const task = taskify("console.log('hello')");
    task.type = "node";
    task.status = TaskStatus.COMPLETED;
    addTask(db, task);

    const tracker = new TransitionTracker();
    assert.equal(claimTask(db, tracker, task.id), null);
    assert.equal(getTask(db, task.id)?.status, TaskStatus.COMPLETED);
});
