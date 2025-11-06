import { DatabaseSync } from "node:sqlite";


const ALLOWED_TABLE_NAME_REGEX = /^[a-zA-Z0-9-_ ]+$/;
const ALLOWED_COLUMN_NAME_REGEX = /^[a-zA-Z0-9-_ .]+$/;

export function validateTableName(tablename: string) {
    return ALLOWED_TABLE_NAME_REGEX.test(tablename);
}

function validateColumns(columns) {
    for (let c of columns) {
        if (ALLOWED_COLUMN_NAME_REGEX.test(c) === false) {
            throw new Error("Invalid column name specified");
        }
    }
    return columns;
}
function columnize(columns) {
    validateColumns(columns);
    return `(${columns.map(c => `"${c}"`).join(", ")})`;
}
function settize(columns) {
    // Converts a list of column names into a parameterized SET string, e.g. "foo"=?, "bar"=?, "quux pie"=?
    validateColumns(columns);
    return `${columns.map(c => `"${c}"=?`).join(", ")}`;
}
function questionmark_valuesize(columns) {
    return `(${columns.map(c => `?`).join(", ")})`;
}

function inferType(value) {
    if (typeof value === "string") {
        return "TEXT";
    } else if (typeof value === "object") {
        return "JSON"
    } else if (typeof value === "number") {
        return "NUMERIC"
    } else if (typeof value === "boolean") {
        return "JSON"
    }
}

export function upsert(db: DatabaseSync, tablename: string, data: [string, unknown][], allow_create_column?: boolean) {
    if (allow_create_column === undefined) {
        allow_create_column = true;
    }
    // data: array of 2-length arrays, with the first item being the column name, and the second being the value.
    if (validateTableName(tablename) === false) {
        throw new Error("Invalid table name specified");
    }
    const columns = validateColumns(data.map(d => d[0]));
    const values = data.map(d => {
        if(typeof d[1] === "object") {
            return JSON.stringify(d[1]);
        } else if (typeof d[1] === "boolean") {
            return JSON.stringify(d[1]);
        } else {
            return d[1];
        }
    });
    if (allow_create_column) {
        const existingColumns = db.prepare(`PRAGMA table_info("${tablename}")`).all().map((row: any) => row.name);
        const missingColumns = columns.filter(c => !existingColumns.includes(c));
        for (const col of missingColumns) {
            const data_element = data.find(d => d[0] === col);
            if (data_element === undefined) {
                throw new Error("Could not add/fix column!");
            }
            const alter_sql = `ALTER TABLE "${tablename}" ADD "${col}" ${inferType(data_element[1])}`;
            db.prepare(alter_sql).run();
        }
    }
    const sql = `INSERT INTO "${tablename}" ${columnize(columns)} VALUES ${questionmark_valuesize(columns)} ON CONFLICT(key) DO UPDATE SET ${settize(columns.slice(1))}`;
    const vals = values.concat(values.slice(1));
    const stmt = db.prepare(sql);
    const result = stmt.run(...vals);
    return result;
}