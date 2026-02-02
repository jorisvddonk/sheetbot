import { getLibraryScripts } from "../library-util.ts";

/**
 * Creates a handler that retrieves the library of available scripts/templates.
 * Parses script files to extract metadata like capabilities, suggested data, and comments.
 * @returns {Function} Express route handler function
 */
export function createGetLibraryHandler() {
    return (req: any, res: any) => {
        // Get scripts from both scripts/ (templates) and library/ (automation) directories
        const scriptFiles = [
            ...Array.from(Deno.readDirSync("./scripts/").filter(x => (x.name.endsWith(".ts") || x.name.endsWith(".js") || x.name.endsWith(".py") || x.name.endsWith(".sh")) && !x.name.includes(".template."))).map(x => ({ name: x.name, path: "./scripts/" })),
            ...Array.from(getLibraryScripts())
        ];
        const library = scriptFiles.map(file => {
            const scriptText = new TextDecoder().decode(Deno.readFileSync(`${file.path}${file.name}`));
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
            let transitions = [];
            if (scriptText.includes("<transitions>")) {
                try {
                    let transitionsText = scriptText.substring(scriptText.indexOf("<transitions>") + 13, scriptText.indexOf("</transitions>"));
                    transitionsText = transitionsText.split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
                    transitions = JSON.parse(transitionsText);
                } catch (e) {
                    // ignore
                }
            }
            return {
                filename: file.name,
                name,
                capabilitiesSchema,
                suggestedData,
                comments,
                transitions
            };
        });
        res.json(library);
    };
}