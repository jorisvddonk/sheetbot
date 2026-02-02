# Custom Middleware

SheetBot supports loading custom Express middleware from external directories via the `SHEETBOT_MIDDLEWARE_SEARCH_PATHS` environment variable.

## Usage

Set the environment variable to a colon-separated list of directories:

```bash
export SHEETBOT_MIDDLEWARE_SEARCH_PATHS="/path/to/middleware:/another/path"
```

SheetBot will search these directories for `.ts` files and load any that export `setupMiddleware` and/or `setupPostRouteMiddleware` functions.

## Middleware Types

### Pre-Route Middleware

Runs **before** route handlers. Use for:
- Authentication/authorization
- Request logging
- CORS configuration
- Rate limiting
- Request validation
- Body parsing modifications
- Custom headers

Export a `setupMiddleware(app)` function:

```typescript
export function setupMiddleware(app: any) {
    // Add middleware that runs before routes
    app.use((req: any, res: any, next: any) => {
        console.log("Custom pre-route middleware");
        next();
    });
}
```

### Post-Route Middleware

Runs **after** route handlers. Use for:
- 404 handlers
- Error handlers
- Fallback responses

Export a `setupPostRouteMiddleware(app)` function:

```typescript
export function setupPostRouteMiddleware(app: any) {
    // Add middleware that runs after routes
    app.use((req: any, res: any, next: any) => {
        res.status(404).json({ error: "Not found" });
    });
}
```

### Both Types

A single file can export both functions:

```typescript
export function setupMiddleware(app: any) {
    // Pre-route middleware
    app.use((req: any, res: any, next: any) => {
        req.customData = "something";
        next();
    });
}

export function setupPostRouteMiddleware(app: any) {
    // Post-route middleware
    app.use((req: any, res: any) => {
        res.status(404).json({ error: "Route not found" });
    });
}
```

## Examples

### CORS Middleware

```typescript
export function setupMiddleware(app: any) {
    app.use((req: any, res: any, next: any) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        
        if (req.method === "OPTIONS") {
            return res.sendStatus(200);
        }
        
        next();
    });
}
```

### Rate Limiting

```typescript
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function setupMiddleware(app: any) {
    app.use((req: any, res: any, next: any) => {
        const ip = req.ip || "unknown";
        const now = Date.now();
        const limit = rateLimits.get(ip);
        
        if (!limit || now > limit.resetAt) {
            rateLimits.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
            return next();
        }
        
        if (limit.count >= 100) {
            return res.status(429).json({ error: "Rate limit exceeded" });
        }
        
        limit.count++;
        next();
    });
}
```

### Custom Authentication

```typescript
export function setupMiddleware(app: any) {
    app.use((req: any, res: any, next: any) => {
        const apiKey = req.headers["x-api-key"];
        
        if (req.path.startsWith("/api/") && !apiKey) {
            return res.status(401).json({ error: "API key required" });
        }
        
        // Validate API key
        if (apiKey && !isValidApiKey(apiKey)) {
            return res.status(403).json({ error: "Invalid API key" });
        }
        
        next();
    });
}

function isValidApiKey(key: string): boolean {
    // Your validation logic
    return key === Deno.env.get("VALID_API_KEY");
}
```

### Custom 404 Handler

```typescript
export function setupPostRouteMiddleware(app: any) {
    app.use((req: any, res: any) => {
        res.status(404).json({
            error: "Not Found",
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
    });
}
```

### Error Handler

```typescript
export function setupPostRouteMiddleware(app: any) {
    app.use((err: any, req: any, res: any, next: any) => {
        console.error("Error:", err);
        res.status(err.status || 500).json({
            error: err.message || "Internal Server Error",
            timestamp: new Date().toISOString()
        });
    });
}
```

## Loading Order

1. SheetBot's built-in middleware (logging, body parsing, static files)
2. Custom pre-route middleware from `SHEETBOT_MIDDLEWARE_SEARCH_PATHS` (alphabetically by filename)
3. SheetBot's route handlers
4. Custom post-route middleware from `SHEETBOT_MIDDLEWARE_SEARCH_PATHS` (alphabetically by filename)

Within each directory, middleware files are loaded in alphabetical order.

## Error Handling

- If a middleware directory doesn't exist or isn't accessible, it's skipped with a warning
- If a middleware file fails to load or execute, an error is logged but other middleware continues loading
- The server will start even if all middleware fails to load

## Access to SheetBot Components

Middleware has full access to the Express app instance. To access SheetBot-specific components (database, event emitters, etc.), you can:

1. Import them directly from SheetBot's modules
2. Store references in `app.locals` from an init script
3. Use environment variables for configuration

Example using init script:

```typescript
// In an init script
import { openDatabase } from "./lib/db.ts";

export default function() {
    // Store DB reference for middleware to use
    globalThis.sheetbotDb = openDatabase();
}
```

```typescript
// In middleware
export function setupMiddleware(app: any) {
    const db = (globalThis as any).sheetbotDb;
    
    app.use((req: any, res: any, next: any) => {
        // Use db here
        next();
    });
}
```
