# API Keys

SheetBot supports API key authentication as an alternative to username/password authentication. API keys are long-lived credentials that can be scoped with specific permissions.

## Overview

API keys provide a secure way to authenticate agents and scripts without storing passwords. They can be restricted to specific permissions, enabling the creation of "downscoped" keys for read-only access or other limited operations.

## Creating API Keys

Use the `addapikey.ts` script to generate API keys for existing users:

```bash
deno run -A addapikey.ts
```

The script will prompt for:
- **Username**: The user who will own this API key
- **Key name**: A descriptive name for the key (optional, defaults to "default")
- **Permissions**: Comma-separated list of permissions or `*` for all permissions

### Permissions

When creating an API key, you can specify permissions to restrict what the key can do:

- **`*`** - Inherit all permissions from the user (default)
- **Specific permissions** - Comma-separated list like `viewTasks,performTasks`
- **Empty/subset** - Any subset of the user's permissions

**Important**: API keys can never have more permissions than the user who owns them. If you request permissions the user doesn't have, only the intersection of requested and user permissions will be granted.

### Example

```bash
$ deno run -A addapikey.ts
username: alice
key name (optional) [default]: readonly-apikey
permissions (separate with commas or use * for all) [*]: viewTasks

Generating key...

API Key generated successfully:
----------------------------------------
550e8400-e29b-41d4-a716-446655440000.a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
----------------------------------------
Keep this key safe! You won't be able to see it again.
```

## Using API Keys

### Environment Variable

Set the `SHEETBOT_AUTH_APIKEY` environment variable instead of `SHEETBOT_AUTH_USER` and `SHEETBOT_AUTH_PASS`:

```bash
export SHEETBOT_AUTH_APIKEY=your.api.key
export SHEETBOT_BASEURL=http://localhost:3000
deno run --allow-net --allow-env --allow-read ${SHEETBOT_BASEURL}/scripts/agent.ts
```

### Login Endpoint

API keys can be exchanged for JWT tokens via the `/login` endpoint:

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "your.api.key"}'
```

This returns a JWT token with the effective permissions (intersection of user permissions and key permissions):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Permission Scoping

API keys support "downscoping" - restricting permissions below what the user has:

### Example Scenarios

1. **Full access key** (inherits all user permissions):
   ```
   Permissions: *
   ```

2. **Read-only key** (limited to viewing):
   ```
   Permissions: viewTasks,viewArtefacts
   ```

3. **Agent-only key** (for task execution):
   ```
   Permissions: performTasks,createArtefacts,viewArtefacts
   ```

### Effective Permissions Calculation

When an API key is used to authenticate, the effective permissions are calculated as:

- If user has `*`: effective = key permissions
- If key has `*`: effective = user permissions  
- Otherwise: effective = intersection(user permissions, key permissions)

This ensures API keys can never escalate privileges beyond what the user has.

## Supported Agents

All agent templates support API key authentication:

### Deno/TypeScript Agent
```bash
export SHEETBOT_AUTH_APIKEY=your.api.key
deno run --reload -A ${SHEETBOT_BASEURL}/scripts/agent.ts
```

### Python Agent
```bash
export SHEETBOT_AUTH_APIKEY=your.api.key
uv run --script ${SHEETBOT_BASEURL}/scripts/agent.py
```

### Bash Agent
```bash
export SHEETBOT_AUTH_APIKEY=your.api.key
curl -fsSL ${SHEETBOT_BASEURL}/scripts/agent.sh | bash
```

## Distributed Runtime

The distributed runtime also supports API keys via environment variables:

```bash
export SHEETBOT_DISPATCH_AUTH_APIKEY=your.api.key
# Or falls back to:
export SHEETBOT_AUTH_APIKEY=your.api.key
```

## Security Best Practices

1. **Store securely**: Treat API keys like passwords. Never commit them to version control.
2. **Use environment variables**: Load keys from environment variables, not hardcoded in scripts.
3. **Scope appropriately**: Create keys with minimal required permissions.
4. **Rotate regularly**: Generate new keys periodically and revoke old ones.
5. **One key per use case**: Create separate keys for different agents or purposes.

## Database Storage

API keys are stored in the `api_keys` table in `users.db`:

```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,           -- UUID prefix of the key
    user_id TEXT NOT NULL,          -- Associated user
    key_hash TEXT NOT NULL,         -- Bcrypt hash of the secret
    name TEXT,                      -- Descriptive name
    created_at INTEGER,             -- Creation timestamp
    permissions TEXT,               -- Comma-separated permissions or *
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Only the hash of the secret portion is stored. The full key is shown only once when created.

## API Key Format

API keys have the format: `{id}.{secret}`

- **id**: UUID for fast database lookup
- **secret**: Long random string for authentication

Example: `550e8400-e29b-41d4-a716-446655440000.a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

## Troubleshooting

### Login fails with API key

- Verify the key is correct (copy-paste carefully)
- Check that the user still exists
- Ensure the key hasn't been revoked (deleted from database)

### Permission denied errors

- Check the effective permissions of the API key
- Verify the user has the required permissions
- Remember: API keys can't exceed user permissions

### Key not working after user permission change

API keys inherit permissions dynamically at login time. If a user's permissions are reduced, their API keys will also have reduced effective permissions on next use.
