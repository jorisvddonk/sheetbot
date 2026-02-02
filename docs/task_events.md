# Task Events

SheetBot emits events whenever tasks are added, changed, deleted, or their status changes. These events are emitted at the database level to ensure they always trigger properly.

## Event Types

The following events are available:

- `task:added` - Emitted when a new task is added to the database
- `task:changed` - Emitted when any task property changes (data, artefacts, etc.)
- `task:status_changed` - Emitted when a task's status changes
- `task:deleted` - Emitted when a task is deleted
- `task:created` - Legacy event (kept for compatibility)
- `task:completed` - Legacy event (kept for compatibility)
- `task:failed` - Legacy event (kept for compatibility)

## Usage

The `TaskEventEmitter` is available globally in `main.ts` and can be accessed to listen for events:

```typescript
import { TaskEventEmitter, TaskEvent } from "./lib/task-events.ts";

// Get the global event emitter (passed through your code)
const taskEventEmitter = new TaskEventEmitter();

// Listen for task additions
taskEventEmitter.on(TaskEvent.ADDED, (data) => {
    console.log(`Task added: ${data.taskId}`, data.task);
});

// Listen for status changes
taskEventEmitter.on(TaskEvent.STATUS_CHANGED, (data) => {
    console.log(`Task ${data.taskId} status changed from ${data.oldStatus} to ${data.newStatus}`);
});

// Listen for any task changes
taskEventEmitter.on(TaskEvent.CHANGED, (data) => {
    console.log(`Task ${data.taskId} changed:`, data.changes);
});

// Listen for task deletions
taskEventEmitter.on(TaskEvent.DELETED, (data) => {
    console.log(`Task deleted: ${data.taskId}`);
});
```

## Event Data Structures

### TaskEventData
```typescript
{
    taskId: string;
    timestamp: number;
    metadata?: Record<string, any>;
}
```

### TaskChangedEventData
```typescript
{
    taskId: string;
    timestamp: number;
    task: Task;
    changes?: Record<string, any>;
}
```

### TaskStatusChangedEventData
```typescript
{
    taskId: string;
    timestamp: number;
    task: Task;
    oldStatus: TaskStatus;
    newStatus: TaskStatus;
}
```

## Implementation Details

Events are emitted at the lowest level (database operations) to ensure they always trigger:

- `addTask()` - Emits `task:added`
- `updateTaskStatus()` - Emits `task:status_changed` and `task:changed`
- `updateTaskData()` - Emits `task:changed`
- `updateTaskAddArtefact()` - Emits `task:changed`
- `updateTaskRemoveArtefact()` - Emits `task:changed`
- `deleteTask()` - Emits `task:deleted`

Transitions also trigger these events when they execute, ensuring all task modifications are tracked.

## Example: Custom Notification System

```typescript
// In an init script or custom module
taskEventEmitter.on(TaskEvent.STATUS_CHANGED, async (data) => {
    if (data.newStatus === TaskStatus.FAILED) {
        // Send notification when a task fails
        await sendNotification(`Task ${data.taskId} failed!`);
    }
});

taskEventEmitter.on(TaskEvent.COMPLETED, async (data) => {
    // Log completed tasks
    console.log(`Task ${data.taskId} completed successfully`);
});
```
