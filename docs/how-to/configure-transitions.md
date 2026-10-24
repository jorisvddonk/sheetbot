# Configure task transitions

Transitions change a task's status automatically. They can delete finished tasks, retry failures, re-arm recurring tasks, or enforce timeouts.

Transitions are stored on the task as an array. Each transition has:

```json
{
  "statuses": ["COMPLETED"],
  "condition": {},
  "timing": { "immediate": true },
  "transitionTo": "DELETED",
  "dataMutations": {}
}
```

| Field | Meaning |
|---|---|
| `statuses` | Status names where this transition is active: `AWAITING`, `RUNNING`, `COMPLETED`, `FAILED`, `PAUSED`, `DELETED`. |
| `condition` | JSON Schema evaluated against the whole task. `{}` matches every task. |
| `timing.immediate` | Evaluate immediately when the task enters a matching status. |
| `timing.every` | Evaluate repeatedly at an interval: `30s`, `5m`, `1h`, `1d`. |
| `transitionTo` | New status, or `DELETED` to remove the task. |
| `dataMutations` | Optional object merged into task data before the transition runs. |

Immediate transitions use first-match order. Scheduled transitions re-check the condition when they fire and are re-scheduled while the task remains in a matching status.

## Add transitions to a task

Use the **Transitions** field in the add-task form, a library script's `<transitions>` annotation, or the API:

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "one-shot build",
    "script": "console.log(\"done\")",
    "type": "node",
    "transitions": [
      {
        "statuses": ["COMPLETED"],
        "condition": {},
        "timing": { "immediate": true },
        "transitionTo": "DELETED"
      }
    ]
  }' \
  "$SHEETBOT_BASEURL/tasks"
```

The caller needs `createTasks`.

## Auto-delete a successful task

```json
[
  {
    "statuses": ["COMPLETED"],
    "condition": {},
    "timing": { "immediate": true },
    "transitionTo": "DELETED"
  }
]
```

`DELETED` removes the task and removes it from other tasks' `dependsOn` lists. Use this for ephemeral CI jobs that should not accumulate.

## Retry a failed task

```json
[
  {
    "statuses": ["FAILED"],
    "condition": {},
    "timing": { "every": "1m", "immediate": false },
    "transitionTo": "AWAITING"
  }
]
```

The task returns to the queue after one minute. Agents can pick it up again.

To retry only once, create the task with `"data": {"retryCount": 0}` and use a condition that only matches the initial value. `dataMutations` then marks the task as retried:

```json
[
  {
    "statuses": ["FAILED"],
    "condition": {
      "type": "object",
      "properties": {
        "data": {
          "type": "object",
          "properties": {
            "retryCount": { "type": "number", "maximum": 0 }
          },
          "required": ["retryCount"]
        }
      }
    },
    "timing": { "every": "1m" },
    "transitionTo": "AWAITING",
    "dataMutations": { "retryCount": 1 }
  }
]
```

The first failure matches and sets `retryCount` to `1`. If the retried task fails again, the condition no longer matches and the task stays `FAILED`. `dataMutations` merges values; it does not increment numbers. Use task data or a script if you need a true counter.

## Re-arm a recurring task

```json
[
  {
    "statuses": ["COMPLETED"],
    "condition": {},
    "timing": { "every": "5m", "immediate": false },
    "transitionTo": "AWAITING"
  }
]
```

This is the pattern used by the library's counter example. The task becomes `AWAITING` again five minutes after completion, and any matching agent can run it.

## Time out a waiting task

```json
[
  {
    "statuses": ["AWAITING"],
    "condition": {},
    "timing": { "every": "1h", "immediate": false },
    "transitionTo": "FAILED"
  }
]
```

After an hour in `AWAITING`, the task becomes `FAILED`. While it remains `AWAITING`, the schedule is refreshed; once the status changes, the stale schedule is removed on the next check.

## Conditions

`condition` is a JSON Schema applied to the full task object, including `status`, `data`, `artefacts`, `dependsOn`, and `transitions`. Examples:

Require a successful build result:

```json
{
  "type": "object",
  "properties": {
    "data": {
      "type": "object",
      "properties": {
        "exitCode": { "const": 0 }
      },
      "required": ["exitCode"]
    }
  }
}
```

Require an artefact:

```json
{
  "type": "object",
  "properties": {
    "artefacts": {
      "type": "array",
      "contains": { "const": "report.html" }
    }
  }
}
```

An empty object `{}` always matches. An invalid condition fails validation and the transition does not run; check the server log and `/transitiontracker` when debugging.

## Inspect transitions

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/transitiontracker?minutes=60" | jq
```

Scheduled transitions are stored in `transitions_schedule` in `tasks.db`. A background worker checks them. Deleting a task also removes its schedules.

## Next

- [Protocol](../reference/protocol.md) — task state diagram and failure flow.
- [Writing a library script](../tutorials/writing-a-library-script.md) — suggest transitions from a script.
- [Debug a failed task](debug-failed-tasks.md) — diagnose transitions that did not fire.
