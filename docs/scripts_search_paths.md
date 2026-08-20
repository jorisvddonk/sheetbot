# Scripts Search Paths

SheetBot supports serving additional agent-facing scripts from external directories via the `SHEETBOT_SCRIPTS_SEARCH_PATHS` environment variable. Files in these directories are served at `/scripts`, alongside the built-in files from `./scripts/`.

## Usage

Set the environment variable to a colon-separated list of directories:

```bash
export SHEETBOT_SCRIPTS_SEARCH_PATHS="/path/to/my-scripts:/another/path/scripts"
```

## Behavior

- The default `./scripts/` directory is always served first at `/scripts`
- Additional paths from `SHEETBOT_SCRIPTS_SEARCH_PATHS` are served in order at the same `/scripts` prefix
- Paths that don't exist are skipped with a warning
- Files in later paths can shadow files from earlier paths (including `./scripts/`)

## Example

```bash
export SHEETBOT_SCRIPTS_SEARCH_PATHS="/home/user/my-sheetbot-customizations/scripts"

deno run --allow-all main.ts
# A file at /home/user/my-sheetbot-customizations/scripts/lib/myutil.ts
# is accessible at http://localhost:3000/scripts/lib/myutil.ts
# and can be imported by agents as:
#   import { foo } from "${SHEETBOT_BASEURL}/scripts/lib/myutil.ts";
```

## Use Cases

- **Custom agent utility modules**: Share helper TypeScript modules that your library scripts import by URL, without putting them in the SheetBot repo
- **Custom agent scripts**: Serve scripts like verification tasks or one-off automation scripts from an external directory
- **Overriding built-in scripts**: Files in an additional path shadow `./scripts/` files with the same name

## Notes

- Agent scripts import these files by their full URL (e.g. `${SHEETBOT_BASEURL}/scripts/lib/myutil.ts`), so they work the same regardless of which directory they were served from
- The `/scripts` route for specific task scripts (`/scripts/:id`) is handled by a dedicated route and is not affected by this setting
- When SheetBot is updated, your external scripts files are unaffected
- Combine with `SHEETBOT_LIBRARY_SEARCH_PATH` to also add library scripts from the same external repo
