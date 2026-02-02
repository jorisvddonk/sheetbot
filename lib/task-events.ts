import { EventEmitter } from "node:events";
import { Task, TaskStatus } from "./models.ts";

export enum TaskEvent {
  CREATED = 'task:created',
  COMPLETED = 'task:completed',
  FAILED = 'task:failed',
  ADDED = 'task:added',
  CHANGED = 'task:changed',
  STATUS_CHANGED = 'task:status_changed',
  DELETED = 'task:deleted'
}

export interface TaskEventData {
  taskId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TaskChangedEventData extends TaskEventData {
  task: Task;
  changes?: Record<string, any>;
}

export interface TaskStatusChangedEventData extends TaskEventData {
  task: Task;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
}

export class TaskEventEmitter extends EventEmitter {
  emitTaskCreated(taskId: string, metadata?: Record<string, any>) {
    this.emit(TaskEvent.CREATED, { taskId, timestamp: Date.now(), metadata });
  }

  emitTaskCompleted(taskId: string, metadata?: Record<string, any>) {
    this.emit(TaskEvent.COMPLETED, { taskId, timestamp: Date.now(), metadata });
  }

  emitTaskFailed(taskId: string, metadata?: Record<string, any>) {
    this.emit(TaskEvent.FAILED, { taskId, timestamp: Date.now(), metadata });
  }

  emitTaskAdded(task: Task) {
    this.emit(TaskEvent.ADDED, { taskId: task.id, timestamp: Date.now(), task });
  }

  emitTaskChanged(task: Task, changes?: Record<string, any>) {
    this.emit(TaskEvent.CHANGED, { taskId: task.id, timestamp: Date.now(), task, changes });
  }

  emitTaskStatusChanged(task: Task, oldStatus: TaskStatus, newStatus: TaskStatus) {
    this.emit(TaskEvent.STATUS_CHANGED, { taskId: task.id, timestamp: Date.now(), task, oldStatus, newStatus });
  }

  emitTaskDeleted(taskId: string) {
    this.emit(TaskEvent.DELETED, { taskId, timestamp: Date.now() });
  }
}