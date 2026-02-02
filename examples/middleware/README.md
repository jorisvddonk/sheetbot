# Middleware Examples

This directory contains example middleware for SheetBot.

## Usage

To use these middleware examples, set the `SHEETBOT_MIDDLEWARE_SEARCH_PATHS` environment variable:

```bash
export SHEETBOT_MIDDLEWARE_SEARCH_PATHS="/path/to/sheetbot/examples/middleware"
deno run main.ts
```

## Available Examples

- `example-logging.ts` - Custom request logging and 404 handler

## Creating Your Own

See [docs/custom_middleware.md](../../docs/custom_middleware.md) for documentation on creating custom middleware.
