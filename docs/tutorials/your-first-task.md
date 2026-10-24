# Your first task

In this tutorial you create a small JavaScript task, let a Node.js agent execute it, and confirm that it completed.

## 1. Create the task

1. Open <http://localhost:3000/addtask.html> and log in if prompted.
2. Under **Script Source**, select **Manual**.
3. Set **Task Type** to **Other (specify)** and enter `node`.
4. Enter a task name, for example `Hello from SheetBot`.
5. Paste this script:

```javascript
console.log("Hello from SheetBot");
```

6. Leave **Status** set to **Awaiting**.
7. Click **Add Task** and note the task ID.

## 2. Start the agent

In a terminal with your credentials exported:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_USER=your_username
export SHEETBOT_AUTH_PASS=your_password

curl -fsSL "$SHEETBOT_BASEURL/scripts/agent.js" | node
```

The agent requests a task of type `node`, accepts it, runs the script, and reports completion. The script's `console.log` output appears in the agent terminal. Because the agent polls once and exits, start it after creating the task, or run it in a loop.

## 3. Check the result

Open the task in the web UI. Its status should change from `AWAITING` to `RUNNING` and then `COMPLETED`.

## Next

- Learn how tasks report data and dependency injection works in [Data management](../reference/data-management.md).
- See how to write reusable scripts in [Library script annotations](../reference/library-script-annotations.md).
- Browse the [how-to guides](../how-to/index.md) for configuration and extension tasks.
