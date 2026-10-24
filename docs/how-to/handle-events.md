# Event Handlers

SheetBot supports loading custom event handlers from external directories via the `SHEETBOT_EVENTHANDLER_SEARCH_PATHS` environment variable.

## Usage

Set the environment variable to a colon-separated list of directories:

```bash
export SHEETBOT_EVENTHANDLER_SEARCH_PATHS="/path/to/handlers:/another/path"
```

SheetBot will search these directories for `.ts` files and load any that export a `setupEventHandlers` function.

## Event Handler Structure

Create a TypeScript file that exports a `setupEventHandlers` function:

```typescript
// my-handler.ts
import { TaskEvent } from "./lib/task-events.ts";
import { AgentEvent } from "./lib/agent-events.ts";

export function setupEventHandlers(emitters: {
    taskEventEmitter: any;
    agentEventEmitter: any;
    taskTracker: any;
    agentTracker: any;
    transitionTracker: any;
}) {
    const { taskEventEmitter, agentEventEmitter } = emitters;

    // Listen for task events
    taskEventEmitter.on(TaskEvent.ADDED, (data: any) => {
        console.log(`Custom handler: Task ${data.taskId} added`);
    });

    taskEventEmitter.on(TaskEvent.STATUS_CHANGED, (data: any) => {
        console.log(`Custom handler: Task ${data.taskId} status changed`);
    });

    // Listen for agent events
    agentEventEmitter.on(AgentEvent.CONNECTED, (data: any) => {
        console.log(`Custom handler: Agent ${data.agentId} connected`);
    });
}
```

## Available Emitters

The `setupEventHandlers` function receives an object with the following properties:

- `taskEventEmitter` - TaskEventEmitter instance for task events
- `agentEventEmitter` - AgentEventEmitter instance for agent events
- `taskTracker` - TaskTracker instance for task metrics
- `agentTracker` - AgentTracker instance for agent metrics
- `transitionTracker` - TransitionTracker instance for transition metrics

## Example Use Cases

### Notification System

```typescript
export function setupEventHandlers({ taskEventEmitter }: any) {
    taskEventEmitter.on(TaskEvent.FAILED, async (data: any) => {
        await sendSlackNotification(`Task ${data.taskId} failed!`);
    });
}
```

### Metrics Collection

```typescript
export function setupEventHandlers({ taskEventEmitter }: any) {
    taskEventEmitter.on(TaskEvent.COMPLETED, (data: any) => {
        // Send metrics to monitoring system
        sendMetric("task.completed", 1, { taskId: data.taskId });
    });
}
```

### Custom Logging

```typescript
export function setupEventHandlers({ taskEventEmitter, agentEventEmitter }: any) {
    taskEventEmitter.on(TaskEvent.CHANGED, (data: any) => {
        logToFile(`Task ${data.taskId} changed: ${JSON.stringify(data.changes)}`);
    });

    agentEventEmitter.on(AgentEvent.CONNECTED, (data: any) => {
        logToFile(`Agent ${data.agentId} connected from ${data.ip}`);
    });
}
```

## Loading Order

Event handlers are loaded:
1. After the database and event emitters are initialized
2. Before the Express app starts
3. In alphabetical order by filename within each directory
4. Directories are processed in the order specified in `SHEETBOT_EVENTHANDLER_SEARCH_PATHS`

## Error Handling

- If a directory doesn't exist or isn't accessible, it's skipped with a warning
- If a handler file fails to load or execute, an error is logged but other handlers continue loading
- The server will start even if all event handlers fail to load
