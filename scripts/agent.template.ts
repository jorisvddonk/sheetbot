let SHEETBOT_BASEURL;
if (!Deno.env.has("SHEETBOT_BASEURL")) {
  SHEETBOT_BASEURL
  SHEETBOT_BASEURL = "${req.protocol}://${req.get('host')}";
  Deno.env.set("SHEETBOT_BASEURL", SHEETBOT_BASEURL);
} else {
  SHEETBOT_BASEURL = Deno.env.get("SHEETBOT_BASEURL");
}

const response = await fetch(SHEETBOT_BASEURL + "/tasks/get");
const json = await response.json();
if (json.hasOwnProperty("script")) {
  Deno.env.set("SHEETBOT_TASK_ID", json.id);
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

  await fetch(Deno.env.get("SHEETBOT_TASK_ACCEPTURL")!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  try {
    const data = await import(json.script);
    await fetch(Deno.env.get("SHEETBOT_TASK_COMPLETEURL")!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: data }),
    });
  } catch (e) {
    console.error(e);
    await fetch(Deno.env.get("SHEETBOT_TASK_FAILEDURL")!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  }
}
