const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

async function main() {
  let SHEETBOT_BASEURL = process.env.SHEETBOT_BASEURL;
  if (!SHEETBOT_BASEURL) {
    SHEETBOT_BASEURL = "${req.protocol}://${req.get('host')}";
    process.env.SHEETBOT_BASEURL = SHEETBOT_BASEURL;
  }

  async function checkForErrors(responsePromise) {
    const response = await responsePromise;
    if (response.status === 401) throw new Error("Unauthenticated");
    if (response.status === 403) throw new Error("Unauthorized");
    if (response.status === 500) throw new Error("Internal server error");
    if (response.status !== 200) throw new Error("Some error occurred: " + response.status);
    return response;
  }

  const headers = {};
  if (process.env.SHEETBOT_AUTH_APIKEY) {
    const authr = await fetch(SHEETBOT_BASEURL + "/login", {
      method: "POST",
      body: JSON.stringify({ apiKey: process.env.SHEETBOT_AUTH_APIKEY }),
      headers: { "Content-Type": "application/json" },
    });
    delete process.env.SHEETBOT_AUTH_APIKEY;
    if (authr.status === 200) {
      const authj = await authr.json();
      headers["Authorization"] = "Bearer " + authj.token;
    } else {
      throw new Error("Login failed with API key");
    }
  } else if (process.env.SHEETBOT_AUTH_USER && process.env.SHEETBOT_AUTH_PASS) {
    const authr = await fetch(SHEETBOT_BASEURL + "/login", {
      method: "POST",
      body: JSON.stringify({ username: process.env.SHEETBOT_AUTH_USER, password: process.env.SHEETBOT_AUTH_PASS }),
      headers: { "Content-Type": "application/json" },
    });
    delete process.env.SHEETBOT_AUTH_USER;
    delete process.env.SHEETBOT_AUTH_PASS;
    if (authr.status === 200) {
      const authj = await authr.json();
      headers["Authorization"] = "Bearer " + authj.token;
    } else {
      throw new Error("Login failed");
    }
  }

  delete process.env.SHEETBOT_AUTH_USER;
  delete process.env.SHEETBOT_AUTH_PASS;
  delete process.env.SHEETBOT_AUTH_APIKEY;

  let localCapabilities = {};
  try {
    const capabilitiesJSONPath = path.resolve("./.capabilities.json");
    if (fs.existsSync(capabilitiesJSONPath)) {
      localCapabilities = Object.assign({}, localCapabilities, JSON.parse(fs.readFileSync(capabilitiesJSONPath, "utf8")));
    }
    const capabilitiesPath = path.resolve("./.capabilities.dynamic.mjs");
    if (fs.existsSync(capabilitiesPath)) {
      const mod = await import(pathToFileURL(capabilitiesPath).href);
      if (mod.getCapabilities) {
        const dynamicCapabilities = await mod.getCapabilities(localCapabilities);
        localCapabilities = Object.assign({}, localCapabilities, dynamicCapabilities);
      }
    }
    const capabilitiesOverrideJSONPath = path.resolve("./.capabilities.override.json");
    if (fs.existsSync(capabilitiesOverrideJSONPath)) {
      localCapabilities = Object.assign({}, localCapabilities, JSON.parse(fs.readFileSync(capabilitiesOverrideJSONPath, "utf8")));
    }
    console.log("capabilities:", localCapabilities);
  } catch (e) {
    console.log("Ignoring capabilities error:");
    console.log(e);
  }

  const capabilities = {
    os: os.platform(),
    arch: os.arch(),
    node: process.version,
    ...localCapabilities,
  };

  let json = {};
  for (const taskType of ["node", "javascript", "js", "typescript", "ts"]) {
    const response = await checkForErrors(fetch(SHEETBOT_BASEURL + "/tasks/get", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ type: taskType, capabilities: capabilities }),
    }));
    const candidate = await response.json();
    if (candidate && candidate.script) {
      json = candidate;
      json._taskType = taskType;
      break;
    }
  }
  if (Object.prototype.hasOwnProperty.call(json, "script")) {
    process.env.SHEETBOT_TASK_ID = json.id;
    process.env.SHEETBOT_AUTHORIZATION_HEADER = headers["Authorization"];
    process.env.SHEETBOT_TASK_BASEURL = SHEETBOT_BASEURL + "/tasks/" + json.id;
    process.env.SHEETBOT_TASK_ACCEPTURL = SHEETBOT_BASEURL + "/tasks/" + json.id + "/accept";
    process.env.SHEETBOT_TASK_COMPLETEURL = SHEETBOT_BASEURL + "/tasks/" + json.id + "/complete";
    process.env.SHEETBOT_TASK_FAILEDURL = SHEETBOT_BASEURL + "/tasks/" + json.id + "/failed";
    process.env.SHEETBOT_TASK_DATAURL = SHEETBOT_BASEURL + "/tasks/" + json.id + "/data";
    process.env.SHEETBOT_TASK_ARTEFACTURL = SHEETBOT_BASEURL + "/tasks/" + json.id + "/artefacts";

    await checkForErrors(fetch(process.env.SHEETBOT_TASK_ACCEPTURL, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }));

    let failed = false;
    try {
      const scriptRes = await fetch(json.script, { headers: headers });
      if (!scriptRes.ok) throw new Error("Failed to fetch task script");
      const scriptText = await scriptRes.text();
      const scriptUrl = new URL(json.script);
      const ext = path.extname(scriptUrl.pathname) || ".js";
      const tmpFile = path.join(process.cwd(), ".sheetbot-task-" + json.id + ext);
      fs.writeFileSync(tmpFile, scriptText);
      try {
        const nodeArgs = ext === ".ts"
          ? ["--experimental-sqlite", "--experimental-strip-types", tmpFile]
          : [tmpFile];
        const result = spawnSync(process.execPath, nodeArgs, {
          env: process.env,
          encoding: "utf8",
          stdio: "inherit",
        });
        if (result.status !== 0) {
          throw new Error((result.stderr || "") || "task failed with exit code " + result.status);
        }
      } finally {
        try { fs.rmSync(tmpFile, { force: true }); } catch (e) {}
      }
    } catch (e) {
      console.error(e);
      failed = true;
    }

    if (failed) {
      await checkForErrors(fetch(process.env.SHEETBOT_TASK_FAILEDURL, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }));
    } else {
      await checkForErrors(fetch(process.env.SHEETBOT_TASK_COMPLETEURL, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
      }));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
