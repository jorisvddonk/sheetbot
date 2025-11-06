/**
 * Creates middleware that fetches a task by ID from the request parameters
 * and stores it in res.locals.task for use by subsequent middlewares.
 * @param getTaskFn Function to retrieve a task by ID
 * @returns Express middleware function
 */
export function createGetTaskMiddleware(getTaskFn: (id: string) => any) {
    return (req: any, res: any, next: any) => {
        const task = getTaskFn(req.params.id);
        if (task) {
            res.locals.task = task;
        }
        next();
    };
}

/**
 * Creates middleware that retrieves the script from a task and stores it in res.locals.script.
 * Uses res.locals.task if available, otherwise fetches the task using getTaskFn.
 * @param getTaskFn Function to retrieve a task by ID
 * @returns Express middleware function
 */
export function createGetScriptMiddleware(getTaskFn: (id: string) => any) {
    return (req: any, res: any, next: any) => {
        const task = res.locals.task || getTaskFn(req.params.id);
        if (task) {
            res.locals.script = task.script;
        }
        next();
    };
}

/**
 * Creates middleware that injects dependency results into the script stored in res.locals.script.
 * Replaces placeholders like __DEP_RESULT_{depId}__ with the actual results from completed dependencies.
 * Uses res.locals.task if available, otherwise fetches the task using getTaskFn.
 * @param getTaskFn Function to retrieve a task by ID
 * @returns Express middleware function
 */
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