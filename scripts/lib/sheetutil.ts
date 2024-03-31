import { checkError } from "./commonutil.ts";

export async function addSheetData(sheet, data) {
  return fetch(`${Deno.env.get("SHEETBOT_BASEURL")}/sheets/${sheet}/data`, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': Deno.env.get("SHEETBOT_AUTHORIZATION_HEADER")
    },
    body: JSON.stringify(data)
  }).then(checkError).then(() => undefined);
};
