export function createGetTaskMiddleware(getTaskFn: (id: string) => any) {
    return (req: any, res: any, next: any) => {
        const task = getTaskFn(req.params.id);
        if (task) {
            res.locals.task = task;
        }
        next();
    };
}

export function createGetScriptMiddleware(getTaskFn: (id: string) => any) {
    return (req: any, res: any, next: any) => {
        const task = res.locals.task || getTaskFn(req.params.id);
        if (task) {
            res.locals.script = task.script;
        }
        next();
    };
}

export function createInjectDependenciesMiddleware(getTaskFn: (id: string) => any) {
    return (req: any, res: any, next: any) => {
        const task = res.locals.task || getTaskFn(req.params.id);
        if (task && res.locals.script) {
            let script = res.locals.script;
            // Replace dependency placeholders with actual results
            for (const depId of task.dependsOn) {
                const placeholder = `__DEP_RESULT_${depId}__`;
                const depTask = getTaskFn(depId);
                if (depTask && depTask.data && depTask.data.default !== undefined) {
                    const result = depTask.data.default;
                    script = script.replace(new RegExp(placeholder, 'g'), JSON.stringify(result));
                }
            }
            res.locals.script = script;
        }
        next();
    };
}