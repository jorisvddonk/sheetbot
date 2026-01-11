# Library Script Annotations

This document describes the XML-like annotations used in SheetBot library scripts to provide metadata for task creation and agent matching.

## Overview

Library scripts in the `library/` directory can optionally use comment-embedded XML-like annotations to define task metadata. These annotations are parsed by SheetBot's library handler and the `addtask.ts` script to prefill information when creating tasks, saving users from having to manually enter common configuration details.

## Annotation Types

### `<name>`

Provides a suggested name for tasks created from this script.

**Example:**
```typescript
/*
Suggested name for this task: <name>Godot compile</name>
*/
```

### `<capabilitiesSchema>`

Defines the JSON Schema that agents must match to execute this task. This enables capability-based task routing.

**Example with build requirements:**
```typescript
/*
Suggested capabilitiesSchema for this task: <capabilitiesSchema>
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "software": {
      "type": "object",
      "properties": {
        "clang": {
          "type": "object",
          "properties": {
            "major_version": { "type": "number", "minimum": 6 }
          },
          "required": ["major_version"]
        },
        "deno": {
          "type": "object",
          "properties": {
            "major_version": { "type": "number", "maximum": 1 }
          },
          "required": ["major_version"]
        }
      },
      "required": ["clang", "deno"]
    },
    "memory": {
      "type": "object",
      "properties": {
        "free": { "type": "number", "minimum": 500 }
      },
      "required": ["free"]
    },
    "loadavg": {
      "type": "object",
      "properties": {
        "5min": { "type": "number", "exclusiveMaximum": 0.7 }
      },
      "required": ["5min"]
    }
  },
  "required": ["memory", "loadavg", "software"]
}
</capabilitiesSchema>
*/
```

### `<data>`

Provides suggested default data for tasks created from this script.

**Example:**
```typescript
/*
Suggested data for this task: <data>
{
  "branch": "4.3-stable",
  "additional_build_flags": ""
}
</data>
*/
```

### `<addTaskComments>`

Provides additional comments or instructions displayed when adding a task.

**Example:**
```typescript
/*
AddTaskComments: <addTaskComments>
If you want to build a release template, use "additional_build_flags": "target=template_release"
</addTaskComments>
*/
```

## How It Works

### Parsing
Annotations are parsed using simple string extraction from script source code:

- **Location**: Can appear anywhere in comments
- **Format**: XML-like tags with `<tag>` and `</tag>` delimiters
- **Content**: JSON for `<capabilitiesSchema>` and `<data>`, plain text for others
- **Comment Filtering**: Shell script `#` prefixes are stripped before JSON parsing

### Task Creation Flow
When using `addtask.ts`:

1. Script annotations are parsed (if present)
2. `<name>` becomes the default task name
3. `<data>` pre-fills the JSON data field
4. `<addTaskComments>` displays helpful guidance
5. `<capabilitiesSchema>` validates agent compatibility

### Library API
The `/library` endpoint returns parsed metadata:

```json
{
  "filename": "godot-compile.ts",
  "name": "Godot compile",
  "capabilitiesSchema": { /* parsed JSON */ },
  "suggestedData": { /* parsed JSON */ },
  "comments": "If you want to build a release template..."
}
```

## Best Practices

While all annotations are optional:

1. **Include `<name>`** for clear task identification
2. **Define `<capabilitiesSchema>`** to ensure tasks run on suitable agents
3. **Provide `<data>`** with sensible defaults
4. **Use `<addTaskComments>`** for special requirements
5. **Validate JSON** in `<capabilitiesSchema>` and `<data>`
6. **Keep comments concise** for CLI display

## Optionality

All annotations are **optional**. Scripts without them work perfectly - users just enter details manually. Annotations provide convenience by reducing repetitive data entry.