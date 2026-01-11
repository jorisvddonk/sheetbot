# Initialization System

SheetBot includes an initialization system that runs TypeScript scripts on every startup. This system allows you to perform setup tasks, initialize databases, generate secrets, or load configurations before the main server starts.

## How It Works

- Place `.ts` files in the `./init/` directory
- Files are executed in lexicographic order based on their filenames (e.g., `00_init.ts`, `01_setup.ts`)
- Each script can export a default function (sync or async) which will be called during startup
- If the default export is not a function, the script is skipped
- Scripts run before the main server components are initialized

## Creating Init Scripts

Init scripts are simple TypeScript files that export a default function. The function can be synchronous or asynchronous.

### Basic Structure

```typescript
export default async function() {
    // Your initialization code here
    console.log("Running initialization...");
    // async operations are supported
}
```

### Example: Database Initialization

```typescript
import { initDatabaseTables } from "../lib/db.ts";

export default function() {
    console.log("Initializing database tables...");
    initDatabaseTables();
}
```

### Example: Secret Generation

```typescript
import { existsSync } from "https://deno.land/std@0.220.1/fs/mod.ts";

export default function() {
    const secretPath = "./secret.txt";

    if (existsSync(secretPath)) {
        console.log("Secret file already exists, skipping generation.");
        return;
    }

    console.log("Generating secret key...");

    // Generate a random ASCII secret (64 characters, printable ASCII)
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const secretArray = new Uint8Array(64);
    crypto.getRandomValues(secretArray);
    let secret = '';
    for (let i = 0; i < 64; i++) {
        secret += charset.charAt(secretArray[i] % charset.length);
    }

    Deno.writeTextFileSync(secretPath, secret);
    console.log("Secret key generated and saved to secret.txt");
}
```

### Example: Migration Script

```typescript
export default async function() {
    console.log("Running database migration...");

    // Migration logic here
    // For example, updating schema, transforming data, etc.

    console.log("Migration completed.");
}
```

## Best Practices

- Use descriptive filenames with numeric prefixes to control execution order
- Keep scripts focused on a single responsibility
- Handle errors appropriately - failing init scripts will stop server startup
- Scripts can access the filesystem and perform I/O operations
- Avoid long-running operations that delay server startup

## Execution Order

Scripts are sorted and executed in lexicographic order:

- `00_init.ts` runs first
- `01_setup.ts` runs second
- `10_migrate.ts` runs after the above

## Error Handling

If an init script throws an error, the server startup will fail. Ensure your scripts are robust and handle potential errors gracefully.

## Permissions

Init scripts run with the same permissions as the main server process. They can read and write files, access the network, and perform other operations allowed by the Deno permissions granted to `main.ts`.
