import { checkError } from "./commonutil.ts";

export async function addSheetData(sheet, data) {
  const res = await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/sheets/${sheet}/data`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    },
    body: JSON.stringify(data)
  });
  checkError(res);
  return undefined;
};

export async function getSheetData(sheet) {
  const res = await fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/sheets/${sheet}`, {
    method: "GET",
    headers: {
      'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    }
  });
  checkError(res);
  return res.json();
};
