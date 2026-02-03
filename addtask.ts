import { promptSecret } from "https://deno.land/std@0.220.1/cli/prompt_secret.ts";
import { checkError } from "./scripts/lib/commonutil.ts";
import { getScript, addTask } from "./scripts/lib/taskutil.ts";
import { Select, Input } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/mod.ts";
import { getLibraryScripts } from "./lib/library-util.ts";

const script: string = await Select.prompt({
    message: "Pick a script",
    search: true,
    options: Array.from(getLibraryScripts()).map(x => x.name)
});

console.log("Adding task, please login first (using SHEETBOT_AUTH_* env variables if present)");
let loginBody: any;
if (Deno.env.get("SHEETBOT_AUTH_APIKEY")) {
    loginBody = { apiKey: Deno.env.get("SHEETBOT_AUTH_APIKEY") };
} else {
    const username = Deno.env.get("SHEETBOT_AUTH_USER") || prompt("username");
    const password = Deno.env.get("SHEETBOT_AUTH_PASS") || promptSecret("password");
    loginBody = { username, password };
}
const baseurl = Deno.env.get("SHEETBOT_BASEURL") || prompt("base URL", "http://127.0.0.1:3000");

const token = await fetch(`${baseurl}/login`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(loginBody)
}).then(checkError).then(res => res.json()).then(json => json.token);

Deno.env.set("SHEETBOT_AUTHORIZATION_HEADER", `Bearer ${token}`);
Deno.env.set("SHEETBOT_BASEURL", baseurl);

const localOrRemote: number = await Select.prompt({
    message: "Use local script, or fetch script from remote server?",
    search: false,
    options: [
        {
            name: "local",
            value: 0
        },
        {
            name: "remote",
            value: 1
        }
    ],
});
let scriptStuff;
if (localOrRemote === 1) {
    scriptStuff = await getScript(`/library/${script}`);
} else {
    const scriptEntry = Array.from(getLibraryScripts()).find(x => x.name === script);
    if (!scriptEntry) {
        throw new Error(`Script ${script} not found`);
    }
    const scriptText = new TextDecoder().decode(Deno.readFileSync(`${scriptEntry.path}${script}`));
    let capabilitiesSchema = {};
    try {
        const start = scriptText.indexOf("<capabilitiesSchema>");
        const end = scriptText.indexOf("</capabilitiesSchema>");
        if (start !== -1 && end !== -1 && end > start) {
            let capabilitiesText = scriptText.substr(start + 20, end - start - 21);
            capabilitiesText = capabilitiesText.split('\n').map(line => line.trim().startsWith('#') ? line.trim().slice(1).trim() : line.trim()).join('\n');
            capabilitiesSchema = JSON.parse(capabilitiesText);
        }
    } catch (e) {
        console.warn("Could not parse capabilitiesSchema - using default {}");
    }
    scriptStuff = {
        script: scriptText,
        capabilitiesSchema
    };
}

try {
    const taskComments = scriptStuff.script.substr(scriptStuff.script.indexOf("<addTaskComments>") + 17, scriptStuff.script.indexOf("</addTaskComments>") - scriptStuff.script.indexOf("<addTaskComments>") - 17);
    console.log("ADDTASK COMMENTS: ");
    console.log(taskComments)
} catch (e) {
    // ignore
}

let suggestedTransitions: any[] = [];
try {
    let transitionsText = scriptStuff.script.substr(scriptStuff.script.indexOf("<transitions>") + 13, scriptStuff.script.indexOf("</transitions>") - scriptStuff.script.indexOf("<transitions>") - 13);
    transitionsText = transitionsText.split('\n').map(line => line.trim().startsWith('#') ? line.trim().slice(1).trim() : line.trim()).join('\n');
    suggestedTransitions = JSON.parse(transitionsText);
} catch (e) {
    // ignore
}

let suggestedData = {};
try {
    let dataText = scriptStuff.script.substr(scriptStuff.script.indexOf("<data>") + 6, scriptStuff.script.indexOf("</data>") - scriptStuff.script.indexOf("<data>") - 6);
    dataText = dataText.split('\n').map(line => line.trim().startsWith('#') ? line.trim().slice(1).trim() : line.trim()).join('\n');
    suggestedData = JSON.parse(dataText);
} catch (e) {
    console.warn("Could not parse suggested data - using default {}")
}
let data = prompt("data (as JSON): ", JSON.stringify(suggestedData, null, 2));
data = JSON.parse(data);

const transitionOptions: { name: string; value: string }[] = [
    {
        name: "none (persistent task)",
        value: "none"
    },
    {
        name: "auto-delete on success",
        value: "auto_delete_on_success"
    },
    {
        name: "auto-delete always",
        value: "auto_delete_always"
    }
];

if (suggestedTransitions.length > 0) {
    transitionOptions.unshift({
        name: "suggested (from script annotation)",
        value: "suggested"
    });
}

const transitionsChoice = await Select.prompt({
    message: "Transitions?",
    search: false,
    options: transitionOptions,
}) as unknown as string;

let transitions: any[] = [];
if (transitionsChoice === "suggested") {
    transitions = suggestedTransitions;
} else if (transitionsChoice === "auto_delete_on_success") {
    transitions = [{
        statuses: ["COMPLETED"],
        condition: {},
        timing: { immediate: true },
        transitionTo: "DELETED"
    }];
} else if (transitionsChoice === "auto_delete_always") {
    transitions = [{
        statuses: ["COMPLETED", "FAILED"],
        condition: {},
        timing: { immediate: true },
        transitionTo: "DELETED"
    }];
}

const status: number = await Select.prompt({
    message: "Initial status?",
    search: false,
    options: [
        {
            name: "awaiting  (task ready to get picked up immediately)",
            value: 0
        },
        {
            name: "paused    (task needs to get switched over to awaiting status before it can get picked up)",
            value: 4
        }
    ],
});

let suggestedName = "";
try {
    const start = scriptStuff.script.indexOf("<name>");
    const end = scriptStuff.script.indexOf("</name>");
    if (start !== -1 && end !== -1 && end > start) {
        suggestedName = scriptStuff.script.substr(start + 6, end - start - 6).trim();
    }
} catch (e) {
    // ignore
}
let name: string | undefined = await Input.prompt({message: "Task name?", default: suggestedName || undefined})
if (name == "") {
    name = undefined;
}


await addTask({
    type: script.endsWith(".py") ? "python" : script.endsWith(".sh") ? "bash" : "deno",
    ...scriptStuff,
    transitions,
    status,
    name,
    data
}).then(task => {
    console.log(`Done! Task ID is ${task.id}`);
});
