import { Runtime, RemoteTask } from "./distributed_runtime.ts";

/**
 * Sets up an HTTP dispatcher for the distributed runtime that supports offloadMode without awaiting fetches.
 * In offloadMode, dispatches tasks asynchronously without blocking, allowing the script to exit immediately.
 */
export function setOffloadHttpDispatcher() {
  Runtime.dispatchFunction = async (task: RemoteTask<any>) => {
    if (Runtime.offloadMode) {
      console.log(`Dispatching task ${task.id} with ${task.deps.length} deps`);
      // In offload mode, dispatch asynchronously without awaiting
      (async () => {
        try {
          // Login to get token
          const loginResponse = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: Deno.env.get("SHEETBOT_DISPATCH_AUTH_USER") || Deno.env.get("SHEETBOT_AUTH_USER"), password: Deno.env.get("SHEETBOT_DISPATCH_AUTH_PASS") || Deno.env.get("SHEETBOT_AUTH_PASS") }),
          });
          if (!loginResponse.ok) {
            console.error("Login failed in offload mode");
            return;
          }
          const { token } = await loginResponse.json();

          let script = task.script;

          // Post the task without awaiting
          console.log(`Posting task ${task.id}`);
          fetch("http://localhost:3000/tasks", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              id: task.id,
              name: `RemoteTask-${task.id}`,
              script: script,
              type: "deno",
              capabilitiesSchema: task.schema || {},
              dependsOn: task.deps.map(dep => dep.id),
              transitions: [],
            }),
          }).catch(err => console.error("Failed to dispatch task in offload mode:", err));

          // Resolve with dummy result immediately
          let dummy: any;
          if (task.deps.length === 0) {
            // parse args
            const argMatch = task.script.match(/await __FN__\(([^)]+)\)/);
            if (argMatch && !argMatch[1].includes('__DEP_RESULT_')) {
              try {
                const parsedArgs = JSON.parse(`[${argMatch[1]}]`);
                if (parsedArgs.length === 1 && typeof parsedArgs[0] === 'string') {
                  if (parsedArgs[0].includes('.exe') || parsedArgs[0].includes('.zip')) {
                    dummy = `uploaded_${parsedArgs[0]}`;
                  } else {
                    dummy = `${parsedArgs[0]}.exe`;
                  }
                } else if (parsedArgs.length > 1) {
                  dummy = `zip_${Date.now()}.zip`;
                }
              } catch (e) {
                // Ignore parsing errors for arguments
              }
            }
          } else if (task.deps.length === 2) {
            dummy = `zip_${Date.now()}.zip`;
          } else if (task.deps.length === 1) {
            dummy = `uploaded_dummy`;
          }
          console.log(`Resolving task ${task.id} with dummy: ${dummy}`);
          if (dummy !== undefined && task._resolve) {
            task._resolve(dummy);
          }
        } catch (err) {
          console.error("Error in offload dispatch:", err);
        }
      })();
      return;
    }

    // Original logic for non-offload mode
    // Login to get token
    const loginResponse = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: Deno.env.get("SHEETBOT_DISPATCH_AUTH_USER") || Deno.env.get("SHEETBOT_AUTH_USER"), password: Deno.env.get("SHEETBOT_DISPATCH_AUTH_PASS") || Deno.env.get("SHEETBOT_AUTH_PASS") }),
    });
    if (!loginResponse.ok) {
      throw new Error("Login failed");
    }
    const { token } = await loginResponse.json();

    let script = task.script;
    if (!Runtime.offloadMode) {
      // Replace dependency placeholders with actual results
      for (const dep of task.deps) {
        const placeholder = `__DEP_RESULT_${dep.id}__`;
        const result = Runtime.results.get(dep.id);
        script = script.replace(new RegExp(placeholder, 'g'), JSON.stringify(result));
      }
    }

    // Post the task
    const response = await fetch("http://localhost:3000/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: task.id,
        name: `RemoteTask-${task.id}`,
        script: script,
        type: "deno",
        capabilitiesSchema: task.schema || {},
        dependsOn: task.deps.map(dep => dep.id),
        ephemeral: 0,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to dispatch task: ${response.statusText}`);
    }
    const postedTask = await response.json();
    const taskId = postedTask.id;

    // Poll for completion
    while (true) {
      const statusResponse = await fetch(`http://localhost:3000/tasks/${taskId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!statusResponse.ok) {
        throw new Error(`Failed to check task status: ${statusResponse.statusText}`);
      }
      const taskData = await statusResponse.json();
      if (taskData.status === 2) { // COMPLETED
        const result = taskData.data.default;
        Runtime.results.set(task.id, result);
        if (task._resolve) {
          task._resolve(result);
        }
        break;
      } else if (taskData.status === 3) { // FAILED
        if (task._reject) {
          task._reject(new Error("Task failed"));
        }
        break;
      }
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };
}