import { EventEmitter } from "node:events";

export enum TaskEvent {
  CREATED = 'task:created',
  COMPLETED = 'task:completed',
  FAILED = 'task:failed'
}

export interface TaskEventData {
  taskId: string;
  timestamp: number;
  metadata?: Record<string, any>;
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
}