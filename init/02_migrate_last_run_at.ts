import { DatabaseSync } from "node:sqlite";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";

const DB_PATH = "tasks.db";

export default function migrateLastRunAt(): void {
    if (!existsSync(DB_PATH)) {
        console.log("Database does not exist, no migration needed.");
        return;
    }

    const db = new DatabaseSync(DB_PATH);

    const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
    const hasLastRunAt = tableInfo.some(col => col.name === "lastRunAt");

    if (hasLastRunAt) {
        console.log("Database already migrated (lastRunAt column present).");
        db.close();
        return;
    }

    console.log("Migrating database schema: adding lastRunAt column...");
    db.exec("ALTER TABLE tasks ADD COLUMN lastRunAt INTEGER");
    console.log("Added lastRunAt column to tasks.");

    db.close();
}

// Run migration if this file is executed directly
if (import.meta.main) {
    migrateLastRunAt();
}
