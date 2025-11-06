import Ajv from "npm:ajv@8.17.1";

export interface JSONSchema {
  [key: string]: unknown;
}

/**
 * Represents a remote task that can be executed asynchronously with dependencies.
 * @template T The return type of the task
 */
export class RemoteTask<T> {
  id: string;
  deps: RemoteTask<unknown>[];
  schema?: JSONSchema;
  script: string;
  run: () => Promise<T>;
  _resolve?: (value: T) => void;
  _reject?: (error: unknown) => void;
  private _promise: Promise<T>;
  private _executed = false;
  _dispatched = false;

  /**
   * Creates a new RemoteTask instance.
   * @param fn The function to execute
   * @param args Arguments for the function
   * @param deps Dependencies as other RemoteTask instances
   * @param schema Optional JSON schema for validation
   */
   constructor(
     fn: (...args: unknown[]) => Promise<unknown>,
     args: unknown[],
     deps: RemoteTask<unknown>[] = [],
     schema?: JSONSchema
   ) {
    this._promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
    this.id = crypto.randomUUID();
    this.deps = deps;
    this.schema = schema;

    // Generate run function
    this.run = () => fn(...args) as Promise<T>;

    // Generate script for remote execution
    const fnScript = fn.toString();
    const argValues = args.map(arg => arg instanceof RemoteTask ? `__DEP_RESULT_${arg.id}__` : JSON.stringify(arg));

    this.script = `
// Execute function
const __FN__ = ${fnScript};
const result = await __FN__(${argValues.join(', ')});

// Return result
export default result;
`;

    // Register with runtime
    Runtime.register(this);
  }

  /**
   * Attaches a fulfillment handler to the promise.
   * @param onfulfilled Handler for success
   * @param onrejected Handler for rejection
   * @returns A new promise
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    if (!this._executed) {
      this._executed = true;
      Runtime.execute(this);
    }
    return this._promise.then(onfulfilled, onrejected);
  }

  /**
   * Attaches a rejection handler to the promise.
   * @param onrejected Handler for rejection
   * @returns A new promise
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this._promise.catch(onrejected);
  }
}

/**
 * Creates a distributed function wrapper.
 * @param fn The async function to wrap
 * @param schema Optional schema
 * @returns A function that returns a RemoteTask
 */
export function distributed<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  schema?: JSONSchema
) {
  return (...args: unknown[]): RemoteTask<R> => {
    // Extract RemoteTask dependencies from args
    const deps = args.filter(arg => arg instanceof RemoteTask) as RemoteTask<unknown>[];

    return new RemoteTask<R>(
      fn,
      args,
      deps,
      schema
    );
  };
}

/**
 * Adds schema requirement to a function.
 * @param schema The JSON schema
 * @returns A decorator function
 */
export function requires(schema: JSONSchema) {
  return <T extends unknown[], R>(fn: (...args: T) => Promise<R>) => distributed<T, R>(fn, schema);
}

/**
 * Manages the execution of remote tasks.
 */
export class Runtime {
  static tasks = new Map<string, RemoteTask<unknown>>();
  static results = new Map<string, unknown>();
  static functions = new Map<string, (...args: unknown[]) => unknown>();
  static dispatchFunction?: (task: RemoteTask<unknown>) => Promise<void>;
  static offloadMode = false;

  /**
   * Registers a task with the runtime.
   * @param task The task to register
   */
  static register(task: RemoteTask<unknown>) {
    this.tasks.set(task.id, task);
  }

  /**
   * Executes the task and its dependencies.
   * @param rootTask The root task to execute
   * @returns The resolved task
   */
  static async execute(rootTask: RemoteTask<unknown>) {
    const dag = this.buildDAG(rootTask);

    if (this.offloadMode) {
      // Dispatch all tasks without waiting for levels
      for (const task of dag.keys()) {
        if (!this.results.has(task.id)) {
          this.dispatchTask(task); // Don't await
        }
      }
      return rootTask;
    }

    // Topological sort and execute
    for (const level of this.topologicalSort(dag)) {
      await Promise.all(
        level.map(task => this.dispatchTask(task))
      );
    }

    return rootTask; // Now resolved
  }

  /**
   * Gets the DAG for the task.
   * @param rootTask The root task
   * @returns The DAG map
   */
  static getDAG(rootTask: RemoteTask<unknown>) {
    return this.buildDAG(rootTask);
  }

  /**
   * Builds the dependency graph.
   * @param root The root task
   * @returns The graph map
   */
  private static buildDAG(root: RemoteTask<unknown>): Map<RemoteTask<unknown>, RemoteTask<unknown>[]> {
    const graph = new Map<RemoteTask<any>, RemoteTask<any>[]>();
    const visited = new Set<RemoteTask<unknown>>();

    const build = (task: RemoteTask<unknown>) => {
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

  /**
   * Performs topological sort on the graph.
   * @param graph The dependency graph
   * @returns Levels of tasks
   */
  private static topologicalSort(graph: Map<RemoteTask<unknown>, RemoteTask<unknown>[]>): RemoteTask<unknown>[][] {
    const inDegree = new Map<RemoteTask<unknown>, number>();
    const queue: RemoteTask<unknown>[] = [];
    const result: RemoteTask<unknown>[][] = [];

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

  /**
   * Dispatches a task for execution.
   * @param task The task to dispatch
   */
  private static async dispatchTask(task: RemoteTask<unknown>) {
    // Check cache
    if (this.results.has(task.id)) {
      const result = this.results.get(task.id);
      if (task._resolve) {
        task._resolve(result);
      }
      return;
    }

    if (task._dispatched) {
      return;
    }
    task._dispatched = true;

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
