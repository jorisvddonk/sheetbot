# Agent Runtime API Contract

This document specifies the API contract for implementing agent runtimes that integrate with the Sheetbot distributed task execution system. It defines the endpoints, request/response formats, and behavioral expectations for new runtime implementations.

## Core Concepts

### Agent Templating System

Sheetbot provides a templating system to serve pre-built agent runtime implementations for different programming languages. These templates are stored as `agent.template.<extension>` files (e.g., `agent.template.py` for Python, `agent.template.ts` for TypeScript/Deno) and are served dynamically via the `/scripts/agent.template.<extension>` endpoint.

The templates contain boilerplate code that implements the full agent lifecycle:
- Authentication with the Sheetbot server
- Capability detection and declaration
- Task polling and execution
- Result reporting

When serving a template, Sheetbot replaces placeholders in the template code:
- `${req.protocol}` is replaced with the request protocol (e.g., "https")
- `${req.get('host')}` is replaced with the request host (e.g., "example.com")

This allows agents to be downloaded and run immediately, automatically connecting back to the originating Sheetbot server without manual configuration.

**Supported Extensions:**
- `.py`: Python agent template (uses `uv` for dependency management and script execution)
- `.ts`: TypeScript/Deno agent template
- `.js`: JavaScript agent template (served from the same `.ts` template with appropriate content-type)

Agents can load additional capabilities from local files:
- `.capabilities.json`: Static JSON capabilities
- `.capabilities.dynamic.<extension>`: Dynamic capability detection script
- `.capabilities.override.json`: Override capabilities

### Agent Lifecycle

Agents follow a polling-based execution model:

1. **Authentication** (optional): Obtain Bearer token for API access
2. **Task Discovery**: Poll for available tasks matching agent capabilities
3. **Task Acquisition**: Accept and prepare task for execution
4. **Script Execution**: Run task script in isolated environment
5. **Result Submission**: Report execution outcome to server

### Capabilities Declaration

Agents declare their execution capabilities to receive appropriate tasks. Capabilities are JSON objects with arbitrary structure, but should include basic system information.

### Environment Variables

Scripts receive execution context through environment variables set by the agent runtime.

## Authentication API

### POST /login

Authenticates an agent and returns a JWT token for subsequent API calls.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Body:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (Success - 200):**
```json
{
  "token": "jwt_token_string"
}
```

**Response (Error - 401/403/500):**
```json
{
  "error": "error_message"
}
```

**Usage:** Include `Authorization: Bearer <token>` header in all subsequent API requests.

## Capabilities Declaration

Agents declare their execution capabilities when requesting tasks. Capabilities are arbitrary JSON objects that help the server match tasks to suitable agents.

### Recommended Capability Fields

While capabilities can contain any JSON-serializable data, implementations should include:

- `os`: Operating system identifier (e.g., "linux", "darwin", "win32")
- `arch`: CPU architecture (e.g., "x86_64", "aarch64", "AMD64")
- `hostname`: Machine hostname for identification

### Capabilities Usage

Capabilities are submitted when polling for tasks and determine which tasks an agent receives.

### Usage

Capabilities are sent to `/tasks/get` endpoint to request matching tasks:

```json
{
  "type": "python", // or "deno", or something else...
  "capabilities": {
    "os": {
      "os": "linux"
    },
    "arch": "x86_64",
    "hostname": "myhost01"
  }
}
```

## Task Execution API

### POST /tasks/get

Polls for available tasks matching the agent's capabilities.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Authorization: `Bearer <token>` (if authenticated)
- Body:
```json
{
  "type": "runtime_type",
  "capabilities": {
    // agent capabilities object
  }
}
```

**Response (Task Available - 200):**
```json
{
  "id": "task-uuid",
  "script": "script_url",
  "type": "runtime_type"
}
```

**Response (No Task Available - 200):**
```json
{}
```

### GET /scripts/:id.*

Retrieves the executable script for a task. May include dependency injection placeholders replaced with data from completed prerequisite tasks.

**Request:**
- Method: `GET`
- Authorization: `Bearer <token>` (if authenticated)

**Response (Success - 200):**
- Content-Type: Appropriate for script language (e.g., `application/typescript`, `text/x-python`)
- Body: Script content with dependency injection applied

**Dependency Injection:**
Scripts may contain placeholders like `__DEP_RESULT_{task_id}__` that are replaced with JSON-stringified results from dependent tasks.

## Artefacts API

Tasks can have associated file artefacts for data sharing and persistence.

### POST /tasks/:id/artefacts

Uploads a file artefact for a task.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Authorization: `Bearer <token>` (if authenticated)
- Body: Form data with `file` field containing the file

**Response (Success - 200):**
```json
{
  "url": "download_url",
  "directURL": "direct_file_url"
}
```

### GET /tasks/:id/artefacts/:filename

Downloads a specific artefact file.

**Request:**
- Method: `GET`
- Authorization: `Bearer <token>` (if authenticated)

**Response (Success - 200):**
- Content-Type: Appropriate MIME type for the file
- Body: File content

### DELETE /tasks/:id/artefacts/:filename

Removes an artefact file from a task.

**Request:**
- Method: `DELETE`
- Authorization: `Bearer <token>` (if authenticated)

**Response (Success - 204):**
- No content

### Script Execution Environment

Agents must provide the following environment variables to executing scripts, constructed exactly as shown:

**Required Variables:**
- `SHEETBOT_BASEURL`: Base URL of the Sheetbot server
- `SHEETBOT_TASK_ID`: Task identifier (from task response `id` field)
- `SHEETBOT_AUTHORIZATION_HEADER`: Complete authorization header string (`Bearer <token>`)
- `SHEETBOT_TASK_BASEURL`: `{SHEETBOT_BASEURL}/tasks/{task_id}`
- `SHEETBOT_TASK_ACCEPTURL`: `{SHEETBOT_BASEURL}/tasks/{task_id}/accept`
- `SHEETBOT_TASK_COMPLETEURL`: `{SHEETBOT_BASEURL}/tasks/{task_id}/complete`
- `SHEETBOT_TASK_FAILEDURL`: `{SHEETBOT_BASEURL}/tasks/{task_id}/failed`
- `SHEETBOT_TASK_DATAURL`: `{SHEETBOT_BASEURL}/tasks/{task_id}/data`
- `SHEETBOT_TASK_ARTEFACTURL`: `{SHEETBOT_BASEURL}/tasks/{task_id}/artefacts`

**Construction Example:**
```javascript
// Assuming task = {id: "task-123"} and baseUrl = "https://example.com"
SHEETBOT_BASEURL = "https://example.com"
SHEETBOT_TASK_ID = "task-123"
SHEETBOT_AUTHORIZATION_HEADER = "Bearer eyJ..."
SHEETBOT_TASK_BASEURL = "https://example.com/tasks/task-123"
SHEETBOT_TASK_ACCEPTURL = "https://example.com/tasks/task-123/accept"
SHEETBOT_TASK_COMPLETEURL = "https://example.com/tasks/task-123/complete"
SHEETBOT_TASK_FAILEDURL = "https://example.com/tasks/task-123/failed"
SHEETBOT_TASK_DATAURL = "https://example.com/tasks/task-123/data"
SHEETBOT_TASK_ARTEFACTURL = "https://example.com/tasks/task-123/artefacts"
```

Scripts use these variables to interact with the server during execution.

### POST /tasks/:id/accept

Signals that the agent has received the task and is beginning execution.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Authorization: `Bearer <token>` (if authenticated)
- Body:
```json
{}
```

**Response (Success - 200):**
```json
{}
```

## Script Execution Contract

Agents are responsible for executing scripts in their target runtime environment. The execution contract requires:

1. **Environment Setup**: Provide all required environment variables to the script
2. **Execution**: Run the script with appropriate isolation and error handling
3. **Result Extraction**: Collect execution results in the expected format
4. **Status Reporting**: Report either success with data or failure

Scripts may access server APIs during execution using the provided environment variables for authentication and task-specific operations.

### POST /tasks/:id/complete

Reports successful task completion with result data.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Authorization: `Bearer <token>` (if authenticated)
- Body:
```json
{
  "data": {
    // execution result data (arbitrary structure)
  }
}
```

**Response (Success - 200):**
```json
{}
```

### POST /tasks/:id/failed

Reports task execution failure.

**Request:**
- Method: `POST`
- Content-Type: `application/json`
- Authorization: `Bearer <token>` (if authenticated)
- Body:
```json
{}
```

**Response (Success - 200):**
```json
{}
```

Example success responses:

```json
{
  "data": {
    "result": "task completed",
    "timestamp": "2024-01-01T12:00:00Z",
    "metrics": {
      "duration_ms": 1500,
      "memory_used_mb": 45
    }
  }
}
```

```json
{
  "data": {
    "default": "main result",
    "helper": "additional data"
  }
}
```

#### Failure Report

**Request Details:**
- **Method**: POST
- **URL**: `SHEETBOT_TASK_FAILEDURL`
- **Headers**: `Content-Type: application/json` and `Authorization: Bearer <token>` (if authenticated)
- **Body**: Empty JSON object

```json
{}
```

Failures are reported when script execution throws an exception or returns a non-zero exit code.

## Error Handling

### HTTP Status Codes

API endpoints return standard HTTP status codes:

- **200**: Success
- **204**: Success with no content
- **400**: Bad request (invalid data)
- **401**: Authentication required
- **403**: Authorization failed
- **404**: Resource not found
- **500**: Server error

### Error Response Format

Error responses include a JSON body with error details:

```json
{
  "error": "error_description"
}
```

### Task Execution Errors

Runtime implementations must catch execution errors and report them via the failure endpoint. Scripts that throw exceptions or return non-zero exit codes should be reported as task failures.

## Implementation Checklist

New runtime implementations should:

1. ✅ Implement authentication flow with `/login` endpoint
2. ✅ Declare capabilities for task matching
3. ✅ Poll for tasks using `/tasks/get` with appropriate capabilities
4. ✅ Accept tasks via `/tasks/:id/accept`
5. ✅ Fetch and execute scripts from `/scripts/:id.*` endpoints
6. ✅ Provide required environment variables to scripts
7. ✅ Report execution results via `/tasks/:id/complete` or `/tasks/:id/failed`
8. ✅ Handle HTTP errors and authentication requirements
9. ✅ Support artefact upload/download if needed by scripts
10. ✅ Implement proper error handling and cleanup

## Security Considerations

- Credentials are removed from environment after login
- Scripts execute in isolated contexts
- HTTP-only communication with server
- No persistent storage of sensitive data

## Deployment

Agents are typically deployed as:

- Standalone executables in containerized environments
- Scheduled jobs on compute resources
- On-demand processes triggered by external systems

The runtime is designed to be stateless and horizontally scalable.