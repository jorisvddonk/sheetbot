# How-to guides

Task-oriented guides for configuring and extending SheetBot. Each page assumes you already have a running instance; start with the [getting started tutorial](../tutorials/getting-started.md) if you do not.

## Access and operations

- [Configure permissions](configure-permissions.md) — assign roles and control what users can do.
- [Manage API keys](manage-api-keys.md) — create and use API keys for agents and integrations.
- [Debug a failed task](debug-failed-tasks.md) — find out why a task failed or never started.
- [Deploy SheetBot](deploy-sheetbot.md) — run as a service, enable TLS, back up, restore, and upgrade.
- [Troubleshoot](troubleshoot.md) — known issues and workarounds.

## Configuration

- [Configure task transitions](configure-transitions.md) — auto-delete, retry, re-arm, and time out tasks.
- [Write init scripts](write-init-scripts.md) — run code on every server startup.
- [Configure library paths](configure-library-paths.md) — load task scripts from additional directories.
- [Configure script paths](configure-script-paths.md) — serve agent scripts from additional directories.
- [Configure static paths](configure-static-paths.md) — serve widgets and assets from additional directories.

## Extension

- [Write custom middleware](write-custom-middleware.md) — add Express middleware around routes.
- [Handle events](handle-events.md) — react to task and agent events.
- [Declare capabilities](declare-capabilities.md) — report agent capabilities for task matching.
