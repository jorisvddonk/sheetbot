import { DatabaseSync } from "node:sqlite";
import { TransitionTracker } from "./transitiontracker.ts";
import { processScheduledTransitions } from "./tasks.ts";

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
            capabilitiesSchema TEXT
        )
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

export function startTransitionWorker(db: DatabaseSync, transitionTracker: TransitionTracker) {
    // Start background worker for transitions
    setInterval(() => processScheduledTransitions(db, transitionTracker), 1000); // Check every second
}