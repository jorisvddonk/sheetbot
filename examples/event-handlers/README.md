# Event Handler Examples

This directory contains example event handlers for SheetBot.

## Usage

To use these event handlers, set the `SHEETBOT_EVENTHANDLER_SEARCH_PATHS` environment variable:

```bash
export SHEETBOT_EVENTHANDLER_SEARCH_PATHS="/path/to/sheetbot/examples/event-handlers"
deno run main.ts
```

## Available Examples

- `example-logger.ts` - Logs all task and agent events to the console

## Creating Your Own

See [docs/event_handlers.md](../../docs/event_handlers.md) for documentation on creating custom event handlers.
