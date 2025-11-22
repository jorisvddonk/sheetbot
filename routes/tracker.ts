import express from "npm:express@4.18.3";
import { TaskTracker } from "../lib/tasktracker.ts";
import { AgentTracker } from "../lib/agenttracker.ts";
import { TransitionTracker } from "../lib/transitiontracker.ts";
import { requiresLogin } from "../lib/auth.ts";

export function setupTrackerRoutes(app: express.Application, taskTracker: TaskTracker, agentTracker: AgentTracker, transitionTracker: TransitionTracker) {
    app.get("/tasktracker", requiresLogin, (req, res) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(taskTracker.getStats(minutes));
    });

    app.get("/agenttracker", requiresLogin, (req, res) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(agentTracker.getStats(minutes));
    });

    app.get("/transitiontracker", requiresLogin, (req, res) => {
        const minutes = parseInt(req.query.minutes as string) || 1440;
        res.json(transitionTracker.getStats(minutes));
    });
}