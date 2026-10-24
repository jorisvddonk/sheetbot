import { checkError } from "./commonutil.js";

function env(name) {
  const v = process.env[name];
  if (v === undefined) throw new Error("Missing env var " + name);
  return v;
}

export async function addTask(taskspec) {
  const res = await fetch(env("SHEETBOT_BASEURL") + "/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER,
    },
    body: JSON.stringify(taskspec),
  });
  checkError(res);
  return res.json();
}

export async function getTask(taskid) {
  const url = taskid === undefined ? process.env.SHEETBOT_TASK_BASEURL : `${process.env.SHEETBOT_BASEURL}/tasks/${taskid}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER },
  });
  checkError(res);
  return res.json();
}

export async function getData(taskid) {
  const data = await getTask(taskid);
  return data.data;
}

export async function getArtefacts(taskid) {
  const data = await getTask(taskid);
  return data.artefacts;
}

export async function submitData(data, taskid) {
  const url = taskid === undefined ? process.env.SHEETBOT_TASK_DATAURL : `${process.env.SHEETBOT_BASEURL}/tasks/${taskid}/data`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER,
    },
    body: JSON.stringify({ data }),
  });
  checkError(res);
  return res.json();
}

export async function uploadArtefact(filename, file, taskid) {
  const body = new FormData();
  const blob = new Blob([file]);
  body.set("file", blob, filename);
  const url = taskid === undefined ? process.env.SHEETBOT_TASK_ARTEFACTURL : `${process.env.SHEETBOT_BASEURL}/tasks/${taskid}/artefacts`;
  const res = await fetch(url, {
    method: "POST",
    body,
    headers: { Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER },
  });
  checkError(res);
  return res.json();
}

export async function uploadArtefactFromFilepath(filepath, filename, taskid) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const file = fs.readFileSync(filepath);
  const filen = filename !== undefined ? filename : path.basename(filepath);
  return uploadArtefact(filen, file, taskid);
}

export async function getScript(p) {
  const res = await fetch(`${process.env.SHEETBOT_BASEURL}${p}`, {
    headers: { Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER },
  });
  checkError(res);
  const script = await res.text();
  const capabilitiesSchema = JSON.parse(script.substring(script.indexOf("<capabilitiesSchema>") + 20, script.indexOf("</capabilitiesSchema>") - script.indexOf("<capabilitiesSchema>") - 21));
  return { script, capabilitiesSchema };
}

export async function patchTask(taskspecpartial, taskid) {
  const url = taskid === undefined ? process.env.SHEETBOT_TASK_BASEURL : `${process.env.SHEETBOT_BASEURL}/tasks/${taskid}`;
  await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER,
    },
    body: JSON.stringify(taskspecpartial),
  }).then(checkError);
  return getTask(taskid);
}

export async function deleteTask(taskid) {
  const url = taskid === undefined ? process.env.SHEETBOT_TASK_BASEURL : `${process.env.SHEETBOT_BASEURL}/tasks/${taskid}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER,
    },
  }).then(checkError);
  return undefined;
}
