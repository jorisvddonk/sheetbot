import { DatabaseSync } from "node:sqlite";
import { createInjectDependenciesMiddleware, createGetScriptMiddleware, createGetTaskMiddleware } from "../middleware.ts";
import { getTask } from "../tasks.ts";

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