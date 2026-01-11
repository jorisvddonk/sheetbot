# Agent Workflow

Agents poll for tasks based on their type and capabilities. SheetBot provides templates for common runners:

- **Deno Runner**: For TypeScript/JavaScript tasks (`type: "deno"`)
  - Template: `/scripts/agent.ts` or `/scripts/agent.js`
  - Executes scripts in Deno runtime
- **Python Runner**: For Python tasks (`type: "python"`)
  - Template: `/scripts/agent.py`
  - Executes scripts in Python environment
- **Bash Runner**: For shell script tasks (`type: "bash"`)
  - Template: `/scripts/agent.sh`
  - Executes scripts in Bash shell. Requires `curl` and `jq` to be installed.

Workflow:
1. Poll `/tasks/get` with agent type and capabilities
2. Receive task script URL if available
3. Accept task via `/tasks/:id/accept`
4. Execute script (dependencies injected as `__DEP_RESULT_<taskId>__`)
5. Report completion via `/tasks/:id/complete` with result data

See [Agent Runtime Implementation](agent_runtime_implementation.md) for details on implementing custom runners.

Runner implementations are flexible; SheetBot only requires adherence to the polling and reporting protocol.