# Why JSON Schema?

SheetBot uses JSON Schema extensively for two critical functions: task matching to agents and managing task transitions. This choice enables flexible, declarative configuration without hardcoding logic in the core system.

## Task Matching

When an agent polls for work, it submits a "capabilities" JSON object describing its environment (e.g., available memory, OS, installed software). Each task includes a JSON Schema that defines the requirements for execution.

The system matches tasks to agents by validating the agent's capabilities against the task's schema. For example:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "memory": {
      "type": "object",
      "properties": {
        "available": {
          "type": "number",
          "minimum": 500
        }
      },
      "required": ["available"]
    },
    "os": {
      "type": "string",
      "enum": ["linux", "darwin"]
    }
  },
  "required": ["memory", "os"]
}
```

This schema ensures the task only runs on Linux or macOS agents with at least 500MB available memory.

## Task Transitions

Transitions automatically change task states based on JSON Schema validation. For instance, a transition might reset a completed task to "awaiting" for periodic execution, or mark failed tasks for retry.

The transition schema defines conditions that trigger state changes, allowing complex lifecycle management without custom code.

Example transition to reset completed tasks back to awaiting (for periodic tasks):

```json
[
  {
    "statuses": ["COMPLETED"],
    "condition": {},
    "timing": {
      "every": "5s"
    },
    "transitionTo": "AWAITING"
  }
]
```

More advanced example: Conditional transitions for a CI build task - retry on test failures or clean up on success:

```json
[
  {
    "statuses": ["COMPLETED"],
    "condition": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "data": {
          "type": "object",
          "properties": {
            "testResults": {
              "type": "object",
              "properties": {
                "failed": {
                  "type": "number",
                  "minimum": 1
                }
              },
              "required": ["failed"]
            }
          },
          "required": ["testResults"]
        }
      },
      "required": ["data"]
    },
    "timing": {
      "every": "10m"
    },
    "transitionTo": "AWAITING"
  },
  {
    "statuses": ["COMPLETED"],
    "condition": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "data": {
          "type": "object",
          "properties": {
            "testResults": {
              "type": "object",
              "properties": {
                "failed": {
                  "type": "number",
                  "maximum": 0
                }
              },
              "required": ["failed"]
            }
          },
          "required": ["testResults"]
        }
      },
      "required": ["data"]
    },
    "timing": {
      "immediate": true
    },
    "transitionTo": "DELETED"
  }
]
```

## Why JSON Schema?

JSON Schema provides several advantages:

1. **Flexibility**: Match on arbitrary criteria without modifying core code - memory, CPU, network, installed packages, etc.

2. **Standardization**: A well-established specification with broad tool support and familiarity.

3. **Declarative**: Configuration as code - task requirements and transitions are defined in schema files alongside scripts.

4. **Validation Power**: Rich validation rules (minimums, enums, patterns) enable precise matching and state management.

5. **Extensibility**: Easy to add new matching criteria or transition rules by updating schemas.

This approach embodies SheetBot's philosophy of primitive emergent architecture, where simple schemas combine to create sophisticated automation workflows.

Note: While JSON Schema can be complex for advanced validations, AI tools are excellent at generating and refining schemas, making it accessible even for intricate matching and transition rules.