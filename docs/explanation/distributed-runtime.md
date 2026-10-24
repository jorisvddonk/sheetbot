# Distributed Promise Runtime

## Overview

SheetBot includes a distributed promise runtime that allows writing natural async JavaScript/TypeScript code for orchestrating distributed tasks. This enables patterns like:

```typescript
const result = await Promise.all([
  compile("windows"),
  compile("linux")
]).then(files => zip(files)).then(upload);
```

The runtime automatically infers and executes a DAG of tasks across agents.

## Core Components

### RemoteTask Class

Extends Promise to represent distributed computations:

```typescript
class RemoteTask<T> extends Promise<T> {
  id: string;
  deps: RemoteTask<any>[];
  schema?: JSONSchema;

  constructor(
    run: () => Promise<T>,
    deps: RemoteTask<any>[] = [],
    schema?: JSONSchema
  ) {
    // Registers with runtime, handles resolution
  }
}
```

### Distributed Function Decorator

Marks functions as distributed:

```typescript
function distributed<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  schema?: JSONSchema
) {
  return (...args: T): RemoteTask<R> => {
    const deps = args.filter(arg => arg instanceof RemoteTask);
    return new RemoteTask(() => fn(...args), deps, schema);
  };
}
```

### Runtime Orchestrator

Manages task registration, DAG building, and execution:

```typescript
class Runtime {
  static execute(rootTask: RemoteTask<any>) {
    const dag = buildDAG(rootTask);
    // Topological execution across agents
  }
}
```

## Usage

```typescript
// Define distributed functions
const compile = distributed(
  async (src: string) => runCompileJob(src),
  { properties: { os: { const: "linux" } } } // capabilities JSON Schema
);
const zip = distributed(async (...files) => zipFiles(files));
const upload = distributed(async (file) => uploadFile(file));

// Write natural async code
(async () => {
  const [libfoo, libbar] = await Promise.all([
    compile("libfoo.cpp"),
    compile("libbar.cpp")
  ]);
  const result = await upload(await zip(libfoo, libbar));

  console.log("Final result:", result);
})();
```

## Integration

- **Schema Matching**: Leverages SheetBot's capability matching
- **Task Dispatch**: Uses `/tasks/get` endpoint
- **Result Storage**: Central KV store for intermediate results
- **Dependency Resolution**: Runtime waits for deps before dispatching

## Features

- **Caching**: Avoids re-execution of completed tasks
- **Retries**: Auto-retry failed tasks on different agents
- **Monitoring**: DAG visualization (planned)
- **Type Safety**: Full TypeScript support

This runtime makes distributed computing feel like local async code.