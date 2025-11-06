import { checkError } from "./commonutil.ts";
import { dirname, basename } from "https://deno.land/std@0.220.1/path/mod.ts";

export async function addTask(taskspec) {
    const res = await fetch(Deno.env.get("SHEETBOT_BASEURL")! + "/tasks", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        },
        body: JSON.stringify(taskspec)
    });
    checkError(res);
    return res.json();
}

export async function getTask(taskid?: string) {
    const res = await fetch(taskid === undefined ? Deno.env.get("SHEETBOT_TASK_BASEURL") : `${Deno.env.get("SHEETBOT_BASEURL")!}/tasks/${taskid}`, {
        method: 'GET',
        headers: {
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        }
    });
    checkError(res);
    return res.json();
}

export async function getData(taskid?: string) {
    const data = await getTask(taskid);
    return data.data;
}

export async function getArtefacts(taskid?: string) {
    const data = await getTask(taskid);
    return data.artefacts;
}

export async function submitData(data, taskid?: string) {
    const res = await fetch(taskid === undefined ? Deno.env.get("SHEETBOT_TASK_DATAURL") : `${Deno.env.get("SHEETBOT_BASEURL")!}/tasks/${taskid}/data`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        },
        body: JSON.stringify({ data })
    });
    checkError(res);
    return res.json();
}

export async function uploadArtefact(filename, file: Uint8Array, taskid?: string) {
    const body = new FormData();
    const blob = new Blob([file as Uint8Array<ArrayBuffer>]);
    body.set("file", blob, filename);
    return await fetch(taskid === undefined ? Deno.env.get("SHEETBOT_TASK_ARTEFACTURL") : `${Deno.env.get("SHEETBOT_BASEURL")}/tasks/${taskid}/artefacts`, {
        method: "POST",
        body,
        headers: {
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        }
    }).then(checkError).then(res => res.json());
}
export async function uploadArtefactFromFilepath(filepath, filename?: string, taskid?: string) {
    const file = await Deno.readFile(filepath);
    const filen = filename !== undefined ? filename : basename(filepath);
    return uploadArtefact(filen, file, taskid);
}

export async function getScript(path) {
    return await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}${path}`, {
        headers: {
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        }
    }).then(checkError).then(res => res.text()).then(script => {
        const capabilitiesSchema = JSON.parse(script.substr(script.indexOf("<capabilitiesSchema>") + 20, script.indexOf("</capabilitiesSchema>") - script.indexOf("<capabilitiesSchema>") - 21))
        return {
            script,
            capabilitiesSchema
        }
    });
}

export async function patchTask(taskspecpartial, taskid?: string) {
    return await fetch(taskid === undefined ? Deno.env.get("SHEETBOT_TASK_BASEURL") : `${Deno.env.get("SHEETBOT_BASEURL")!}/tasks/${taskid}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        },
        body: JSON.stringify(taskspecpartial)
    }).then(checkError).then(() => getTask(taskid));
}

export async function deleteTask(taskid?: string) {
    return await fetch(taskid === undefined ? Deno.env.get("SHEETBOT_TASK_BASEURL") : `${Deno.env.get("SHEETBOT_BASEURL")!}/tasks/${taskid}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
        }
    }).then(checkError).then(() => undefined);
}