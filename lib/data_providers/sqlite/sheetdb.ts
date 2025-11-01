import { DatabaseSync } from "node:sqlite";
import { upsert } from "./lib.ts";
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";

export const SHEETDB_DATA_TABLENAME = "data"; // used for writing
export const SHEETDB_DATA_VIEWNAME = "data_view"; // used for reading, can be customized by user to alter data if needed
export const SHEETDB_COLUMNSTRUCTURE_TABLENAME = "columnstructure"; // used to store table column structure metadata, like widgets needed to render them, their order, and whether they're shown or not.
export const SHEETDB_COLUMNSTRUCTURE_VIEWNAME = "columnstructure_view"; // used to read table column structure metadata. This is a view as it also includes data that's from the table_info pragma.


export interface ColumnInfo {
    columnorder: number,
    name: string,
    datatype: "STRING" | "TEXT" | "NUMERIC" | "JSON" | any,
    maxwidth: number,
    maxheight: number,
    [name: string]: any
}

export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

export class SheetDB {
    db: DatabaseSync;
    
    constructor(filepath: string, do_check_filepath?: boolean) {
        if ((do_check_filepath == undefined || do_check_filepath === true) && !existsSync(filepath)) {
            throw new NotFoundError("Sheet does not exist");
        }
        this.db = new DatabaseSync(filepath);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS "${SHEETDB_DATA_TABLENAME}" (
                key TEXT PRIMARY KEY
            )`);
        this.db.exec(`
            CREATE VIEW IF NOT EXISTS "${SHEETDB_DATA_VIEWNAME}" AS SELECT * FROM "${SHEETDB_DATA_TABLENAME}"`);

        const table_exists = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(SHEETDB_COLUMNSTRUCTURE_TABLENAME);
        if (!table_exists) {
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS "${SHEETDB_COLUMNSTRUCTURE_TABLENAME}" (
                    name TEXT PRIMARY KEY,
                    widgettype TEXT,
                    minwidth INTEGER,
                    maxwidth INTEGER,
                    minheight INTEGER,
                    maxheight INTEGER,
                    columnorder INTEGER UNIQUE
                )`);
            this.db.exec(`
                INSERT INTO "${SHEETDB_COLUMNSTRUCTURE_TABLENAME}" (name, widgettype, columnorder) VALUES ('%', 'text', 0)
            `);
        }
        this.db.exec(`
            CREATE VIEW IF NOT EXISTS "${SHEETDB_COLUMNSTRUCTURE_VIEWNAME}" AS 
                SELECT p.name, c.widgettype, c.minwidth, c.maxwidth, c.minheight, c.maxheight, (ROW_NUMBER() OVER(ORDER BY c.columnorder)) - 1 AS columnorder, p.type as 'datatype' from "columnstructure" c JOIN pragma_table_info('data_view') p on p.name LIKE c.name
                ORDER BY c.columnorder ASC`);
    }

    upsertData(data: [string, unknown][]) {
        upsert(this.db, SHEETDB_DATA_TABLENAME, data);
    }

    getRows() {
        const columnsSchema = this.getSchema();
        const stmt = this.db.prepare(`SELECT * FROM "${SHEETDB_DATA_VIEWNAME}"`);
        const rowsRaw = stmt.all();
        const rows = rowsRaw.map(row => {
            const returnrow = [];
            columnsSchema.forEach(columnEntry => {
                const columnData = row[columnEntry.name];
                if (columnEntry.datatype === "JSON") {
                    try {
                        returnrow.push(JSON.parse(columnData));
                    } catch (e) {
                        returnrow.push(columnData); // data is actually a string, so return a string
                    }
                } else {
                    returnrow.push(columnData);
                }
            })
            return returnrow;
        });
        return rows;
    }

    deleteRow(key: string) {
        const stmt = this.db.prepare(`DELETE FROM "${SHEETDB_DATA_TABLENAME}" WHERE key = ?`);
        const result = stmt.run(key);
        return result.changes > 0;
    }

    close() {
        this.db.close();
    }

    getSchema() {
        const stmt = this.db.prepare(`SELECT * FROM "${SHEETDB_COLUMNSTRUCTURE_VIEWNAME}"`);
        return stmt.all() as ColumnInfo[];
    }
} 