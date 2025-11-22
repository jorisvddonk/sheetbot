import { initDatabaseTables } from "../lib/db.ts";

export default function runInitDatabase(): void {
    initDatabaseTables();
}

// Run if this file is executed directly
if (import.meta.main) {
    runInitDatabase();
}