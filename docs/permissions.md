# Permissions System

SheetBot uses a role-based access control (RBAC) system to manage user permissions. Permissions control what actions a user can perform on various resources within the system.

## How Permissions Work

- Permissions are assigned to users during user creation (via `adduser.ts`).
- Permissions are stored as a comma-separated string in the user database.
- When a user logs in, their permissions are included in the JWT token as an array.
- API endpoints use middleware to check if the user has the required permission(s).
- A user with the `*` permission has access to all features.

## Available Permissions

The following permissions are defined in the system:

### Task Management
- `viewTasks`: Allows viewing tasks and their details.
- `createTasks`: Allows creating new tasks.
- `updateTasks`: Allows updating task properties (e.g., status, configuration).
- `deleteTasks`: Allows deleting tasks.
- `performTasks`: Allows accepting, completing, failing, or updating task data, and uploading/downloading task artefacts.

### Sheets
- `putSheetData`: Allows inserting, updating, and deleting data in sheets.

### Artefacts
- `viewArtefacts`: Allows listing and viewing artefacts.
- `createArtefacts`: Allows uploading and creating artefacts.
- `deleteArtefacts`: Allows deleting artefacts.

## Assigning Permissions

Permissions are assigned when creating a new user using the `adduser.ts` script:

```bash
deno run adduser.ts
```

You will be prompted to enter:
- Username
- Password
- Permissions (comma-separated list, or `*` for all permissions)

Example:
```
permissions (separate with commas or use * for all): createTasks,viewTasks,performTasks
```

## Permission Checking

The system uses middleware functions:
- `requiresLogin`: Verifies the user is authenticated via JWT token.
- `requiresPermission(permission)`: Checks if the user has the specified permission or the wildcard `"*"`.

If a user lacks the required permission, the API returns a `403 Forbidden` response with the message "Forbidden - insufficient permissions".

## Database Storage

User permissions are stored in the `users.db` SQLite database in the `permissions` column as a TEXT field containing a comma-separated list of permissions.