import test from "node:test";
import assert from "node:assert/strict";
import { taskify } from "../lib/tasks.ts";
import { toPublicTask } from "../lib/task-serialization.ts";

test("toPublicTask removes the lease token without mutating the task", () => {
    const task = taskify("console.log('hello')");
    task.owner = "agent-1";
    task.leaseId = "secret-lease";
    task.leaseExpiresAt = 12345;

    const publicTask = toPublicTask(task);

    assert.equal(Object.hasOwn(publicTask, "leaseId"), false);
    assert.equal(publicTask.owner, "agent-1");
    assert.equal(publicTask.leaseExpiresAt, 12345);
    assert.equal(task.leaseId, "secret-lease");
});
