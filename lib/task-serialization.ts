import type { Task } from "./models.ts";

export type PublicTask = Omit<Task, "leaseId">;

/**
 * Remove the task lease token before a task leaves the server through a read
 * API or the SSE stream. The token is returned only by POST /tasks/:id/accept.
 */
export function toPublicTask(task: Task): PublicTask {
    const { leaseId, ...publicTask } = task;
    return publicTask;
}
