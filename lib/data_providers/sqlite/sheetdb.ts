import { DB } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { upsert } from "./lib.ts";

export const SHEETDB_DATA_TABLENAME = "data"; // used for writing
export const SHEETDB_DATA_VIEWNAME = "view"; // used for reading, can be customized by user to hide/alter things if needed

export interface RowInfo {
    cid: number,
    type: "STRING" | "TEXT" | "NUMERIC" | "JSON" | any,
    notnull: 0 | 1,
    dflt_value: any,
    pk: 0 | 1
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
    }

    upsertData(data: [string, unknown][]) {
        upsert(this.db, SHEETDB_DATA_TABLENAME, data);
    }

    getRows() {
        const schemaMap = this.getSchemaAsMap();
        const rowEntries = this.db.queryEntries(`SELECT * FROM "${SHEETDB_DATA_VIEWNAME}"`);
        const rows = rowEntries.map(rowEntry => {
            const returnrow = [];
            Object.entries(rowEntry).forEach(re => {
                if (schemaMap[re[0]].type === "JSON") {
                    try {
                        re[1] = JSON.parse(re[1]);
                    } catch (e) {
                        re[1] = re[1]; // data is actually a string, so return a string
                    }
                }
                returnrow.push(re[1]);
            })
            return returnrow;
        });
        return rows;
    }

    close() {
        this.db.close();
    }

    getSchema() {
        return this.db.queryEntries(`pragma table_info("${SHEETDB_DATA_VIEWNAME}");`);
    }

    getSchemaAsMap() {
        return this.getSchema().reduce((memo: {[key: string]: RowInfo}, value: any) => { // TODO: value should have a typedef corresponding to an obj with keys cid, name, type, notnull, dflt_value and pk
            memo[value.name] = value;
            return memo;
        }, {}) as {[key: string]: RowInfo};
    }
} 