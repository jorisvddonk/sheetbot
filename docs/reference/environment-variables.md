# Environment variables

SheetBot reads environment variables at startup. Restart the server after changing them.

## Server

| Variable | Default | Purpose |
|---|---|---|
| `SHEETBOT_PORT` | `3000` | HTTP port. Overridden by `--port`/`-p`. |
| `SHEETBOT_HTTPS_PORT` | `443` | HTTPS port, used when `key.pem` and `cert.pem` exist. Overridden by `--https-port`/`-P`. |
| `NODE_ENV` | unset | Set to `production` in deployments. |
| `SHEETBOT_WIDGET_CACHE_TTL` | `5` | Minutes to cache `/widgets.json`. `0` disables caching. |

## Search paths

Search paths are colon-separated lists. Relative paths are resolved from the server's working directory. Missing directories are skipped with a warning.

| Variable | Adds |
|---|---|
| `SHEETBOT_INIT_SEARCH_PATHS` | Extra directories for startup init scripts. `./init/` is always searched first. |
| `SHEETBOT_LIBRARY_SEARCH_PATH` | Extra directories for library task scripts. `./library/` is always searched first. Note the singular `PATH`. |
| `SHEETBOT_SCRIPTS_SEARCH_PATHS` | Extra directories served at `/scripts` alongside `./scripts`. |
| `SHEETBOT_STATIC_SEARCH_PATHS` | Extra static directories served alongside `./static`. Also scanned for `widget-*.js`. |
| `SHEETBOT_MIDDLEWARE_SEARCH_PATHS` | Extra directories for `setupMiddleware` / `setupPostRouteMiddleware` modules. |
| `SHEETBOT_EVENTHANDLER_SEARCH_PATHS` | Extra directories for `setupEventHandlers` modules. |

Example:

```bash
export SHEETBOT_LIBRARY_SEARCH_PATH="/opt/sheetbot/library:$HOME/sheetbot/library"
export SHEETBOT_STATIC_SEARCH_PATHS="/opt/sheetbot/widgets"
export SHEETBOT_INIT_SEARCH_PATHS="/etc/sheetbot/init"
```

## Agent and client

These are read by agent templates and task scripts. They are not server settings.

| Variable | Purpose |
|---|---|
| `SHEETBOT_BASEURL` | SheetBot origin, for example `http://localhost:3000`. If omitted in an agent, the template fills in the origin that served it. |
| `SHEETBOT_AUTH_USER` | Username for agent login. |
| `SHEETBOT_AUTH_PASS` | Password for agent login. |
| `SHEETBOT_AUTH_APIKEY` | API key for agent login. Takes precedence over username/password. |
| `SHEETBOT_AUTHORIZATION_HEADER` | Injected into task scripts by the agent; contains `Bearer <token>`. |
| `SHEETBOT_TASK_ID` | Injected into task scripts: the current task ID. |
| `SHEETBOT_TASK_BASEURL` | Injected: `GET` the current task. |
| `SHEETBOT_TASK_ACCEPTURL` | Injected: accept endpoint. |
| `SHEETBOT_TASK_COMPLETEURL` | Injected: complete endpoint. |
| `SHEETBOT_TASK_FAILEDURL` | Injected: fail endpoint. |
| `SHEETBOT_TASK_DATAURL` | Injected: update task data. |
| `SHEETBOT_TASK_ARTEFACTURL` | Injected: upload task artefacts. |

Example for an agent:

```bash
export SHEETBOT_BASEURL=http://localhost:3000
export SHEETBOT_AUTH_APIKEY=your.api.key
```

See [Using API keys for agents](../tutorials/using-api-keys-for-agents.md).

## Distributed runtime

The experimental distributed runtime falls back to the normal auth variables:

| Variable | Purpose |
|---|---|
| `SHEETBOT_DISPATCH_AUTH_APIKEY` | API key used by the HTTP dispatcher. Falls back to `SHEETBOT_AUTH_APIKEY`. |
| `SHEETBOT_DISPATCH_AUTH_USER` | Username for the dispatcher. Falls back to `SHEETBOT_AUTH_USER`. |
| `SHEETBOT_DISPATCH_AUTH_PASS` | Password for the dispatcher. Falls back to `SHEETBOT_AUTH_PASS`. |

## Precedence and notes

- Agent authentication prefers `SHEETBOT_AUTH_APIKEY`, then username/password. Unset user/password when using a key.
- Server CLI flags `--port`/`-p` and `--https-port`/`-P` override their environment variables.
- Init scripts run in lexicographic order per directory; `./init/` runs before additional directories.
- Widget discovery scans static directories once per cache window; restart or set `SHEETBOT_WIDGET_CACHE_TTL=0` when developing widgets.
- Env files are a shell/systemd/launchd concern, not a SheetBot feature. Do not commit secrets.

## Next

- [Deploy SheetBot](../how-to/deploy-sheetbot.md) — service files and environment files.
- [Configure library paths](../how-to/configure-library-paths.md) — `SHEETBOT_LIBRARY_SEARCH_PATH`.
- [Static search paths](../how-to/configure-static-paths.md) — widgets and assets from other directories.
