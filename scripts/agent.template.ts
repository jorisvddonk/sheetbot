import fs from "https://deno.land/std@0.140.0/node/fs.ts";
import * as path from "jsr:@std/path";

let SHEETBOT_BASEURL;
if (!Deno.env.has("SHEETBOT_BASEURL")) {
  SHEETBOT_BASEURL
  SHEETBOT_BASEURL = "${req.protocol}://${req.get('host')}";
  Deno.env.set("SHEETBOT_BASEURL", SHEETBOT_BASEURL);
} else {
  SHEETBOT_BASEURL = Deno.env.get("SHEETBOT_BASEURL");
}

async function checkForErrors(responsePromise) {
  const response = await responsePromise;
  if (response.status === 401) {
    throw new Error("Unauthenticated");
  } else if (response.status === 403) {
    throw new Error("Unauthorized");
  } else if (response.status === 500) {
    throw new Error("Internal server error");
  } else if (response.status !== 200) {
    throw new Error("Some error occurred");
  }
  return response;
}

let headers = {};
if (Deno.env.has("SHEETBOT_AUTH_USER") && Deno.env.has("SHEETBOT_AUTH_PASS")) {
  const authr = await fetch(SHEETBOT_BASEURL + "/login", {
    method: "POST",
    body: JSON.stringify({
      username: Deno.env.get("SHEETBOT_AUTH_USER"),
      password: Deno.env.get("SHEETBOT_AUTH_PASS")
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  Deno.env.delete("SHEETBOT_AUTH_USER");
  Deno.env.delete("SHEETBOT_AUTH_PASS");
  if (authr.status === 200) {
    const authj = await authr.json();
    headers["Authorization"] = `Bearer ${authj.token}`;
  } else {
    throw new Error("Login failed");
  }
}

let localCapabilities = {};
try {
  const capabilitiesJSONPath = path.resolve("./.capabilities.json");
  if (fs.existsSync(capabilitiesJSONPath)) {
    const capabilitiesText = Deno.readTextFileSync(capabilitiesJSONPath);
    localCapabilities = Object.assign({}, localCapabilities, JSON.parse(capabilitiesText));
  }

  const capabilitiesPath = path.resolve("./.capabilities.dynamic.ts");
  if (fs.existsSync(capabilitiesPath)) {
    const { getCapabilities } = await import(path.toFileUrl(capabilitiesPath).toString());
    const dynamicCapabilities = await getCapabilities(localCapabilities);
    localCapabilities = Object.assign({}, localCapabilities, dynamicCapabilities);
  }

  const capabilitiesOverrideJSONPath = path.resolve("./.capabilities.override.json");
  if (fs.existsSync(capabilitiesOverrideJSONPath)) {
    const capabilitiesOverrideText = Deno.readTextFileSync(capabilitiesOverrideJSONPath);
    localCapabilities = Object.assign({}, localCapabilities, JSON.parse(capabilitiesOverrideText));
  }

  console.log("capabilities:", localCapabilities);
} catch (e) {
  console.log("Ignoring capabilities error:");
  console.log(e);
}

const capabilities = {
  os: Deno.build.os,
  arch: Deno.build.arch,
  ...localCapabilities
};

const response = await checkForErrors(fetch(SHEETBOT_BASEURL + "/tasks/get", {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: 'deno',
    capabilities: capabilities
  })
}));

const json = await response.json();
if (json.hasOwnProperty("script")) {
  Deno.env.set("SHEETBOT_TASK_ID", json.id);
  Deno.env.set("SHEETBOT_AUTHORIZATION_HEADER", headers["Authorization"]);
  Deno.env.set(
    "SHEETBOT_TASK_BASEURL",
    SHEETBOT_BASEURL + "/tasks/" + json.id,
  );
  Deno.env.set(
    "SHEETBOT_TASK_ACCEPTURL",
    SHEETBOT_BASEURL + "/tasks/" + json.id + "/accept",
  );
  Deno.env.set(
    "SHEETBOT_TASK_COMPLETEURL",
    SHEETBOT_BASEURL + "/tasks/" + json.id + "/complete",
  );
  Deno.env.set(
    "SHEETBOT_TASK_FAILEDURL",
    SHEETBOT_BASEURL + "/tasks/" + json.id + "/failed",
  );
  Deno.env.set(
    "SHEETBOT_TASK_DATAURL",
    SHEETBOT_BASEURL + "/tasks/" + json.id + "/data",
  );
  Deno.env.set(
    "SHEETBOT_TASK_ARTEFACTURL",
    SHEETBOT_BASEURL + "/tasks/" + json.id + "/artefacts",
  );

  await checkForErrors(fetch(Deno.env.get("SHEETBOT_TASK_ACCEPTURL")!, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }));
  try {
    const data = await import(json.script);
    await checkForErrors(fetch(Deno.env.get("SHEETBOT_TASK_COMPLETEURL")!, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: data }),
    }));
  } catch (e) {
    console.error(e);
    await checkForErrors(fetch(Deno.env.get("SHEETBOT_TASK_FAILEDURL")!, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }));
  }
}
