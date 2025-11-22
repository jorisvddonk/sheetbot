import express from "npm:express@4.18.3";
import { createInjectDependenciesMiddleware, createGetScriptMiddleware, createGetTaskMiddleware } from "../lib/middleware.ts";
import { getTask } from "../lib/tasks.ts";
import { DatabaseSync } from "node:sqlite";

export function setupScriptRoutes(app: express.Application, db: DatabaseSync) {
    const getTaskMiddleware = createGetTaskMiddleware((id) => getTask(db, id));
    const getScript = createGetScriptMiddleware((id) => getTask(db, id));
    const injectDependencies = createInjectDependenciesMiddleware((id) => getTask(db, id));

    app.use('/scripts', express.static('scripts'));
    app.get("/scripts/agent(\.ts|\.py)?", (req, res) => {
        if (req.path.endsWith(".py")) {
            res.contentType("text/x-python");
            res.send(new TextDecoder().decode(
                Deno.readFileSync("./scripts/agent.template.py")
            )
            .replaceAll("${req.protocol}", req.protocol)
            .replaceAll("${req.get('host')}", req.get('host')
            ));
        } else {
            if (req.path.endsWith(".ts")) {
                res.contentType("application/typescript");
            } else if (req.path.endsWith(".js")) {
                res.contentType("application/javascript");
            }
            res.send(new TextDecoder().decode(
                Deno.readFileSync("./scripts/agent.template.ts")
            )
            .replaceAll("${req.protocol}", req.protocol)
            .replaceAll("${req.get('host')}", req.get('host')
            ));
        }
    });

    app.get("/scripts/:id\.?.*", getTaskMiddleware, getScript, injectDependencies, (req, res) => {
        const task = res.locals.task;
        if (task) {
            if (req.path.endsWith(".ts")) {
                res.contentType("application/typescript");
            } else if (req.path.endsWith(".js")) {
                res.contentType("application/javascript");
            } else if (req.path.endsWith(".py")) {
                res.contentType("text/x-python");
            }
            res.send(res.locals.script);
        } else {
            res.status(404);
            res.send();
        }
    });
}