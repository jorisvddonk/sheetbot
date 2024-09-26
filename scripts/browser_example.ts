import { getData, uploadArtefact } from "./lib/taskutil.ts";
import { addSheetData } from "./lib/sheetutil.ts";
import { launch } from "https://deno.land/x/astral/mod.ts";

/*
Suggested capabilitiesSchema for this task: <capabilitiesSchema>

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {},
  "required": []
}

</capabilitiesSchema>*/

/* Suggested data for this task: <data>
{
  "url": "https://example.com"
}
</data>*/

async function upload(sheet, sheet_key, files: { [key: string]: Uint8Array }) {
    let values = await Promise.all(Object.entries(files).map(async fileEntry => {
        console.log("uploading", fileEntry[0]);
        const artefactData = await uploadArtefact(fileEntry[0], fileEntry[1]);
        return {
            name: fileEntry[0],
            url: artefactData.directURL
        }
    }));
    const data = values.reduce((memo, val) => {
        memo[val.name] = val.url;
        return memo;
    }, { key: sheet_key })
    return await addSheetData(sheet, data);
};


const taskData = await getData();
let sheet_key = undefined;
if (taskData.sheet_key !== undefined) {
  sheet_key = taskData.sheet_key;
} else {
  sheet_key = new Date().toISOString();
}
const sheet = taskData.sheet !== undefined ? taskData.sheet : 'browser-example';

const url = taskData.url || "https://example.com";

const browser = await launch({headless: true, product: 'chrome', args: ["--no-sandbox"]});
const page = await browser.newPage(url);
const screenshot = await page.screenshot();
await upload(sheet, sheet_key, {"screenshot.png": screenshot});
await addSheetData(sheet, {key: sheet_key, url});
await browser.close();
