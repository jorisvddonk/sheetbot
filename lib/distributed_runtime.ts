import Ajv from "npm:ajv";

export interface JSONSchema {
  [key: string]: any;
}

export class RemoteTask<T> {
  id: string;
  deps: RemoteTask<any>[];
  schema?: JSONSchema;
  run: () => Promise<T>;
  private _resolve?: (value: T) => void;
  private _reject?: (error: any) => void;
  private _promise: Promise<T>;

  constructor(
    run: () => Promise<T>,
    deps: RemoteTask<any>[] = [],
    schema?: JSONSchema
  ) {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    this.id = crypto.randomUUID();
    this.deps = deps;
    this.schema = schema;
    this.run = run;

    // Register with runtime
    Runtime.register(this);
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this._promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this._promise.catch(onrejected);
  }
}

export function distributed<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  schema?: JSONSchema
) {
  return (...args: T): RemoteTask<R> => {
    // Extract RemoteTask dependencies from args
    const deps = args.filter(arg => arg instanceof RemoteTask) as RemoteTask<any>[];

    return new RemoteTask<R>(
      () => fn(...args),
      deps,
      schema
    );
  };
}

export function requires(schema: JSONSchema) {
  return <T extends any[], R>(fn: (...args: T) => Promise<R>) => distributed<T, R>(fn, schema);
}

export class Runtime {
  static tasks = new Map<string, RemoteTask<any>>();
  static results = new Map<string, any>();
  static functions = new Map<string, Function>();
  static dispatchFunction?: (task: RemoteTask<any>) => Promise<void>;

  static register(task: RemoteTask<any>) {
    this.tasks.set(task.id, task);
  }

  static async execute(rootTask: RemoteTask<any>) {
    const dag = this.buildDAG(rootTask);

    // Topological sort and execute
    for (const level of this.topologicalSort(dag)) {
      await Promise.all(
        level.map(task => this.dispatchTask(task))
      );
    }

    return rootTask; // Now resolved
  }

  static getDAG(rootTask: RemoteTask<any>) {
    return this.buildDAG(rootTask);
  }

  private static buildDAG(root: RemoteTask<any>): Map<RemoteTask<any>, RemoteTask<any>[]> {
    const graph = new Map<RemoteTask<any>, RemoteTask<any>[]>();
    const visited = new Set<RemoteTask<any>>();

    const build = (task: RemoteTask<any>) => {
      if (visited.has(task)) return;
      visited.add(task);

      graph.set(task, task.deps);
      for (const dep of task.deps) {
        build(dep);
      }
    };

    build(root);
    return graph;
  }

  private static topologicalSort(graph: Map<RemoteTask<any>, RemoteTask<any>[]>): RemoteTask<any>[][] {
    const inDegree = new Map<RemoteTask<any>, number>();
    const queue: RemoteTask<any>[] = [];
    const result: RemoteTask<any>[][] = [];

    // Initialize in-degrees
    for (const [task, deps] of graph) {
      inDegree.set(task, deps.length);
    }

    // Find tasks with no dependencies
    for (const [task, degree] of inDegree) {
      if (degree === 0) {
        queue.push(task);
      }
    }

    while (queue.length > 0) {
      const level = [...queue];
      result.push(level);
      queue.length = 0;

      for (const task of level) {
        for (const [t, deps] of graph) {
          if (deps.includes(task)) {
            const newDegree = (inDegree.get(t) || 0) - 1;
            inDegree.set(t, newDegree);
            if (newDegree === 0) {
              queue.push(t);
            }
          }
        }
      }
    }

    return result;
  }

  private static async dispatchTask(task: RemoteTask<any>) {
    // Check cache
    if (this.results.has(task.id)) {
      const result = this.results.get(task.id);
      if (task._resolve) {
        task._resolve(result);
      }
      return;
    }

    if (this.dispatchFunction) {
      await this.dispatchFunction(task);
    } else {
      // Local execution for testing
      try {
        const result = await task.run();

        this.results.set(task.id, result);
        // Resolve the promise
        if (task._resolve) {
          task._resolve(result);
        }
      } catch (error) {
        // Reject the promise
        if (task._reject) {
          task._reject(error);
        }
      }
    }
  }
}
