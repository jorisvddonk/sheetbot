# Static Search Paths

SheetBot supports serving additional static files from external directories via the `SHEETBOT_STATIC_SEARCH_PATHS` environment variable. This is the primary way to add custom widgets and other static assets without modifying the SheetBot repository.

## Usage

Set the environment variable to a colon-separated list of directories:

```bash
export SHEETBOT_STATIC_SEARCH_PATHS="/path/to/my-widgets:/another/path/static"
```

## Behavior

- The default `./static/` directory is always served first
- Additional paths from `SHEETBOT_STATIC_SEARCH_PATHS` are served in order
- Paths that don't exist are skipped with a warning
- Files in later paths can shadow files from earlier paths (including `./static/`)
- All paths are served at the root URL, exactly like `./static/`

## Example

```bash
export SHEETBOT_STATIC_SEARCH_PATHS="/home/user/my-sheetbot-customizations/static"

deno run --allow-all main.ts
# SheetBot now serves files from both ./static/ and the external path.
# A file at /home/user/my-sheetbot-customizations/static/widget-foo.js
# is accessible at http://localhost:3000/widget-foo.js
```

## Use Cases

- **Custom widgets**: Place `widget-*.js` files in an external directory and reference them in sheet column structures without putting them in the SheetBot repo
- **Custom HTML pages**: Add extra HTML files served at the root
- **Overriding built-in assets**: Files in an additional path shadow `./static/` files with the same name (useful for patching a widget without forking)

## Notes

- Widgets loaded this way are registered by the browser in the same custom element registry as built-in widgets, so they work identically
- When SheetBot is updated, your external static files are unaffected
- Combine with `SHEETBOT_INIT_SEARCH_PATHS` to also run initialization code (e.g. creating sheets) from the same external repo
