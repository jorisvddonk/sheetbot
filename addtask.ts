import { promptSecret } from "https://deno.land/std@0.220.1/cli/prompt_secret.ts";
import { checkError } from "./scripts/lib/commonutil.ts";
import { getScript, addTask } from "./scripts/lib/taskutil.ts";
import { Select } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/mod.ts";

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

const scriptStuff = await getScript(`/scripts/${script}`);
console.log(scriptStuff);

await addTask({
    type: "deno",
    ...scriptStuff,
    data
}).catch(checkError).then(task => {
    console.log(`Done! Task ID is ${task.id}`);
});
