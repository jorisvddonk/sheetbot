import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { upsert } from "./lib.ts";

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
    [name: string]: string | string[]
}

export class SheetDB {
    db: DB;
    
    constructor(filepath: string) {
        this.db = new DB(filepath);
        this.db.execute(`
            CREATE TABLE IF NOT EXISTS "${SHEETDB_DATA_TABLENAME}" (
                key STRING PRIMARY KEY
            )`);
        this.db.execute(`
            CREATE VIEW IF NOT EXISTS "${SHEETDB_DATA_VIEWNAME}" AS SELECT * FROM "${SHEETDB_DATA_TABLENAME}"`);

        this.db.execute(`
            CREATE TABLE IF NOT EXISTS "${SHEETDB_COLUMNSTRUCTURE_TABLENAME}" (
                name STRING PRIMARY KEY,
                widgettype STRING,
                minwidth NUMERIC,
                maxwidth NUMERIC,
                minheight NUMERIC,
                maxheight NUMERIC,
                columnorder NUMERIC UNIQUE
            )`);
            this.db.execute(`
            CREATE VIEW IF NOT EXISTS "${SHEETDB_COLUMNSTRUCTURE_VIEWNAME}" AS 
                SELECT p.name, c.widgettype, c.minwidth, c.maxwidth, c.minheight, c.maxheight, (ROW_NUMBER() OVER(ORDER BY c.columnorder)) - 1 AS columnorder, p.type as 'datatype' from "columnstructure" c JOIN pragma_table_info('data_view') p on p.name LIKE c.name
                ORDER BY c.columnorder ASC`);
    }

    upsertData(data: [string, unknown][]) {
        upsert(this.db, SHEETDB_DATA_TABLENAME, data);
    }

    getRows() {
        const columnsSchema = this.getSchema();
        const rowsRaw = this.db.queryEntries(`SELECT * FROM "${SHEETDB_DATA_VIEWNAME}"`);
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
        const rows = this.db.query(`DELETE FROM "${SHEETDB_DATA_TABLENAME}" WHERE key = :key`, {key: key});
        if (rows.length === 0) {
            return true;
        } else {
            return false; // ???
        }
    }

    close() {
        this.db.close();
    }

    getSchema() {
        return this.db.queryEntries<ColumnInfo>(`SELECT * FROM "${SHEETDB_COLUMNSTRUCTURE_VIEWNAME}"`);
    }
} 