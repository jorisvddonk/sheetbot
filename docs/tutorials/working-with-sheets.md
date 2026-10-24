# Working with sheets

In this tutorial you create a task that writes rows into a sheet, then view the sheet in the web UI.

Sheets are SQLite databases under `sheets/`. A sheet is created the first time data is written to it, so the task does both: creates `build-status` and fills it with build results.

## 1. Create the task

Open <http://localhost:3000/addtask.html>, select **Manual** as the script source, and set **Task Type** to **Other (specify)** with the value `node`.

Give the task a name such as `Write build status`, leave the status as **Awaiting**, and paste this script:

```javascript
const baseUrl = process.env.SHEETBOT_BASEURL;
const authorization = process.env.SHEETBOT_AUTHORIZATION_HEADER;
const sheet = "build-status";

const rows = [
  {
    key: "linux-x64",
    name: "Linux x64",
    status: 2,
    progress: 100,
    updated_at: Date.now(),
    notes: "Build succeeded",
  },
  {
    key: "windows-x64",
    name: "Windows x64",
    status: 3,
    progress: 42,
    updated_at: Date.now(),
    notes: "Compile failed at step 3",
  },
];

(async () => {
  for (const row of rows) {
    const response = await fetch(`${baseUrl}/sheets/${sheet}/data`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authorization,
      },
      body: JSON.stringify(row),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to write ${row.key}: ${response.status} ${body}`);
    }
  }

  console.log(`Wrote ${rows.length} rows to ${sheet}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

The agent injects `SHEETBOT_BASEURL` and `SHEETBOT_AUTHORIZATION_HEADER`, so the script does not need to log in itself. The user or API key running the agent needs the `putSheetData` permission; `*` includes it.

## 2. Run the agent

Create the task, then start a Node.js agent:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.js" | node
```

The task should complete. Its console output appears in the agent terminal.

## 3. View the sheet

Open <http://localhost:3000/sheet.html?sheet=build-status>.

You should see two rows and the columns `key`, `name`, `status`, `progress`, `updated_at`, and `notes`. The sheet was created automatically by the first `POST`.

You can also read it as JSON:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/sheets/build-status"
```

## 4. Upsert instead of duplicating

The `key` column is the primary key. Posting another row with the same `key` updates it instead of inserting a duplicate:

```javascript
{
  key: "linux-x64",
  name: "Linux x64",
  status: 2,
  progress: 100,
  updated_at: Date.now(),
  notes: "Rebuilt successfully",
}
```

This makes sheets useful for status dashboards: a task can write the current state on every run.

## Next

The columns currently use the default text widget. Continue to [Customizing your sheet](customizing-your-sheet.md) to choose a widget for each column, then [publish the sheet](publishing-a-sheet.md) for read-only sharing. For file outputs, see [Working with artefacts](working-with-artefacts.md).
