# Using API keys for agents

In this tutorial you create a dedicated user and a scoped API key, then run an agent with the key instead of a password. This is the recommended setup for unattended agents running in cron, systemd, launchd, or CI.

## Why use an API key?

Passwords are meant for interactive logins. An API key:

- Can be scoped to only the permissions an agent needs.
- Can be rotated without changing the user's password.
- Can be unique per agent or per machine.
- Is shown only once, so it is easy to keep out of source control.

API keys still belong to a user. The effective permissions are the intersection of the user's permissions and the key's permissions, so a key can never grant more than its owner has.

## 1. Create an agent user

On the machine running SheetBot:

```bash
npm run adduser
```

Use a descriptive username and a strong password:

```text
username: agent-runner
password: <strong password>
permissions: performTasks,putSheetData,viewTasks
```

`performTasks` lets the agent poll, accept, complete, and fail tasks. `putSheetData` is only needed if your tasks write to sheets. Add `createArtefacts` and `viewArtefacts` if tasks use the S3-compatible artefact API.

You do not need `createTasks` for an agent. Create tasks with an admin account or a separate automation user.

## 2. Create a scoped API key

Generate a key for that user:

```bash
npm run addapikey
```

Use the same permissions as the user, or a narrower subset:

```text
username: agent-runner
key name (optional) [default]: builder-agent
permissions (separate with commas or use * for all) [*]: performTasks,putSheetData,viewTasks
```

The key is printed once:

```text
550e8400-e29b-41d4-a716-446655440000.a1b2c3d4e5f6...
```

Copy it somewhere safe immediately. SheetBot stores only a hash and cannot show the key again. If you lose it, create a new key and revoke the old one.

Use `*` to inherit the user's permissions:

```text
permissions (separate with commas or use * for all) [*]: *
```

## 3. Store the key on the agent machine

Create an environment file that only your user can read:

```bash
mkdir -p ~/sheetbot-agent
cd ~/sheetbot-agent

umask 077
cat > agent.env <<'EOF'
SHEETBOT_BASEURL=http://localhost:3000
SHEETBOT_AUTH_APIKEY=your.api.key
EOF
```

Load it in the shell that runs the agent:

```bash
set -a
. ~/sheetbot-agent/agent.env
set +a
```

Do not commit `agent.env` to git. For systemd, use `EnvironmentFile=`; for launchd, put the variables in the plist's `EnvironmentVariables`; for cron, source the file from a wrapper script.

If you previously exported `SHEETBOT_AUTH_USER` or `SHEETBOT_AUTH_PASS`, unset them so the agent does not fall back to password authentication:

```bash
unset SHEETBOT_AUTH_USER SHEETBOT_AUTH_PASS
```

## 4. Run an agent with the key

All agent templates read `SHEETBOT_AUTH_APIKEY`.

### Node.js

```bash
curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.js" | node
```

### Deno

```bash
deno run -A "$SHEETBOT_BASEURL/scripts/agent.ts"
```

### Python

```bash
curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.py" -o agent.py
uv run --script agent.py
```

### Bash

```bash
curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.sh" | bash
```

See [Setting up other agents](setting-up-other-agents.md) for prerequisites and scheduler examples.

## 5. Verify the key

Exchange the key for a JWT manually:

```bash
curl -sS -X POST "$SHEETBOT_BASEURL/login" \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\":\"$SHEETBOT_AUTH_APIKEY\"}"
```

A successful response contains a `token`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Then create a task with a matching type and run the agent. The task should move to `RUNNING` and then `COMPLETED`. If the key is scoped too narrowly, the agent logs `Unauthorized` or `Forbidden`.

## 6. Rotate or revoke a key

To rotate, create a new key for the same user, update `agent.env`, restart or rerun the agent, then revoke the old key.

List keys (the secret is not stored, so only metadata is shown):

```bash
sqlite3 users.db \
  "SELECT id, name, user_id, permissions, datetime(created_at / 1000, 'unixepoch') FROM api_keys;"
```

Revoke a key by deleting its `id`:

```bash
sqlite3 users.db "DELETE FROM api_keys WHERE id = '550e8400-e29b-41d4-a716-446655440000';"
```

The next login with that key fails. Stop SheetBot first if SQLite reports that the database is locked.

## Troubleshooting

- **`Login failed with API key`** — the key is wrong, was revoked, or belongs to a deleted user.
- **`Unauthorized` / `Forbidden`** — the key or its user lacks the required permission.
- **Agent still asks for a password** — `SHEETBOT_AUTH_USER` / `SHEETBOT_AUTH_PASS` are still set. Unset them.
- **A task completes but sheet writes fail** — add `putSheetData` to both the user and the key.
- **Artefact uploads fail** — add `performTasks`, `createArtefacts`, and `viewArtefacts` as needed.

## Next

- [Manage API keys](../how-to/manage-api-keys.md) — full reference for key creation, scoping, and storage.
- [Configure permissions](../how-to/configure-permissions.md) — see every available permission.
- [Agent runtime API](../reference/agent-runtime.md) — implement a custom agent that reads `SHEETBOT_AUTH_APIKEY`.
