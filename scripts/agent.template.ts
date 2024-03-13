const response = await fetch("${req.protocol}://${req.get('host')}/tasks/get");
const json = await response.json();
if (json.hasOwnProperty("script")) {
  Deno.env.set("SHEETBOX_BASEURL", "${req.protocol}://${req.get('host')}");
  Deno.env.set("SHEETBOX_TASK_ID", json.id);
  Deno.env.set(
    "SHEETBOX_TASK_BASEURL",
    "${req.protocol}://${req.get('host')}/tasks/" + json.id,
  );
  Deno.env.set(
    "SHEETBOX_TASK_ACCEPTURL",
    "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/accept",
  );
  Deno.env.set(
    "SHEETBOX_TASK_COMPLETEURL",
    "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/complete",
  );
  Deno.env.set(
    "SHEETBOX_TASK_FAILEDURL",
    "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/failed",
  );
  Deno.env.set(
    "SHEETBOX_TASK_DATAURL",
    "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/data",
  );
  Deno.env.set(
    "SHEETBOX_TASK_ARTEFACTURL",
    "${req.protocol}://${req.get('host')}/tasks/" + json.id + "/artefacts",
  );

  await fetch(Deno.env.get("SHEETBOX_TASK_ACCEPTURL"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  try {
    const data = await import(json.script);
    await fetch(Deno.env.get("SHEETBOX_TASK_COMPLETEURL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: data }),
    });
  } catch (e) {
    console.error(e);
    await fetch(Deno.env.get("SHEETBOX_TASK_FAILEDURL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  }
}
