import { checkError } from "./commonutil.ts";

// Every request must be able to fail fast. Without a timeout a single stalled
// socket hangs the whole task until the platform watchdog marks it FAILED,
// which is unrecoverable (a FAILED task never re-arms).
const REQUEST_TIMEOUT_MS = 60_000;

export async function addSheetData(sheet, data) {
  const res = await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/sheets/${sheet}/data`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  checkError(res);
  return undefined;
};

export async function getSheetData(sheet) {
  const res = await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/sheets/${sheet}`, {
    method: "GET",
    headers: {
      'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  checkError(res);
  return res.json();
};
