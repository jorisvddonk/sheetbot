import { SheetPermissionsDB } from "./lib/data_providers/sqlite/sheet_permissions.ts";

const sheet = Deno.args[0];
const value = Deno.args[1];

if (!sheet || (value !== "true" && value !== "false")) {
    console.error("Usage: deno run --allow-all set-sheet-public.ts <sheet> <true|false>");
    Deno.exit(1);
}

const db = new SheetPermissionsDB();
try {
    db.setPublic(sheet, value === "true");
    console.log(`${sheet}: public=${db.isPublic(sheet)}`);
} finally {
    db.close();
}
