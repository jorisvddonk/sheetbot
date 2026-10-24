# Agent Workflow

Agents poll for tasks based on their type and capabilities. SheetBot provides templates for common runners:

- **Deno Runner**: For TypeScript tasks (`type: "deno"`)
  - Template: `/scripts/agent.ts`
  - Executes scripts in the Deno runtime
- **Node.js Runner**: For JavaScript and TypeScript tasks
  - Template: `/scripts/agent.js`
  - JavaScript task types: `"node"`, `"javascript"`, `"js"`
  - TypeScript task types: `"typescript"`, `"ts"`
  - Requires Node.js 22.6 or newer. TypeScript tasks run with `--experimental-sqlite --experimental-strip-types`
- **Python Runner**: For Python tasks (`type: "python"`)
  - Template: `/scripts/agent.py`
  - Executes scripts in a Python environment
- **Bash Runner**: For shell script tasks (`type: "bash"`)
  - Template: `/scripts/agent.sh`
  - Executes scripts in Bash. Requires `curl` and `jq` to be installed.

Workflow:
1. Poll `/tasks/get` with agent type and capabilities
2. Receive task script URL if available
3. Accept task via `/tasks/:id/accept`
4. Execute script (dependencies injected as `__DEP_RESULT_<taskId>__`)
5. Report completion via `/tasks/:id/complete` with result data

Node.js tasks are executed as temporary files. Node's strip-only TypeScript mode does not support network imports, so Node task scripts must be self-contained or use `fetch` for remote data.

See [Agent Runtime Implementation](../reference/agent-runtime.md) for details on implementing custom runners.

Runner implementations are flexible; SheetBot only requires adherence to the polling and reporting protocol.
