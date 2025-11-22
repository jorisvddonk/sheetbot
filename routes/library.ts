import express from "npm:express@4.18.3";
import { requiresLogin } from "../lib/auth.ts";

export function setupLibraryRoutes(app: express.Application) {
    app.get("/library", requiresLogin, (req, res) => {
        const scriptFiles = Array.from(Deno.readDirSync("./scripts/").filter(x => (x.name.endsWith(".ts") || x.name.endsWith(".js") || x.name.endsWith(".py")) && !x.name.includes(".template.")));
        const library = scriptFiles.map(file => {
            const scriptText = new TextDecoder().decode(Deno.readFileSync(`./scripts/${file.name}`));
            let capabilitiesSchema = {};
            if (scriptText.includes("<capabilitiesSchema>")) {
                try {
                    let capabilitiesText = scriptText.substring(scriptText.indexOf("<capabilitiesSchema>") + 20, scriptText.indexOf("</capabilitiesSchema>"));
                    capabilitiesText = capabilitiesText.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                    capabilitiesSchema = JSON.parse(capabilitiesText);
                } catch (e) {
                    // ignore
                }
            }
            let suggestedData = {};
            if (scriptText.includes("<data>")) {
                try {
                    let dataText = scriptText.substring(scriptText.indexOf("<data>") + 6, scriptText.indexOf("</data>"));
                    dataText = dataText.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                    suggestedData = JSON.parse(dataText);
                } catch (e) {
                    // ignore
                }
            }
            let name = "";
            if (scriptText.includes("<name>")) {
                try {
                    name = scriptText.substring(scriptText.indexOf("<name>") + 6, scriptText.indexOf("</name>"));
                } catch (e) {
                    // ignore
                }
            }
            let comments = "";
            if (scriptText.includes("<addTaskComments>")) {
                try {
                    comments = scriptText.substring(scriptText.indexOf("<addTaskComments>") + 17, scriptText.indexOf("</addTaskComments>"));
                } catch (e) {
                    // ignore
                }
            }
            return {
                filename: file.name,
                name,
                capabilitiesSchema,
                suggestedData,
                comments
            };
        });
        res.json(library);
    });
}