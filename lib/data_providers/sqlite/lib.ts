import { DB } from "https://deno.land/x/sqlite/mod.ts";


const ALLOWED_TABLE_NAME_REGEX = /^[a-zA-Z0-9-_ ]+$/;
const ALLOWED_COLUMN_NAME_REGEX = /^[a-zA-Z0-9-_ ]+$/;

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

export function upsert(db: DB, tablename: string, data: [string, unknown][], allow_create_column?: boolean) {
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
    const sql = `INSERT INTO "${tablename}" ${columnize(columns)} VALUES ${questionmark_valuesize(columns)} ON CONFLICT DO UPDATE SET ${settize(columns.slice(1))}`;
    try {
        const vals = values.concat(values.slice(1));
        const rows = db.query(sql, vals);
        return rows;
    } catch (e) {
        if (allow_create_column) {
            const needle = "has no column named ";
            const index = e.toString().indexOf(needle);
            if (index > -1) { // TODO: use a proper regex here, or some other way to detect this error? Could be malicious or buggy use here if someone specifies a column named "has no column named"...
                // need to add the column!
                // TODO: add support for when *multiple* columns are missing?
                const column_name = e.toString().substr(index + needle.length);
                const data_element = data.filter(d => d[0] === column_name).shift();
                if (data_element === undefined) {
                    throw new Error("Could not add/fix column!");
                }
                const alter_sql = `ALTER TABLE "${tablename}" ADD "${column_name}" ${inferType(data_element[1])}`;
                db.query(alter_sql);
                upsert(db, tablename, data, false);
            }
        } else {
            throw e;
        }
    }
}