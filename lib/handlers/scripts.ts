import { DatabaseSync } from "node:sqlite";
import { createInjectDependenciesMiddleware, createGetScriptMiddleware, createGetTaskMiddleware } from "../middleware.ts";
import { getTask } from "../tasks.ts";

/**
 * Creates a handler that serves agent template scripts for different languages.
 * Dynamically replaces protocol and host placeholders in the template.
 * @returns {Function} Express route handler function
 */
export function createGetAgentTemplateHandler() {
    return (req: any, res: any) => {
        if (req.path.endsWith(".py")) {
            res.contentType("text/x-python");
            res.send(new TextDecoder().decode(
                Deno.readFileSync("./scripts/agent.template.py")
            )
            .replaceAll("${req.protocol}", req.protocol)
            .replaceAll("${req.get('host')}", req.get('host')
            ));
        } else if (req.path.endsWith(".sh")) {
            res.contentType("text/x-shellscript");
            res.send(new TextDecoder().decode(
                Deno.readFileSync("./scripts/agent.template.sh")
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
    };
}

/**
 * Creates a handler that serves task scripts with dependency injection.
 * Applies middleware to inject dependencies and serve the processed script.
 * @param {DatabaseSync} db - The SQLite database instance
 * @returns {Array} Array of middleware and handler functions for Express
 */
export function createGetTaskScriptHandler(db: DatabaseSync) {
    const getTaskMiddleware = createGetTaskMiddleware((id) => getTask(db, id));
    const getScript = createGetScriptMiddleware((id) => getTask(db, id));
    const injectDependencies = createInjectDependenciesMiddleware((id) => getTask(db, id));

    return [
        getTaskMiddleware,
        getScript,
        injectDependencies,
        (req: any, res: any) => {
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
        }
    ];
}