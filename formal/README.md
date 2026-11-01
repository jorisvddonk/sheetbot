# Formal model

This directory contains a TLA+ model of SheetBot's task lifecycle. It is intentionally small: the goal is to check the concurrency and lifecycle rules, not to model the HTTP/UI layer, SQLite schema, sheets, or artefact storage.

## What is modeled

- tasks with types and dependencies
- agents with types
- task creation, polling, acceptance, completion, failure, deletion
- scheduled re-arm and retry transitions
- auto-deletion
- stale candidate reads, to expose the double-accept race

The model has three agents (`a1`, `a2`, `a3`) and four tasks (`t1`–`t4`). `a1` and `a3` both have type `build`, which makes the unsafe acceptance race reachable.

## Invariants

`TaskLifecycle.cfg` checks:

- `TypeInvariant` — variables stay in their expected domains
- `AtMostOneOwner` — no task has more than one accepting agent
- `RunningHasOneOwner` — `RUNNING` means exactly one owner, and other statuses have none
- `NoDanglingDeps` — a created task’s dependencies exist
- `ScheduledOnlyTerminal` — only completed/failed tasks have pending transitions
- `ScheduledRelevant` — only re-arm/retry tasks are scheduled

Dependency gating is enforced by the `Poll`/`CanAccept` action precondition. It is not a state invariant, because a dependency may re-arm after a dependent has already started; the dependent consumed its input at claim time.

## Running

Requirements: Java 17+ and `curl`.

```bash
cd formal
./check.sh
```

The script downloads `tla2tools.jar` if needed, checks the safe model, then verifies that the unsafe configuration still reproduces the `AtMostOneOwner` violation.

To run TLC manually:

```bash
java -XX:+UseParallelGC -cp tla2tools.jar \
  tlc2.TLC -config TaskLifecycle.cfg TaskLifecycle.tla

java -XX:+UseParallelGC -cp tla2tools.jar \
  tlc2.TLC -config TaskLifecycleUnsafe.cfg TaskLifecycle.tla
```

The second command is expected to fail.

## Finding: double accept

The safe model makes acceptance an atomic claim:

```text
Poll(agent, task) -> remembers a candidate
Accept(agent)     -> claims the candidate only if it is still AWAITING and unowned
```

`TaskLifecycleUnsafe.cfg` sets `UnsafeAccept = TRUE`. That keeps a remembered candidate valid after another agent already claimed the task, reproducing the current implementation’s read-then-update pattern. TLC finds this counterexample:

```text
a1 polls t1
a3 polls t1
a1 accepts t1  -> RUNNING, owner {a1}
a3 accepts t1  -> RUNNING, owner {a1, a3}   <- AtMostOneOwner violated
```

The implementation fix is to make acceptance a single conditional update, for example:

```sql
UPDATE tasks
SET status = 1, owner = ?
WHERE id = ? AND status = 0 AND owner IS NULL;
```

and to reject the request when `changes = 0`. Adding an explicit owner/lease column also makes completion/failure checks and stuck-`RUNNING` recovery easier.

## What this does not prove

TLC exhaustively checks the finite model above, not the TypeScript implementation. In particular, it abstracts away:

- SQLite transactions and isolation
- HTTP retries and duplicate requests
- agent crashes and leases
- capability schemas beyond type equality
- sheets, artefacts, events, and permissions
- all transition conditions (the model has one re-arm and one retry policy)

The next step for implementation confidence is trace validation: emit task lifecycle events from the server, replay them through the model, and check that the observed traces satisfy the same invariants. Property-based tests around transition evaluation and capability matching should cover the pure functions.

## Files

- `TaskLifecycle.tla` — the model
- `TaskLifecycle.cfg` — safe configuration, expected to pass
- `TaskLifecycleUnsafe.cfg` — stale-accept configuration, expected to fail
- `check.sh` — runs both checks
