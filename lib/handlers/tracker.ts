import { TaskTracker } from "../tasktracker.ts";
import { AgentTracker } from "../agenttracker.ts";
import { TransitionTracker } from "../transitiontracker.ts";

export function createGetTaskTrackerHandler(taskTracker: TaskTracker) {
    return (req: any, res: any) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(taskTracker.getStats(minutes));
    };
}

export function createGetAgentTrackerHandler(agentTracker: AgentTracker) {
    return (req: any, res: any) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(agentTracker.getStats(minutes));
    };
}

export function createGetTransitionTrackerHandler(transitionTracker: TransitionTracker) {
    return (req: any, res: any) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(transitionTracker.getStats(minutes));
    };
}