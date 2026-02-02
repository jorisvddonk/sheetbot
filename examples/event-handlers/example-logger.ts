/**
 * Example event handler that logs task and agent events
 * 
 * To use this handler:
 * 1. Set SHEETBOT_EVENTHANDLER_SEARCH_PATHS=/path/to/sheetbot/examples/event-handlers
 * 2. Start SheetBot
 * 3. This handler will log all task and agent events to the console
 */

export function setupEventHandlers(emitters: any) {
    const { taskEventEmitter, agentEventEmitter } = emitters;

    // Task events
    taskEventEmitter.on("task:added", (data: any) => {
        console.log(`[EVENT] Task added: ${data.taskId} (${data.task.name || 'unnamed'})`);
    });

    taskEventEmitter.on("task:status_changed", (data: any) => {
        const statusNames = ["AWAITING", "RUNNING", "COMPLETED", "FAILED", "PAUSED"];
        console.log(`[EVENT] Task ${data.taskId} status: ${statusNames[data.oldStatus]} → ${statusNames[data.newStatus]}`);
    });

    taskEventEmitter.on("task:deleted", (data: any) => {
        console.log(`[EVENT] Task deleted: ${data.taskId}`);
    });

    // Agent events
    agentEventEmitter.on("agent:connected", (data: any) => {
        console.log(`[EVENT] Agent connected: ${data.agentId}`);
    });

    agentEventEmitter.on("agent:disconnected", (data: any) => {
        console.log(`[EVENT] Agent disconnected: ${data.agentId}`);
    });

    console.log("[EVENT HANDLER] Example logging handler loaded");
}
