# Formal task models

SheetBot has TLA+ models of its task lifecycle under [`formal/`](https://github.com/jorisvddonk/sheetbot/tree/main/formal). They check the parts where concurrency and scheduling rules matter: task creation, polling, acceptance, completion, failure, deletion, dependencies, leases, crash recovery, and transitions.

They deliberately do **not** model HTTP, SQLite transactions, sheets, artefacts, permissions, or full JSON Schema semantics. Those are implementation details or separate concerns; the models are design checks.

## Task lifecycle

The safe lifecycle configuration verifies:

- no task has more than one accepting agent
- `RUNNING` means exactly one owner, and non-running tasks have no owner
- created tasks do not reference missing dependencies
- only completed/failed tasks have pending transitions
- only re-arm/retry tasks are scheduled

Dependency gating is enforced when an agent claims a task. It is not a permanent state invariant: a dependency may re-arm after a dependent has already started, because the dependent consumed its input at claim time.

## Finding: double accept

The model has both a safe and an unsafe acceptance mode.

The safe mode models acceptance as an atomic claim: poll remembers a candidate, and accept only succeeds if the task is still `AWAITING` and unowned.

The unsafe mode keeps a remembered candidate valid after another agent has claimed the task. This reproduces the implementation’s read-then-update pattern, and TLC finds a counterexample:

```text
a1 polls t1
a3 polls t1
a1 accepts t1  -> RUNNING, owner {a1}
a3 accepts t1  -> RUNNING, owner {a1, a3}   <- AtMostOneOwner violated
```

The implementation now makes acceptance a single conditional update:

```sql
UPDATE tasks
SET status = 1, owner = ?
WHERE id = ? AND status = 0 AND owner IS NULL;
```

The request is rejected when no row changed, and `test/task-claim.test.ts` checks the second claim loses. An explicit owner or lease also makes completion/failure checks and stuck-`RUNNING` recovery easier.

## Leases and crash recovery

`TaskLifecycleLeases.tla` adds agents going up/down and removes real time from the picture: “lease expired” becomes “owner is not up”.

It checks:

- completion and failure require the owner to be up
- a `RUNNING` task whose owner is down is reclaimed to `AWAITING`
- under weak fairness of reclamation, a task does not stay `RUNNING` under a down owner forever

The liveness property allows the task to finish after the owner recovers, or to be deleted, not only to be reclaimed.

## Transition engine

`TransitionEngine.tla` models one task with:

1. `COMPLETED -> DELETED`, immediate
2. `FAILED -> AWAITING`, every, while `retryCount < 2`, incrementing `retryCount`
3. `AWAITING -> PAUSED`, every

It checks first-match immediate evaluation, scheduled transitions, conditions, data mutation, schedule cleanup, and that deleted tasks have no pending schedules. Conditions are abstracted to boolean operators over task data; JSON Schema itself is not modeled.

## Run it

Requirements: Java 17+ and `curl`.

```bash
cd formal
./check.sh
```

The script runs the safe lifecycle, lease, and transition models, then verifies that the unsafe configuration still reproduces the race.

## What it does not prove

TLC exhaustively checks the finite models, not the TypeScript code. The models abstract away SQLite isolation, HTTP retries, real lease timestamps and clock skew, capability schemas beyond type equality, sheets, artefacts, events, and permissions. The transition model uses simple conditions rather than general JSON Schema.

The next step for implementation confidence is trace validation: emit task lifecycle events from the server, replay them through the models, and check the same invariants against real traces. Property-based tests should cover pure functions such as transition evaluation and capability matching.

See the [formal model README](https://github.com/jorisvddonk/sheetbot/tree/main/formal) for the full scope and files.
