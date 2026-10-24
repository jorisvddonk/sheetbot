# HTTP API

SheetBot exposes an HTTP API for tasks, agents, sheets, artefacts, scripts, and events. The full machine-readable specification is served at:

```text
GET /openapi.yaml
```

It is also in the repository as [`openapi.yaml`](https://github.com/jorisvddonk/sheetbot/blob/main/openapi.yaml). This page is a practical map of the endpoints; use the OpenAPI file for exact schemas.

## Base URL and authentication

Use the same URL you open in the browser, for example `http://localhost:3000` or `https://sheetbot.example.com`.

Authenticate with a JWT:

```bash
TOKEN=$(curl -sS -X POST "$SHEETBOT_BASEURL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}' \
  | jq -r .token)
```

Or exchange an API key:

```bash
TOKEN=$(curl -sS -X POST "$SHEETBOT_BASEURL/login" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\":\"$SHEETBOT_AUTH_APIKEY\"}" \
  | jq -r .token)
```

Send `Authorization: Bearer $TOKEN` on authenticated requests. Most endpoints enforce a permission; see [Configure permissions](../how-to/configure-permissions.md).

## Common status codes

| Code | Meaning |
|---|---|
| `200` | Success with a JSON or text body. |
| `204` | Success with no body (updates and deletes). |
| `400` | Invalid input, missing task, or malformed JSON. |
| `401` | Missing or invalid credentials. |
| `403` | Authenticated but missing a permission. |
| `404` | Resource not found. |
| `409` | Conflict, such as a duplicate key. |
| `500` | Server error. Check the server log. |

## Authentication and metadata

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/login` | Exchange username/password or API key for a JWT. |
| `GET` | `/` | Web UI. |
| `GET` | `/openapi.yaml` | OpenAPI specification. |
| `GET` | `/widgets.json` | Discovered widget module URLs. |

## Tasks

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/tasks` | `viewTasks` | List tasks. |
| `POST` | `/tasks` | `createTasks` | Create a task. |
| `GET` | `/tasks/{id}` | `viewTasks` | Get a task. |
| `PATCH` | `/tasks/{id}` | `updateTasks` | Update status or fields. |
| `DELETE` | `/tasks/{id}` | `deleteTasks` | Delete a task. |
| `POST` | `/tasks/get` | `performTasks` | Poll for a matching task (agents). |
| `POST` | `/tasks/{id}/accept` | `performTasks` | Mark the task `RUNNING`. |
| `POST` | `/tasks/{id}/complete` | `performTasks` | Complete with `{ "data": ... }`. |
| `POST` | `/tasks/{id}/failed` | `performTasks` | Mark the task `FAILED`. |
| `POST` | `/tasks/{id}/data` | `performTasks` | Merge data into the task. |
| `POST` | `/tasks/{id}/clone` | `createTasks` | Clone a task and its artefacts. |
| `POST` | `/tasks/{id}/artefacts` | `performTasks` | Upload a file (`multipart/form-data`, field `file`). |
| `GET` | `/tasks/{id}/artefacts/{filename}` | none | Redirect to an artefact; the direct URL needs `viewArtefacts`. |
| `DELETE` | `/tasks/{id}/artefacts/{filename}` | `deleteTasks` | Delete an artefact. |

Create a task:

```bash
curl -X POST "$SHEETBOT_BASEURL/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello",
    "script": "console.log(\"hello\")",
    "type": "node",
    "data": {},
    "transitions": []
  }'
```

Poll as an agent:

```bash
curl -X POST "$SHEETBOT_BASEURL/tasks/get" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"node","capabilities":{"os":"linux","arch":"x86_64"}}'
```

Status values: `0` awaiting, `1` running, `2` completed, `3` failed, `4` paused, `5` deleted.

## Scripts and library

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/library` | Library metadata: name, data, capabilities, comments, transitions. |
| `GET` | `/scripts/agent.ts` | Deno agent template. |
| `GET` | `/scripts/agent.js` | Node.js agent template. |
| `GET` | `/scripts/agent.py` | Python agent template. |
| `GET` | `/scripts/agent.sh` | Bash agent template. |
| `GET` | `/scripts/{id}.{ext}` | Task script with dependency injection. |
| `GET` | `/scripts/{uuid}` | Task script. |

The agent template endpoints replace `${req.protocol}` and `${req.get('host')}` with the request origin, so a downloaded agent points back at the server that served it.

## Sheets

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/sheets` | optional login | Anonymous callers see public sheets; logged-in callers see all. |
| `GET` | `/sheets/{id}` | public or login | Read columns and rows. |
| `POST` | `/sheets/{id}/data` | `putSheetData` | Upsert a row by `key`. |
| `DELETE` | `/sheets/{id}/data/{key}` | `putSheetData` | Delete a row. |
| `GET` | `/sheets/{id}/public` | `manageSheetPermissions` | Read the public grant. |
| `PUT` | `/sheets/{id}/public` | `manageSheetPermissions` | Set `{ "public": true/false }`. |

Upsert a row:

```bash
curl -X POST "$SHEETBOT_BASEURL/sheets/build-status/data" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"linux-x64","name":"Linux x64","status":2,"progress":100}'
```

The sheet is created on the first write. See [Sheet database](sheet-database.md) and [Working with sheets](../tutorials/working-with-sheets.md).

## Artefacts and buckets

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `POST` | `/artefacts-credentials` | login | Issue temporary AWS-compatible credentials. |
| `POST` | `/artefacts/{bucket}/{prefix}` | `createArtefacts` | Start a multipart upload. |
| `PUT` | `/artefacts/{bucket}/{prefix}` | `createArtefacts` | Upload raw bytes. |
| `GET` | `/artefacts/{bucket}` | `viewArtefacts` | List a bucket. |
| `GET` | `/artefacts/{bucket}/{prefix}` | `viewArtefacts` | List a prefix or read a file. |
| `DELETE` | `/artefacts/{path}` | `deleteArtefacts` | Delete bucket files. |
| `GET` | `/artefacts/public` | none | List the public bucket. |
| `GET` | `/artefacts/public/{path}` | none | Read a public file. |

Upload a bucket file with JWT:

```bash
curl -X PUT "$SHEETBOT_BASEURL/artefacts/reports/report.txt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: text/plain" \
  --data-binary @report.txt
```

See [Working with artefacts](../tutorials/working-with-artefacts.md) and [Artefacts](artefacts.md).

## Events and metrics

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/events` | login | Server-Sent Events for task and agent changes. |
| `GET` | `/tasktracker` | login | Task execution statistics (`?minutes=60`). |
| `GET` | `/agenttracker` | login | Agent activity statistics. |
| `GET` | `/transitiontracker` | login | Transition evaluation statistics. |

Subscribe to events:

```bash
curl -N -H "Authorization: Bearer $TOKEN" "$SHEETBOT_BASEURL/events"
```

## Errors

Errors are usually plain text or JSON with an `error` field. A `403` means the JWT is valid but lacks the required permission; a `401` means the JWT is missing, expired, or invalid. Agent templates translate these into `Unauthenticated` and `Unauthorized`.

## Next

- [OpenAPI specification](https://github.com/jorisvddonk/sheetbot/blob/main/openapi.yaml) — exact request and response schemas.
- [Protocol](protocol.md) — task lifecycle and state diagram.
- [Agent runtime API](agent-runtime.md) — the agent-specific contract.
