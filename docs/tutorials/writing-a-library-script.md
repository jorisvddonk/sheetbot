# Writing a library script

Library scripts are reusable task templates. They appear on the **Library** page and in `addtask.ts`, and can prefill the task name, data, capability requirements, comments, and transitions.

In this tutorial you add a Python library script, inspect how its annotations map to the add-task form, and run it with an agent.

## 1. Create the script

Create `library/hello_library.py`:

```python
# <name>Hello from the library</name>
#
# <addTaskComments>
# A minimal library script. The annotations prefill the add-task form.
# </addTaskComments>
#
# <data>
# {
#   "message": "hello from the library"
# }
# </data>
#
# <capabilitiesSchema>
# {
#   "type": "object",
#   "properties": {
#     "os": { "type": "string" }
#   },
#   "required": ["os"]
# }
# </capabilitiesSchema>

import json
import os
import urllib.request

request = urllib.request.Request(
    os.environ["SHEETBOT_TASK_BASEURL"],
    headers={"Authorization": os.environ["SHEETBOT_AUTHORIZATION_HEADER"]},
)

with urllib.request.urlopen(request) as response:
    task = json.load(response)

print(task["data"].get("message", "hello"))
```

SheetBot discovers `.ts`, `.js`, `.py`, and `.sh` files in `library/`. No registration step is needed.

## 2. Inspect it in the Library

Open <http://localhost:3000/library> or refresh the page. The script appears as **Hello from the library**.

The annotations are parsed by the server and returned from `GET /library`:

- `<name>` — suggested task name.
- `<data>` — suggested JSON task data.
- `<capabilitiesSchema>` — JSON Schema that an agent's capabilities must match.
- `<addTaskComments>` — explanatory text shown while adding the task.
- `<transitions>` — optional JSON array of transitions to prefill.

For JSON blocks, lines whose first non-whitespace character is `#` are ignored, so the JSON can live inside comments in any language.

You can inspect the parsed metadata directly:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$SHEETBOT_BASEURL/library" | jq '.[] | select(.filename == "hello_library.py")'
```

## 3. Create a task from it

Click **Add Task** next to the script. The add-task form is prefilled with:

- The suggested name.
- The suggested data, `{"message": "hello from the library"}`.
- The capabilities schema.
- The comments.

The Python extension selects the `python` task type. If you use a `.js` file, the UI treats it as a Deno task; create a Node.js task manually with type `node` instead.

Submit the task, then run a Python agent:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

mkdir -p ~/sheetbot-agent
cd ~/sheetbot-agent
curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.py" -o agent.py
uv run --script agent.py
```

The script reads its own task data from `SHEETBOT_TASK_BASEURL` and prints the message. The task moves to `COMPLETED`.

## 4. Add transitions (optional)

A library script can suggest transitions. This example re-arms a completed task after five minutes:

```python
# <transitions>
# [
#   {
#     "statuses": ["COMPLETED"],
#     "condition": {},
#     "timing": { "every": "5m", "immediate": false },
#     "transitionTo": "AWAITING"
#   }
# ]
# </transitions>
```

Add this block to the script and refresh the Library page. New tasks created from the script include the transition. See [Task transitions](../how-to/configure-transitions.md) for the full transition model.

## 5. Use additional library paths

Keep project-specific scripts outside the repository by setting `SHEETBOT_LIBRARY_SEARCH_PATH` to a colon-separated list:

```bash
export SHEETBOT_LIBRARY_SEARCH_PATH="/opt/sheetbot-scripts:$HOME/my-sheetbot-scripts"
```

The default `./library/` directory is always searched first. See [Configure library paths](../how-to/configure-library-paths.md) for details.

## Next

- [Widgets](../reference/widgets.md) — render task data in sheets.
- [Library script annotations](../reference/library-script-annotations.md) — the annotation reference.
- [Setting up other agents](setting-up-other-agents.md) — run the script with Deno, Node.js, or Bash instead.
