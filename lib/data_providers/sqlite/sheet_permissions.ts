import { DatabaseSync } from "node:sqlite";

export const SHEET_GRANTS_TABLENAME = "sheet_grants";
export const SHEET_PERMISSIONS_FILEPATH = "./sheet_permissions.db";
export const PUBLIC_GRANTEE = "public";
export const READ_PERMISSION = "read";

/**
 * Runtime-changeable sheet access grants.
 *
 * Grant rows are consulted per-request, so toggling public access takes
 * effect immediately without a server restart.
 */
export class SheetPermissionsDB {
    db: DatabaseSync;

    constructor(filepath: string = SHEET_PERMISSIONS_FILEPATH) {
        this.db = new DatabaseSync(filepath);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS "${SHEET_GRANTS_TABLENAME}" (
                sheet TEXT NOT NULL,
                permission TEXT NOT NULL,
                grantee TEXT NOT NULL,
                PRIMARY KEY (sheet, permission, grantee)
            )`);
    }

    /** True when the sheet is readable by anonymous users. */
    isPublic(sheet: string): boolean {
        const stmt = this.db.prepare(
            `SELECT 1 FROM "${SHEET_GRANTS_TABLENAME}" WHERE sheet = ? AND permission = ? AND grantee = ?`,
        );
        return stmt.get(sheet, READ_PERMISSION, PUBLIC_GRANTEE) !== undefined;
    }

    /** Set (or clear) anonymous read access for a sheet. */
    setPublic(sheet: string, value: boolean): void {
        if (value) {
            const stmt = this.db.prepare(
                `INSERT OR IGNORE INTO "${SHEET_GRANTS_TABLENAME}" (sheet, permission, grantee) VALUES (?, ?, ?)`,
            );
            stmt.run(sheet, READ_PERMISSION, PUBLIC_GRANTEE);
        } else {
            const stmt = this.db.prepare(
                `DELETE FROM "${SHEET_GRANTS_TABLENAME}" WHERE sheet = ? AND permission = ? AND grantee = ?`,
            );
            stmt.run(sheet, READ_PERMISSION, PUBLIC_GRANTEE);
        }
    }

    /** Names of all sheets with anonymous read access. */
    publicSheets(): string[] {
        const stmt = this.db.prepare(
            `SELECT sheet FROM "${SHEET_GRANTS_TABLENAME}" WHERE permission = ? AND grantee = ? ORDER BY sheet`,
        );
        return stmt.all(READ_PERMISSION, PUBLIC_GRANTEE).map((r: any) => String(r.sheet));
    }

    close() {
        this.db.close();
    }
}
