import { promptSecret } from "https://deno.land/std@0.220.1/cli/prompt_secret.ts";
import { checkError } from "./scripts/lib/commonutil.ts";
import { getScript, addTask } from "./scripts/lib/taskutil.ts";
import { Select, Input } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";

const script: string = await Select.prompt({
    message: "Pick a script",
    search: true,
    options: Array.from(Deno.readDirSync("./scripts/").map(x => x.name).filter(x => x.endsWith(".ts") || x.endsWith(".js")))
});
let data = prompt("data (as JSON): ", "{}");
data = JSON.parse(data);

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
}).catch(checkError).then(res => res.json()).then(json => json.token);

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
    const capabilitiesSchema = JSON.parse(scriptText.substr(scriptText.indexOf("<capabilitiesSchema>") + 20, scriptText.indexOf("</capabilitiesSchema>") - scriptText.indexOf("<capabilitiesSchema>") - 21));
    scriptStuff = {
        script: scriptText,
        capabilitiesSchema
    };
}

const ephemeral: number = await Select.prompt({
    message: "Ephemeralness?",
    search: false,
    options: [
        {
            name: "persistent            (task will not get automatically deleted on completion)",
            value: 0
        },
        {
            name: "ephemeral_on_success  (task will get removed on successful completion ONLY)",
            value: 1
        },
        {
            name: "ephemeral_always      (task will ALWAYS get automatically removed upon completion)",
            value: 2
        }
    ],
});

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

let name: string | undefined = await Input.prompt("Task name?")
if (name == "") {
    name = undefined;
}


await addTask({
    type: "deno",
    ...scriptStuff,
    ephemeral,
    status,
    name,
    data
}).catch(checkError).then(task => {
    console.log(`Done! Task ID is ${task.id}`);
});
