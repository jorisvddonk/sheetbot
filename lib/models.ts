export interface Transition {
    statuses: string[],
    condition: Record<string, unknown>,
    timing: {
        every?: string,
        immediate?: boolean
    },
    transitionTo: string,
    dataMutations?: Record<string, unknown>
}

export interface Task {
    id: string,
    name?: string,
    script: string,
    status: TaskStatus,
    data: Record<string, unknown>,
    artefacts: string[],
    dependsOn: string[],
    transitions: Transition[],
    type: string,
    capabilitiesSchema: Record<string, unknown>
}

export enum TaskStatus {
    AWAITING = 0,
    RUNNING = 1,
    COMPLETED = 2,
    FAILED = 3,
    PAUSED = 4,
    DELETED = 5,
}

export enum Ephemeralness {
    PERSISTENT = 0, // task will not get auto-deleted on completion
    EPHEMERAL_ON_SUCCESS = 1, // task will get auto-deleted, but only if completed successful; this allows you to debug failures
    EPHEMERAL_ALWAYS = 2 // task will get auto-deleted when completed, regardless of if it completed succesfully or not
}

export function statusToString(status: TaskStatus): string {
    switch (status) {
        case TaskStatus.AWAITING: return "AWAITING";
        case TaskStatus.RUNNING: return "RUNNING";
        case TaskStatus.COMPLETED: return "COMPLETED";
        case TaskStatus.FAILED: return "FAILED";
        case TaskStatus.PAUSED: return "PAUSED";
        case TaskStatus.DELETED: return "DELETED";
        default: return "UNKNOWN";
    }
}

export function stringToStatus(statusStr: string): TaskStatus {
    switch (statusStr) {
        case "AWAITING": return TaskStatus.AWAITING;
        case "RUNNING": return TaskStatus.RUNNING;
        case "COMPLETED": return TaskStatus.COMPLETED;
        case "FAILED": return TaskStatus.FAILED;
        case "PAUSED": return TaskStatus.PAUSED;
        case "DELETED": return TaskStatus.DELETED;
        default: return TaskStatus.AWAITING;
    }
}