import { TaskEventEmitter } from "../task-events.ts";
import { AgentEventEmitter } from "../agent-events.ts";
import { TaskEvent } from "../task-events.ts";
import { AgentEvent } from "../agent-events.ts";

/**
 * Creates a handler that provides Server-Sent Events (SSE) for task and agent events.
 * Clients can subscribe to this endpoint to receive real-time event notifications.
 * 
 * @param {TaskEventEmitter} taskEventEmitter - The task event emitter instance
 * @param {AgentEventEmitter} agentEventEmitter - The agent event emitter instance
 * @returns {Function} Express route handler function for SSE
 */
export function createEventsSSEHandler(
  taskEventEmitter: TaskEventEmitter,
  agentEventEmitter: AgentEventEmitter
) {
  return (req: any, res: any) => {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

    // Send initial connection event
    res.write(": connected\n\n");

    // Event handler to send task events
    const handleTaskEvent = (event: string, data: any) => {
      const eventData = {
        type: "task",
        event,
        data: {
          taskId: data.taskId,
          timestamp: data.timestamp,
          ...(data.task && { task: data.task }),
          ...(data.changes && { changes: data.changes }),
          ...(data.oldStatus !== undefined && { oldStatus: data.oldStatus }),
          ...(data.newStatus !== undefined && { newStatus: data.newStatus }),
          ...(data.metadata && { metadata: data.metadata })
        }
      };
      
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    // Event handler to send agent events
    const handleAgentEvent = (event: string, data: any) => {
      const eventData = {
        type: "agent",
        event,
        data: {
          id: data.id,
          ip: data.ip,
          type: data.type,
          timestamp: data.timestamp,
          ...(data.capabilities && { capabilities: data.capabilities }),
          ...(data.metadata && { metadata: data.metadata })
        }
      };
      
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    // Subscribe to all task events
    taskEventEmitter.on(TaskEvent.CREATED, (data) =>
      handleTaskEvent(TaskEvent.CREATED, data)
    );
    taskEventEmitter.on(TaskEvent.COMPLETED, (data) =>
      handleTaskEvent(TaskEvent.COMPLETED, data)
    );
    taskEventEmitter.on(TaskEvent.FAILED, (data) =>
      handleTaskEvent(TaskEvent.FAILED, data)
    );
    taskEventEmitter.on(TaskEvent.ADDED, (data) =>
      handleTaskEvent(TaskEvent.ADDED, data)
    );
    taskEventEmitter.on(TaskEvent.CHANGED, (data) =>
      handleTaskEvent(TaskEvent.CHANGED, data)
    );
    taskEventEmitter.on(TaskEvent.STATUS_CHANGED, (data) =>
      handleTaskEvent(TaskEvent.STATUS_CHANGED, data)
    );
    taskEventEmitter.on(TaskEvent.DELETED, (data) =>
      handleTaskEvent(TaskEvent.DELETED, data)
    );

    // Subscribe to all agent events
    agentEventEmitter.on(AgentEvent.CONNECTED, (data) =>
      handleAgentEvent(AgentEvent.CONNECTED, data)
    );

    // Cleanup event listeners on connection close
    req.on("close", () => {
      console.log("SSE connection closed");
      
      // Remove all task event listeners
      taskEventEmitter.removeAllListeners(TaskEvent.CREATED);
      taskEventEmitter.removeAllListeners(TaskEvent.COMPLETED);
      taskEventEmitter.removeAllListeners(TaskEvent.FAILED);
      taskEventEmitter.removeAllListeners(TaskEvent.ADDED);
      taskEventEmitter.removeAllListeners(TaskEvent.CHANGED);
      taskEventEmitter.removeAllListeners(TaskEvent.STATUS_CHANGED);
      taskEventEmitter.removeAllListeners(TaskEvent.DELETED);

      // Remove all agent event listeners
      agentEventEmitter.removeAllListeners(AgentEvent.CONNECTED);
    });

    // Handle connection timeout
    req.on("timeout", () => {
      console.log("SSE connection timed out");
      res.end();
    });
  };
}