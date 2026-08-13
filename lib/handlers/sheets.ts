import { validateSheetName } from "../sheet_validator.ts";
import { SheetDB } from "../data_providers/sqlite/sheetdb.ts";
import { SheetPermissionsDB } from "../data_providers/sqlite/sheet_permissions.ts";

const PERMISSION_PUT_SHEET_DATA = "putSheetData";

/**
 * Creates a handler that inserts or updates data in a sheet.
 * Validates sheet name and ensures data contains a primary key.
 * @returns {Function} Express route handler function
 */
export function createUpsertSheetDataHandler() {
    return (req: any, res: any) => {
        if (!validateSheetName(req.params.id)) {
            res.status(500);
            res.send("Invalid sheet name");
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(req.body, "key")) {
            res.status(500);
            res.send("Data needs to be JSON with a 'key' property");
            return;
        }

        const sheetdb = new SheetDB(`./sheets/${req.params.id}.db`, false); // TODO: move to a map? what's the performance of this?
        const data = Object.entries(Object.assign({key: req.body.key}, req.body)); // Need to put the primary key first... This is terrible and I guess slow as well, but it works.
        // console.log('Upsert data:', data);
        sheetdb.upsertData(data);
        sheetdb.close();
        res.status(200);
        res.send();
    };
}

/**
 * Creates a handler that deletes a row from a sheet by its primary key.
 * @returns {Function} Express route handler function
 */
export function createDeleteSheetRowHandler() {
    return (req: any, res: any) => {
        if (!validateSheetName(req.params.id)) {
            res.status(500);
            res.send("Invalid sheet name");
            return;
        }

        const sheetdb = new SheetDB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
        sheetdb.deleteRow(req.params.key);
        sheetdb.close();
        res.status(204);
        res.send();
    };
}

/**
 * Creates a handler that retrieves all data from a specific sheet.
 * Returns column schema and row data.
 * @returns {Function} Express route handler function
 */
export function createGetSheetHandler() {
    return (req: any, res: any) => {
        if (!validateSheetName(req.params.id)) {
            res.status(500);
            res.send("Invalid sheet name");
            return;
        }

        let sheetdb;
        try {
            sheetdb = new SheetDB(`./sheets/${req.params.id}.db`); // TODO: move to a map? what's the performance of this?
        } catch (e) {
            if (e.name === 'NotFoundError') {
                res.status(404);
            } else {
                res.status(500);
            }
            res.send();
            return;
        }
        const schema = sheetdb.getSchema();
        const page = parseInt(req.query.page, 10);
        const pageSize = parseInt(req.query.pageSize, 10);
        let rows;
        let total;
        let pageOut;
        let pageSizeOut;
        if (Number.isInteger(page) && page >= 1 && Number.isInteger(pageSize) && pageSize >= 1) {
            pageOut = page;
            pageSizeOut = pageSize;
            rows = sheetdb.getRows(pageSize, (page - 1) * pageSize);
            total = sheetdb.getRowCount();
        } else {
            rows = sheetdb.getRows();
            total = rows.length;
        }
        sheetdb.close();
        res.json({ columns: schema, rows, total, page: pageOut, pageSize: pageSizeOut });
        res.send();
    };
}

/**
 * Creates a handler that lists all available sheets in the system.
 * Anonymous requests only receive sheets with a public read grant.
 * @returns {Function} Express route handler function
 */
export function createListSheetsHandler() {
    return (req: any, res: any) => {
        const all: string[] = [];
        for (const dirEntry of Deno.readDirSync("./sheets/")) {
            if (dirEntry.isFile && dirEntry.name.endsWith(".db")) {
                all.push(dirEntry.name.replace(/\.db$/,""));
            }
        }
        all.sort();

        if (req.user) {
            res.json(all);
            return;
        }

        const perms = new SheetPermissionsDB();
        try {
            const publicSheets = new Set(perms.publicSheets());
            res.json(all.filter(s => publicSheets.has(s)));
        } finally {
            perms.close();
        }
    };
}

/**
 * Creates a handler that returns the current public read grant for a sheet.
 * @returns {Function} Express route handler function
 */
export function createGetSheetPublicHandler() {
    return (req: any, res: any) => {
        if (!validateSheetName(req.params.id)) {
            res.status(500);
            res.send("Invalid sheet name");
            return;
        }
        const perms = new SheetPermissionsDB();
        try {
            res.json({ sheet: req.params.id, public: perms.isPublic(req.params.id) });
        } finally {
            perms.close();
        }
    };
}

/**
 * Creates a handler that sets the public read grant for a sheet at runtime.
 * @returns {Function} Express route handler function
 */
export function createSetSheetPublicHandler() {
    return (req: any, res: any) => {
        if (!validateSheetName(req.params.id)) {
            res.status(500);
            res.send("Invalid sheet name");
            return;
        }
        const value = req.body && req.body.public;
        if (typeof value !== "boolean") {
            res.status(400).json({ error: "public must be a boolean" });
            return;
        }
        const perms = new SheetPermissionsDB();
        try {
            perms.setPublic(req.params.id, value);
            res.json({ sheet: req.params.id, public: perms.isPublic(req.params.id) });
        } finally {
            perms.close();
        }
    };
}