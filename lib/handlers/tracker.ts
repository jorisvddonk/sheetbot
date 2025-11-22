import { TaskTracker } from "../tasktracker.ts";
import { AgentTracker } from "../agenttracker.ts";
import { TransitionTracker } from "../transitiontracker.ts";

/**
 * Creates a handler that retrieves task execution statistics and metrics.
 * @param {TaskTracker} taskTracker - The task tracker instance
 * @returns {Function} Express route handler function
 */
export function createGetTaskTrackerHandler(taskTracker: TaskTracker) {
    return (req: any, res: any) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(taskTracker.getStats(minutes));
    };
}

/**
 * Creates a handler that retrieves agent activity statistics and metrics.
 * @param {AgentTracker} agentTracker - The agent tracker instance
 * @returns {Function} Express route handler function
 */
export function createGetAgentTrackerHandler(agentTracker: AgentTracker) {
    return (req: any, res: any) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(agentTracker.getStats(minutes));
    };
}

/**
 * Creates a handler that retrieves task transition evaluation statistics.
 * @param {TransitionTracker} transitionTracker - The transition tracker instance
 * @returns {Function} Express route handler function
 */
export function createGetTransitionTrackerHandler(transitionTracker: TransitionTracker) {
    return (req: any, res: any) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(transitionTracker.getStats(minutes));
    };
}