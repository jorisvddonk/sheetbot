import { validateSheetName } from "../sheet_validator.ts";
import { SheetDB } from "../data_providers/sqlite/sheetdb.ts";

const PERMISSION_PUT_SHEET_DATA = "putSheetData";

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
        const rows = sheetdb.getRows();
        sheetdb.close();
        res.json({columns: schema, rows});
        res.send();
    };
}

export function createListSheetsHandler() {
    return (req: any, res: any) => {
        const retval = [];
        for (const dirEntry of Deno.readDirSync("./sheets/")) {
            if (dirEntry.isFile && dirEntry.name.endsWith(".db")) {
                retval.push(dirEntry.name.replace(/\.db$/,""));
            }
        }

        res.json(retval);
    };
}