import { DatabaseSync } from "node:sqlite";

export function createTaskDb(): DatabaseSync {
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
            lastRunAt INTEGER,
            owner TEXT,
            leaseId TEXT,
            leaseExpiresAt INTEGER
        )
    `);
    return db;
}
