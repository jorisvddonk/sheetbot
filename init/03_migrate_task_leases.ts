import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";

const DB_PATH = "tasks.db";

export default function migrateTaskLeases(): void {
    if (!existsSync(DB_PATH)) {
        console.log("Database does not exist, no migration needed.");
        return;
    }

    const db = new DatabaseSync(DB_PATH);
    try {
        const tableInfo = db.prepare("PRAGMA table_info(tasks)").all() as any[];
        const columns = new Set(tableInfo.map(col => col.name));

        for (const column of ["owner", "leaseId", "leaseExpiresAt"]) {
            if (!columns.has(column)) {
                console.log(`Adding tasks.${column} column...`);
                db.exec(`ALTER TABLE tasks ADD COLUMN ${column} ${column === "leaseExpiresAt" ? "INTEGER" : "TEXT"}`);
            }
        }

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tasks_running_lease
            ON tasks(status, leaseExpiresAt)
        `);
        console.log("Task leases schema ready.");
    } finally {
        db.close();
    }
}

if (import.meta.main) {
    migrateTaskLeases();
}
