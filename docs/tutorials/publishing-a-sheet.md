# Publishing a read-only sheet

Sheets can be shared read-only without giving viewers a SheetBot login. This is useful for build dashboards, status pages, and reports.

In this tutorial you make an existing sheet public, open it anonymously, list it, and revoke access.

## 1. Check the current grant

Use a user with the `manageSheetPermissions` permission. Get a token and inspect the sheet:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export TOKEN=$(curl -sS -X POST "$SHEETBOT_BASEURL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}' \
  | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/sheets/build-status/public"
```

The response is:

```json
{
  "sheet": "build-status",
  "public": false
}
```

## 2. Make the sheet public

```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"public":true}' \
  "$SHEETBOT_BASEURL/sheets/build-status/public"
```

You can also use the **Admin** page in the web UI, which lists sheets and their public grants.

## 3. Open it anonymously

Fetch the sheet without an `Authorization` header:

```bash
curl "$SHEETBOT_BASEURL/sheets/build-status"
```

Anonymous clients also see public sheets in the sheet list:

```bash
curl "$SHEETBOT_BASEURL/sheets"
```

Share the viewer URL:

```text
http://localhost:3000/sheet.html?sheet=build-status
```

Viewers can browse, sort, and copy data, but they cannot write to the sheet or see private sheets.

## 4. Hide columns before publishing

Public means every row and column returned by the sheet's `data_view` is readable. If the sheet contains internal columns, change `data_view` to expose only the columns you want:

```sql
DROP VIEW data_view;

CREATE VIEW data_view AS
SELECT key, name, status, progress, updated_at
FROM data;
```

Then make sure `columnstructure` only contains those columns. The sheet API and UI read `data_view`, so hidden columns are not returned.

Stop SheetBot or expect SQLite locking while changing the view. Test with an anonymous request before sharing the link.

## 5. Revoke access

```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"public":false}' \
  "$SHEETBOT_BASEURL/sheets/build-status/public"
```

Anonymous requests now return `401`/`403` for that sheet, and it disappears from the anonymous sheet list.

## Notes

- Public sheets are read-only. Writes still require login and `putSheetData`.
- The whole sheet is public; there is no per-row or per-cell access control.
- Public artefacts are separate. See [Working with artefacts](working-with-artefacts.md) for the public bucket.
- Use [Customizing your sheet](customizing-your-sheet.md) to choose widgets for the public columns.

## Next

- [Sheet database](../reference/sheet-database.md) — `data`, `data_view`, and `columnstructure`.
- [HTTP API reference](../reference/http-api.md) — sheet and permission endpoints.
- [Configure permissions](../how-to/configure-permissions.md) — `manageSheetPermissions` and `putSheetData`.
