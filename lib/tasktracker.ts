import { TaskEventEmitter, TaskEvent, TaskEventData } from './task-events.ts';

export class TaskTracker {
    private added: number[] = [];
    private completed: number[] = [];
    private failed: number[] = [];

    constructor(eventEmitter: TaskEventEmitter) {
        // Listen to task events instead of direct method calls
        eventEmitter.on(TaskEvent.CREATED, (data: TaskEventData) => {
            this.added.push(data.timestamp);
        });

        eventEmitter.on(TaskEvent.COMPLETED, (data: TaskEventData) => {
            this.completed.push(data.timestamp);
        });

        eventEmitter.on(TaskEvent.FAILED, (data: TaskEventData) => {
            this.failed.push(data.timestamp);
        });

        // Clean up old entries every hour to keep data up to 1 day
        setInterval(() => this.cleanup(1440), 3600000);
    }

    getStats(minutes: number) {
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        const cutoff = now - windowMs;

        const addedCount = this.added.filter(ts => ts > cutoff).length;
        const completedCount = this.completed.filter(ts => ts > cutoff).length;
        const failedCount = this.failed.filter(ts => ts > cutoff).length;

        return {
            added: addedCount,
            completed: completedCount,
            failed: failedCount,
            windowMinutes: minutes
        };
    }

    private cleanup(maxMinutes: number) {
        const now = Date.now();
        const cutoff = now - (maxMinutes * 60 * 1000);

        // Remove entries older than maxMinutes (currently 1440 minutes = 1 day)
        this.added = this.added.filter(ts => ts > cutoff);
        this.completed = this.completed.filter(ts => ts > cutoff);
        this.failed = this.failed.filter(ts => ts > cutoff);
    }
}