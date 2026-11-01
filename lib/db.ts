import { DatabaseSync } from "node:sqlite";
import { TransitionTracker } from "./transitiontracker.ts";
import { TaskEventEmitter } from "./task-events.ts";
import { processScheduledTransitions, reclaimStaleRunningTasks, reclaimExpiredLeases, parseDuration } from "./tasks.ts";

export function openDatabase(): DatabaseSync {
    const db = new DatabaseSync("tasks.db");
    return db;
}

export function initDatabaseTables(): void {
    const db = new DatabaseSync("tasks.db");
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
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
            lastRunAt INTEGER,
            owner TEXT,
            leaseId TEXT,
            leaseExpiresAt INTEGER
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_tasks_running_lease ON tasks(status, leaseExpiresAt)
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS transitions_schedule (
            task_id TEXT NOT NULL,
            transition_index INTEGER NOT NULL,
            scheduled_at INTEGER NOT NULL,
            PRIMARY KEY (task_id, transition_index),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transitions_schedule_scheduled_at ON transitions_schedule(scheduled_at)
    `);

    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_transitions_schedule_task_status ON transitions_schedule(task_id)
    `);

    db.close();
    console.log("Database tables initialized.");
}

export function startTransitionWorker(db: DatabaseSync, transitionTracker: TransitionTracker, taskEventEmitter?: TaskEventEmitter) {
    const staleTimeoutEnv = Deno.env.get("SHEETBOT_STALE_RUNNING_TIMEOUT");
    const staleTimeoutMs = staleTimeoutEnv === undefined
        ? 6 * 60 * 60 * 1000
        : parseDuration(staleTimeoutEnv);

    // Start background worker for transitions and stale-running recovery.
    setInterval(() => {
        processScheduledTransitions(db, transitionTracker, taskEventEmitter);
        reclaimExpiredLeases(db, transitionTracker, taskEventEmitter);
        reclaimStaleRunningTasks(db, transitionTracker, taskEventEmitter, staleTimeoutMs);
    }, 1000);
}