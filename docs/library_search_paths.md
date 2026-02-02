# Library Search Paths

SheetBot supports additional library search paths via the `SHEETBOT_LIBRARY_SEARCH_PATH` environment variable.

## Usage

Set the environment variable to a colon-separated list of directories:

```bash
export SHEETBOT_LIBRARY_SEARCH_PATH="/path/to/custom/scripts:/another/path/scripts"
```

## Behavior

- The default `./library/` directory is always searched first
- Additional paths from `SHEETBOT_LIBRARY_SEARCH_PATH` are searched in order
- Paths that don't exist or aren't accessible are silently skipped
- Scripts from all paths appear in the library UI and `addtask.ts` script picker

## Example

```bash
# Add custom library paths
export SHEETBOT_LIBRARY_SEARCH_PATH="/home/user/my-scripts:/opt/shared-scripts"

# Start SheetBot - it will now find scripts in all three locations:
# - ./library/
# - /home/user/my-scripts/
# - /opt/shared-scripts/
deno run main.ts
```

This allows you to:
- Keep custom scripts separate from the SheetBot repository
- Share script libraries across multiple SheetBot instances
- Organize scripts by project or team
