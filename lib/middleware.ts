export function createInjectDependenciesMiddleware(getTaskFn: (id: string) => any) {
    return (req: any, res: any, next: any) => {
        const task = getTaskFn(req.params.id);
        if (task) {
            let script = task.script;
            // Replace dependency placeholders with actual results
            for (const depId of task.dependsOn) {
                const placeholder = `__DEP_RESULT_${depId}__`;
                const depTask = getTaskFn(depId);
                if (depTask && depTask.data && depTask.data.default !== undefined) {
                    const result = depTask.data.default;
                    script = script.replace(new RegExp(placeholder, 'g'), JSON.stringify(result));
                }
            }
            res.locals.injectedScript = script;
        }
        next();
    };
}