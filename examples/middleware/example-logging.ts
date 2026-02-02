/**
 * Example middleware that adds custom logging and a 404 handler
 * 
 * To use this middleware:
 * 1. Set SHEETBOT_MIDDLEWARE_SEARCH_PATHS to include this directory
 * 2. Start SheetBot
 */

export function setupMiddleware(app: any) {
    // Pre-route middleware: log all requests with custom format
    app.use((req: any, res: any, next: any) => {
        console.log(`[CUSTOM] ${req.method} ${req.path} from ${req.ip}`);
        next();
    });
}

export function setupPostRouteMiddleware(app: any) {
    // Post-route middleware: custom 404 handler
    app.use((req: any, res: any) => {
        console.log(`[CUSTOM] 404: ${req.method} ${req.path}`);
        res.status(404).json({
            error: "Not Found",
            path: req.path,
            method: req.method,
            message: "The requested resource does not exist"
        });
    });
}
