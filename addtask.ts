import { promptSecret } from "https://deno.land/std@0.220.1/cli/prompt_secret.ts";
import { checkError } from "./scripts/lib/commonutil.ts";
import { getScript, addTask } from "./scripts/lib/taskutil.ts";
import { Select, Input } from "https://deno.land/x/cliffy@v1.0.0-rc.4/prompt/mod.ts";

const script: string = await Select.prompt({
    message: "Pick a script",
    search: true,
    options: Array.from(Deno.readDirSync("./scripts/").map(x => x.name).filter(x => x.endsWith(".ts") || x.endsWith(".js") || x.endsWith(".py") || x.endsWith(".sh")))
});

console.log("Adding task, please login first");
const username = prompt("username");
const password = promptSecret("password");
const baseurl = prompt("base URL", "http://127.0.0.1:3000");

const token = await fetch(`${baseurl}/login`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        username,
        password
    })
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
    scriptStuff = await getScript(`/scripts/${script}`);
} else {
    const scriptText = new TextDecoder().decode(Deno.readFileSync(`./scripts/${script}`));
    let capabilitiesText = scriptText.substr(scriptText.indexOf("<capabilitiesSchema>") + 20, scriptText.indexOf("</capabilitiesSchema>") - scriptText.indexOf("<capabilitiesSchema>") - 21);
    capabilitiesText = capabilitiesText.split('\n').map(line => line.trim().startsWith('#') ? line.trim().slice(1).trim() : line.trim()).join('\n');
    try {
        const capabilitiesSchema = JSON.parse(capabilitiesText);
        scriptStuff = {
            script: scriptText,
            capabilitiesSchema
        };
    } catch (e) {
        console.error(e);
        console.log(capabilitiesText);
        throw e;
    }
}

try {
    const taskComments = scriptStuff.script.substr(scriptStuff.script.indexOf("<addTaskComments>") + 17, scriptStuff.script.indexOf("</addTaskComments>") - scriptStuff.script.indexOf("<addTaskComments>") - 17);
    console.log("ADDTASK COMMENTS: ");
    console.log(taskComments)
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

const transitionsChoice: string = await Select.prompt({
    message: "Transitions?",
    search: false,
    options: [
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
    ],
});

let transitions: any[] = [];
if (transitionsChoice === "auto_delete_on_success") {
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

const suggestedName = scriptStuff.script.substr(scriptStuff.script.indexOf("<name>") + 6, scriptStuff.script.indexOf("</name>") - scriptStuff.script.indexOf("<name>") - 6);
let name: string | undefined = await Input.prompt({message: "Task name?", suggestions: [suggestedName]})
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
