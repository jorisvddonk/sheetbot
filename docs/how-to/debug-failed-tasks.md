# Debug a failed task

When a task fails or never starts, the cause is usually in one of four places: the task definition, the agent, the script, or a transition. This guide walks through the checks in order.

## 1. Inspect the task

Get a token and fetch the task:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export TOKEN=$(curl -sS -X POST "$SHEETBOT_BASEURL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}' \
  | jq -r .token)

curl -sS -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/tasks/<task-id>" | jq
```

Check:

- `status` — `0` awaiting, `1` running, `2` completed, `3` failed, `4` paused, `5` deleted.
- `type` — must match an agent that is actually running.
- `capabilitiesSchema` — the agent's capabilities must satisfy it.
- `data` — the script may have written partial results.
- `artefacts` — expected output files.
- `dependsOn` — dependencies must be completed before the task can run.
- `transitions` — a transition may have moved the task unexpectedly.

If the task is missing, it may have been deleted by a `DELETED` transition or by an ephemeral task setting.

## 2. Read the agent output

Agent templates print errors to standard error. Where you look depends on how the agent runs:

- **Interactive terminal** — the `curl ... | bash`, `deno run`, `uv run`, or `node` output is directly in front of you.
- **systemd** — `journalctl -u sheetbot-agent -f`.
- **launchd** — the `StandardOutPath` and `StandardErrorPath` files from the plist.
- **cron** — redirect stdout/stderr to a log file in the crontab entry.

Common agent errors:

- `Unauthenticated` — bad credentials or revoked API key.
- `Unauthorized` / `Forbidden` — the user or key lacks `performTasks`.
- `No such file or directory` — a script interpreter or command is missing.
- `Script failed with exit code N` — the task script returned a non-zero status.
- `fetch failed` / `ECONNREFUSED` — the agent cannot reach `SHEETBOT_BASEURL`.

## 3. Check agent matching

The agent polls with its own `type` and capabilities. A task is only returned if both match.

Check which agents have checked in recently:

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/agenttracker?minutes=60" | jq
```

If no agent of the task's type appears, start one:

- `deno` — Deno agent
- `node`, `javascript`, `js`, `typescript`, `ts` — Node.js agent
- `python` — Python agent
- `bash` — Bash agent

See [Setting up other agents](../tutorials/setting-up-other-agents.md).

If an agent is present but gets nothing, compare its capabilities with the task's `capabilitiesSchema`. A schema requiring `packages` containing `cmake` will not match an agent that does not report `cmake`.

You can inspect the effective capabilities from the agent's working directory:

```bash
cat .capabilities.json
cat .capabilities.override.json
```

## 4. Watch task events live

Subscribe to the SSE stream:

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/events"
```

Events include task added, changed, status changed, completed, failed, and deleted, plus agent events. This is useful for seeing whether an agent accepted the task or whether a transition fired immediately.

## 5. Check execution and transition metrics

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/tasktracker?minutes=60" | jq
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/transitiontracker?minutes=60" | jq
```

The transition tracker records evaluation time and whether a transition matched. If a transition never fires, check its `statuses`, `condition`, and `timing`.

## 6. Requeue or reset a task

If an agent crashed while running a task, the task can remain `RUNNING`. A user with `updateTasks` can reset it:

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":0}' \
  "$SHEETBOT_BASEURL/tasks/<task-id>"
```

`0` is `AWAITING`. Use `4` for `PAUSED` if you want to stop it being picked up. Requeue only after fixing the underlying cause, or the same failure repeats.

## 7. Inspect script-specific failures

- **Node.js** — task scripts run as ESM because the repository uses `"type": "module"`. Use `import`, not `require`. Node strip-only TypeScript does not support enums or network imports.
- **Deno** — the agent imports the task script. If Deno blocks the import, run the agent with `-A` or add `--allow-import` for the SheetBot host.
- **Python** — scripts with a `/// script` block run through `uv`; others run inline in the agent process.
- **Bash** — a script starting with `#!` has its stdout treated as completion data, which must be valid JSON. Inline scripts are run with `bash`.

## 8. Check file and permission problems

- Task artefacts are under `artefacts/tasks/<task-id>/`.
- Sheet writes need `putSheetData`.
- Bucket uploads need `createArtefacts`; reads need `viewArtefacts`.
- Init, library, script, static, middleware, and event-handler directories must exist and be readable by the server user.
- SQLite errors usually mean the database is locked by another process or the directory is not writable.

## Quick checklist

| Symptom | Check |
|---|---|
| Task stays `AWAITING` | Matching agent running? Type and `capabilitiesSchema` match? |
| Task stays `RUNNING` | Agent crashed? Check agent logs, then reset to `AWAITING`. |
| Task is `FAILED` | Agent stderr, script exit code, missing dependencies. |
| Task disappears | `DELETED` transition or ephemeral task. |
| Sheet write fails | `putSheetData`, sheet name, SQLite permissions. |
| Artefact upload fails | `performTasks` or `createArtefacts`, file size limit (10 MB). |
| Transition does not fire | Status list, condition schema, timing, `/transitiontracker`. |

## Next

- [Task transitions](configure-transitions.md) — transition syntax and examples.
- [Agent workflow](../explanation/agent-workflow.md) — how polling and reporting work.
- [Task events](../reference/task-events.md) — event names and payloads.
