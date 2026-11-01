# Formal task model

SheetBot has a small TLA+ model of its task lifecycle under [`formal/`](https://github.com/jorisvddonk/sheetbot/tree/main/formal). It checks the parts where concurrency and lifecycle rules matter: task creation, polling, acceptance, completion, failure, deletion, dependencies, and scheduled transitions.

It deliberately does **not** model HTTP, SQLite transactions, sheets, artefacts, permissions, or arbitrary transition conditions. Those are implementation details or separate concerns; the model is a design check.

## What it checks

The safe configuration verifies:

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

The implementation should make acceptance a single conditional update:

```sql
UPDATE tasks
SET status = 1, owner = ?
WHERE id = ? AND status = 0 AND owner IS NULL;
```

Reject the request when no row changed. An explicit owner or lease also makes completion/failure checks and stuck-`RUNNING` recovery easier.

## Run it

Requirements: Java 17+ and `curl`.

```bash
cd formal
./check.sh
```

The script checks the safe model and verifies that the unsafe configuration still reproduces the race.

## What it does not prove

TLC exhaustively checks the finite model, not the TypeScript code. The model abstracts away SQLite isolation, HTTP retries, agent crashes, leases, capability schemas beyond type equality, and most transition conditions.

The next step for implementation confidence is trace validation: emit task lifecycle events from the server, replay them through the model, and check the same invariants against real traces. Property-based tests should cover pure functions such as transition evaluation and capability matching.

See the [formal model README](https://github.com/jorisvddonk/sheetbot/tree/main/formal) for the full scope and files.
