import test from "node:test";
import assert from "node:assert/strict";
import { addTask, taskify, claimTask, renewLease, reclaimExpiredLeases, completeTaskWithLease, failTaskWithLease, updateTaskDataWithLease, getTask } from "../lib/tasks.ts";
import { TransitionTracker } from "../lib/transitiontracker.ts";
import { TaskStatus } from "../lib/models.ts";
import { createTaskDb } from "./helpers.ts";

function claimedTask(db, now = 1_000) {
    const task = taskify("console.log('hello')");
    task.type = "node";
    addTask(db, task);
    const claim = claimTask(db, new TransitionTracker(), task.id, undefined, {
        now,
        leaseTtlMs: 5_000
    });
    assert.ok(claim);
    return { task, claim };
}

test("renewLease extends the lease for the holder only", () => {
    const db = createTaskDb();
    const { task, claim } = claimedTask(db);

    assert.equal(renewLease(db, task.id, claim.leaseId, 5_000, 2_000), 7_000);
    assert.equal(renewLease(db, task.id, "wrong-lease", 5_000, 2_000), null);
    assert.equal(getTask(db, task.id)?.leaseExpiresAt, 7_000);
});

test("renewLease rejects an already-expired lease", () => {
    const db = createTaskDb();
    const { task, claim } = claimedTask(db);

    assert.equal(renewLease(db, task.id, claim.leaseId, 5_000, 6_000), null);
    assert.equal(getTask(db, task.id)?.leaseExpiresAt, claim.leaseExpiresAt);
});

test("reclaimExpiredLeases requeues an expired task and clears the lease", () => {
    const db = createTaskDb();
    const { task, claim } = claimedTask(db);

    assert.equal(reclaimExpiredLeases(db, new TransitionTracker(), undefined, 5_999), 0);
    assert.equal(reclaimExpiredLeases(db, new TransitionTracker(), undefined, 6_000), 1);

    const stored = getTask(db, task.id);
    assert.equal(stored?.status, TaskStatus.AWAITING);
    assert.equal(stored?.leaseId, null);
    assert.equal(stored?.owner, null);
    assert.equal(stored?.lastRunAt, null);
    assert.equal(stored?.leaseId === claim.leaseId, false);
});

test("a stale lease cannot complete or write data after reclamation", () => {
    const db = createTaskDb();
    const { task, claim } = claimedTask(db);
    reclaimExpiredLeases(db, new TransitionTracker(), undefined, 6_000);

    assert.equal(
        completeTaskWithLease(db, new TransitionTracker(), task.id, claim.leaseId, {}),
        false
    );
    assert.equal(
        updateTaskDataWithLease(db, task.id, { stale: true }, claim.leaseId),
        false
    );
    assert.equal(getTask(db, task.id)?.status, TaskStatus.AWAITING);

    const nextClaim = claimTask(db, new TransitionTracker(), task.id, undefined, {
        now: 7_000,
        leaseTtlMs: 5_000
    });
    assert.ok(nextClaim);
    assert.notEqual(nextClaim.leaseId, claim.leaseId);
    assert.equal(
        completeTaskWithLease(db, new TransitionTracker(), task.id, claim.leaseId, {}),
        false
    );
    assert.equal(
        completeTaskWithLease(db, new TransitionTracker(), task.id, nextClaim.leaseId, {}),
        true
    );
});

test("completeTaskWithLease accepts the current lease and clears it", () => {
    const db = createTaskDb();
    const { task, claim } = claimedTask(db);

    assert.equal(
        completeTaskWithLease(db, new TransitionTracker(), task.id, "wrong-lease", { nope: true }),
        false
    );

    assert.equal(
        completeTaskWithLease(db, new TransitionTracker(), task.id, claim.leaseId, { ok: true }),
        true
    );

    const stored = getTask(db, task.id);
    assert.equal(stored?.status, TaskStatus.COMPLETED);
    assert.deepEqual(stored?.data, { ok: true });
    assert.equal(stored?.leaseId, null);
    assert.equal(stored?.owner, null);
});

test("failTaskWithLease accepts only the current lease", () => {
    const db = createTaskDb();
    const { task, claim } = claimedTask(db);

    assert.equal(failTaskWithLease(db, new TransitionTracker(), task.id, "wrong-lease"), false);
    assert.equal(failTaskWithLease(db, new TransitionTracker(), task.id, claim.leaseId), true);
    assert.equal(getTask(db, task.id)?.status, TaskStatus.FAILED);
});
