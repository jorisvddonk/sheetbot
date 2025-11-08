import { Runtime, RemoteTask } from "./distributed_runtime.ts";

/**
 * Sets up an HTTP dispatcher for the distributed runtime.
 * This dispatcher sends tasks to a server at http://localhost:3000 and polls for results.
 */
export function setHttpDispatcher() {
  Runtime.dispatchFunction = async (task: RemoteTask<any>) => {
    // Login to get token
    const loginResponse = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin" }),
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
        transitions: [], // Keep for inspection
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to dispatch task: ${response.statusText}`);
    }
    const postedTask = await response.json();
    const taskId = postedTask.id;

    if (Runtime.offloadMode) {
      // In offload mode, don't poll, just dispatch
      return;
    }

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