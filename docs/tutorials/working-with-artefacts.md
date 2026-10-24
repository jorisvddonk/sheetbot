# Working with artefacts

Artefacts are files produced by tasks: build outputs, screenshots, reports, logs, or generated HTML. They are stored per task and can also be served through an S3-compatible bucket API.

In this tutorial you upload an artefact from a task, download it, and put a file in the public bucket.

## 1. Upload an artefact from a task

Create a task with type `node` and paste this script:

```javascript
(async () => {
  const authorization = process.env.SHEETBOT_AUTHORIZATION_HEADER;
  const content = "hello from a SheetBot artefact\n";

  const form = new FormData();
  form.set("file", new Blob([content], { type: "text/plain" }), "hello.txt");

  const upload = await fetch(process.env.SHEETBOT_TASK_ARTEFACTURL, {
    method: "POST",
    headers: { "Authorization": authorization },
    body: form,
  });

  if (!upload.ok) {
    throw new Error(`Upload failed: ${upload.status} ${await upload.text()}`);
  }

  const uploaded = await upload.json();

  const update = await fetch(process.env.SHEETBOT_TASK_DATAURL, {
    method: "POST",
    headers: {
      "Authorization": authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        artefact: uploaded.directURL,
      },
    }),
  });

  if (!update.ok) {
    throw new Error(`Data update failed: ${update.status} ${await update.text()}`);
  }

  console.log("uploaded", uploaded.directURL);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Run a Node.js agent after creating the task:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.js" | node
```

The task needs the `performTasks` permission. The upload response contains:

```json
{
  "url": "http://localhost:3000/tasks/<task-id>/artefacts/hello.txt",
  "directURL": "http://localhost:3000/artefacts/tasks/<task-id>/hello.txt"
}
```

Files are stored in `artefacts/tasks/<task-id>/`, and the filename is added to the task's `artefacts` array.

## 2. Download the artefact

Open the task in the web UI, or use the task download endpoint:

```bash
export TOKEN=$(curl -sS -X POST "$SHEETBOT_BASEURL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SHEETBOT_AUTH_USER\",\"password\":\"$SHEETBOT_AUTH_PASS\"}" \
  | jq -r .token)

curl -L -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/tasks/<task-id>/artefacts/hello.txt"
```

The endpoint redirects to the direct file URL and sets an authentication cookie. The direct URL is also usable from a browser after login.

Deleting a task artefact requires `deleteTasks`:

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/tasks/<task-id>/artefacts/hello.txt"
```

## 3. Use the S3-compatible bucket API

Buckets are independent of tasks and are useful for shared reports, dashboards, or files consumed by other tools.

Upload a file with JWT authentication:

```bash
printf 'public report\n' > report.txt

curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @report.txt \
  "$SHEETBOT_BASEURL/artefacts/reports/report.txt"
```

List a bucket:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/artefacts/reports"
```

Download a file:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/artefacts/reports/report.txt"
```

The bucket API also accepts temporary AWS-compatible credentials from `POST /artefacts-credentials`, which lets S3 clients sign requests. JWT authentication is simpler for scripts.

## 4. Publish a file in the public bucket

The `public` bucket is served without authentication:

```bash
printf 'anyone can read this\n' > public.txt

curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @public.txt \
  "$SHEETBOT_BASEURL/artefacts/public/public.txt"

curl "$SHEETBOT_BASEURL/artefacts/public/public.txt"
```

Only put files in `public` that are safe for anonymous access. Uploading still requires `createArtefacts`; reading `public` does not require a login.

## Permissions

| Action | Permission |
|---|---|
| Upload/download task artefacts | `performTasks` |
| Delete task artefacts | `deleteTasks` |
| Upload to a bucket | `createArtefacts` |
| List/download a bucket | `viewArtefacts` |
| Delete a bucket file | `deleteArtefacts` |

See [Configure permissions](../how-to/configure-permissions.md) for the full list.

## Next

- [Artefacts reference](../reference/artefacts.md) — endpoints, storage, and AWS-compatible credentials.
- [HTTP API reference](../reference/http-api.md) — all artefact endpoints.
- [Widgets](../reference/widgets.md) — render artefact links with the `download` or `attachments` widget.
