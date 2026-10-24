export async function getSheetData(sheet) {
  const res = await fetch(`${process.env.SHEETBOT_BASEURL}/sheets/${sheet}/data`, {
    headers: { Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER },
  });
  if (!res.ok) throw new Error("Request response not OK: " + res.status);
  return res.json();
}

export async function getSheet(sheet) {
  const res = await fetch(`${process.env.SHEETBOT_BASEURL}/sheets/${sheet}`, {
    headers: { Authorization: process.env.SHEETBOT_AUTHORIZATION_HEADER },
  });
  if (!res.ok) throw new Error("Request response not OK: " + res.status);
  return res.json();
}
