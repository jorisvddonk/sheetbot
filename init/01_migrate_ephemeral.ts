import { DatabaseSync } from "node:sqlite";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";

const DB_PATH = "tasks.db";

export default function migrateEphemeralToTransitions(): void {
    if (!existsSync(DB_PATH)) {
        console.log("Database does not exist, no migration needed.");
        return;
    }

    const db = new DatabaseSync(DB_PATH);

    // Check if migration is needed
    const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
    const hasEphemeral = tableInfo.some(col => col.name === "ephemeral");
    const hasTransitions = tableInfo.some(col => col.name === "transitions");

    if (!hasEphemeral) {
        console.log("Database already migrated (no ephemeral column found).");
        return;
    }

    console.log("Migrating database schema...");

    // Add transitions column if it doesn't exist
    if (!hasTransitions) {
        db.exec("ALTER TABLE tasks ADD COLUMN transitions TEXT");
    }

    // Migrate data from ephemeral to transitions
    const tasks = db.prepare("SELECT id, ephemeral FROM tasks WHERE ephemeral IS NOT NULL AND ephemeral != 0").all();

    for (const task of tasks) {
        let transitions = [];
        if (task.ephemeral === 1) { // EPHEMERAL_ON_SUCCESS
            transitions = [{
                statuses: ["COMPLETED"],
                condition: {},
                timing: { immediate: true },
                transitionTo: "DELETED"
            }];
        } else if (task.ephemeral === 2) { // EPHEMERAL_ALWAYS
            transitions = [{
                statuses: ["COMPLETED", "FAILED"],
                condition: {},
                timing: { immediate: true },
                transitionTo: "DELETED"
            }];
        }

        db.prepare("UPDATE tasks SET transitions = ? WHERE id = ?").run(
            JSON.stringify(transitions),
            task.id
        );
    }

    // Remove ephemeral column
    db.exec("ALTER TABLE tasks DROP COLUMN ephemeral");

    console.log(`Migrated ${tasks.length} ephemeral tasks to transitions and updated schema.`);
}

// Run migration if this file is executed directly
if (import.meta.main) {
    migrateEphemeralToTransitions();
}