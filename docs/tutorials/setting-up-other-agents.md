# Setting up other agents

The SheetBot server does not execute task scripts itself. Agents poll the server, claim matching tasks, run the scripts, and report the result. The [Getting started](getting-started.md) tutorial uses the Node.js agent; this tutorial sets up the Deno, Python, and Bash agents.

You can run agents on the same machine as the server or on any other machine that can reach it.

## Before you start

You need:

- The SheetBot base URL, for example `http://localhost:3000` or `https://sheetbot.example.com`.
- A user or API key with permission to perform tasks.
- The runtime for the agent you want to use.
- A working directory for the agent. The templates read optional `.capabilities*.json` files from the current directory.

Set the common environment variables first:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password
```

For unattended agents, prefer an API key instead of a password:

```bash
export SHEETBOT_AUTH_APIKEY=your.api.key
unset SHEETBOT_AUTH_USER SHEETBOT_AUTH_PASS
```

See [Using API keys for agents](using-api-keys-for-agents.md) for a step-by-step setup, or [Manage API keys](../how-to/manage-api-keys.md) for the full reference.

Agents poll once per invocation. Run the command again, put it in a loop, or schedule it with cron, systemd, launchd, or another scheduler.

## Deno agent

The Deno agent runs TypeScript tasks with `type: "deno"`.

Requirements: Deno 2 or newer.

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

deno run -A "$SHEETBOT_BASEURL/scripts/agent.ts"
```

`-A` grants all permissions. The agent needs network access, environment access, and permission to import the task script from the SheetBot host. Since agents execute arbitrary task code, full permissions are the simplest choice.

To narrow permissions, allow the SheetBot host for imports as well as network:

```bash
deno run \
  --allow-net \
  --allow-env \
  --allow-read \
  --allow-import=localhost:3000 \
  "$SHEETBOT_BASEURL/scripts/agent.ts"
```

Replace `localhost:3000` with the host and port of your SheetBot server.

## Python agent

The Python agent runs tasks with `type: "python"`.

Requirements: [`uv`](https://docs.astral.sh/uv/) and Python 3.12 or newer. The template declares its own dependencies, so `uv` installs `requests` automatically.

```bash
mkdir -p ~/sheetbot-agent
cd ~/sheetbot-agent
curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.py" -o agent.py
uv run --script agent.py
```

You can also use the template's shebang:

```bash
chmod +x agent.py
./agent.py
```

The Python agent executes task scripts with `uv` when they contain a `/// script` dependency block, and with plain Python otherwise.

## Bash agent

The Bash agent runs tasks with `type: "bash"`.

Requirements: Bash, `curl`, and `jq`.

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.sh" | bash
```

The agent checks for `curl` and `jq` before doing anything. On Windows, use WSL or Git Bash.

Bash task scripts normally omit a shebang. If a script starts with `#!`, the agent executes it directly and treats its standard output as the completion data, so that output must be valid JSON. Inline scripts (no shebang) are run with `bash` and report empty data unless they set a `data` variable.

## Verify an agent

Create a task of the same type as the agent, then run the agent. In the add-task page, set **Task Type** to `deno`, `python`, or `bash` and use a matching script:

```typescript
// Deno
console.log("hello from Deno");
```

```python
# Python
print("hello from Python")
```

```bash
# Bash
echo "hello from Bash"
```

The task should move from `AWAITING` to `RUNNING` and then `COMPLETED`. The script output appears in the agent terminal.

For a fuller task-creation walkthrough, see [Your first task](your-first-task.md). Remember to change the task type to match the agent.

## Keep an agent running

A simple loop is enough for a dedicated machine:

```bash
while true; do
  curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.sh" | bash
  sleep 5
done
```

The same pattern works with the other templates: run the agent command, sleep, and repeat. If you use cron instead, run the one-shot command on your desired schedule.

Do not start more agents than you need. Each agent polls independently, and any agent with a matching type can claim a task.

## Limit which tasks an agent receives

By default, the templates report basic capabilities such as OS, architecture, and hostname. You can add static, dynamic, and override capabilities in the agent's working directory:

- `.capabilities.json` — static JSON.
- `.capabilities.dynamic.ts`, `.dynamic.py`, or `.dynamic.sh` — runtime detection.
- `.capabilities.override.json` — final overrides.

Example `.capabilities.json`:

```json
{
  "tools": {
    "git": true,
    "cmake": true
  },
  "labels": ["linux-builder"]
}
```

Tasks use a `capabilitiesSchema` to require matching capabilities. See [Declare capabilities](../how-to/declare-capabilities.md) for the full merge order and examples.

## Troubleshooting

- **`Unauthenticated`** — check `SHEETBOT_AUTH_USER` / `SHEETBOT_AUTH_PASS`, or the API key.
- **`Unauthorized`** — the user or API key lacks the permission to perform tasks.
- **The agent exits without running anything** — no task matched. Check the task type and its `capabilitiesSchema`.
- **`curl: command not found` or `jq: command not found`** — install the missing tool for the Bash agent.
- **`uv: command not found`** — install `uv` for the Python agent.
- **Deno cannot import the task** — use `-A` or add `--allow-import` for the SheetBot host.

## Next

- [Agent runtime API](../reference/agent-runtime.md) — implement your own agent in another language.
- [Declare capabilities](../how-to/declare-capabilities.md) — target tasks at specific machines.
- [Manage API keys](../how-to/manage-api-keys.md) — run agents without storing a password.
