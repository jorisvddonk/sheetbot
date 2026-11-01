# Formal models

This directory contains TLA+ models of SheetBot's task lifecycle and transition engine. They are intentionally small: the goal is to check concurrency, lifecycle, and scheduling rules, not to model the HTTP/UI layer, SQLite schema, sheets, or artefact storage.

## Models

### `TaskLifecycle`

A safe model of tasks, agents, dependencies, claims, re-arm/retry transitions, and deletion. It has three agents (`a1`, `a2`, `a3`) and four tasks (`t1`–`t4`); `a1` and `a3` share type `build`, making the unsafe acceptance race reachable.

Checks:

- `TypeInvariant` — variables stay in their expected domains
- `AtMostOneOwner` — no task has more than one accepting agent
- `RunningHasOneOwner` — `RUNNING` means exactly one owner, and other statuses have none
- `NoDanglingDeps` — a created task’s dependencies exist
- `ScheduledOnlyTerminal` — only completed/failed tasks have pending transitions
- `ScheduledRelevant` — only re-arm/retry tasks are scheduled

Dependency gating is enforced by the `Poll`/`CanAccept` action precondition. It is not a state invariant, because a dependency may re-arm after a dependent has already started; the dependent consumed its input at claim time.

`TaskLifecycleUnsafe.cfg` sets `UnsafeAccept = TRUE` to reproduce the current read-then-update acceptance race. TLC finds the double-accept counterexample:

```text
a1 polls t1
a3 polls t1
a1 accepts t1  -> RUNNING, owner {a1}
a3 accepts t1  -> RUNNING, owner {a1, a3}   <- AtMostOneOwner violated
```

The implementation now uses a single conditional update:

```sql
UPDATE tasks
SET status = 1, owner = ?
WHERE id = ? AND status = 0 AND owner IS NULL;
```

The request is rejected when `changes = 0`, and `test/task-claim.test.ts` checks the second claim loses.

### `TaskLifecycleLeases`

Adds agents going up/down, lease reclamation, and a liveness property:

- a `RUNNING` task whose owner is not up must eventually either stop running under that owner, be reclaimed to `AWAITING`, or finish after the owner recovers
- `Reclaim(t)` moves a task owned by a down agent back to `AWAITING`
- completion/failure require the owner to be up
- weak fairness on reclamation is required for the liveness result

This models crash recovery without real time: “lease expired” is abstracted to “owner not up”.

### `TransitionEngine`

Models one task with a fixed transition table:

1. `COMPLETED -> DELETED`, immediate
2. `FAILED -> AWAITING`, every, while `retryCount < 2`, increments `retryCount`
3. `AWAITING -> PAUSED`, every

Checks first-match immediate evaluation, scheduled transitions, conditions, data mutation, schedule cleanup, and that deleted tasks have no pending schedules. Conditions are abstracted to an operator over task data; JSON Schema itself is not modeled.

## Running

Requirements: Java 17+ and `curl`.

```bash
cd formal
./check.sh
```

The script downloads `tla2tools.jar` if needed, runs the safe lifecycle, lease, and transition models, then verifies that the unsafe configuration still reproduces the `AtMostOneOwner` violation.

To run TLC manually:

```bash
java -XX:+UseParallelGC -cp tla2tools.jar \
  tlc2.TLC -config TaskLifecycle.cfg TaskLifecycle.tla

java -XX:+UseParallelGC -cp tla2tools.jar \
  tlc2.TLC -config TaskLifecycleLeases.cfg TaskLifecycleLeases.tla

java -XX:+UseParallelGC -cp tla2tools.jar \
  tlc2.TLC -config TransitionEngine.cfg TransitionEngine.tla

java -XX:+UseParallelGC -cp tla2tools.jar \
  tlc2.TLC -config TaskLifecycleUnsafe.cfg TaskLifecycle.tla
```

The last command is expected to fail.

## What this does not prove

TLC exhaustively checks the finite models above, not the TypeScript implementation. In particular, the models abstract away:

- SQLite transactions and isolation
- HTTP retries and duplicate requests
- real lease timestamps and clock skew
- capability schemas beyond type equality
- sheets, artefacts, events, and permissions
- JSON Schema conditions (the transition model uses simple boolean conditions)

The next step for implementation confidence is trace validation: emit task lifecycle events from the server, replay them through the model, and check that observed traces satisfy the same invariants. Property-based tests around transition evaluation and capability matching should cover the pure functions.

## Files

- `TaskLifecycle.tla` — safe lifecycle model
- `TaskLifecycle.cfg` — safe lifecycle configuration, expected to pass
- `TaskLifecycleUnsafe.cfg` — stale-accept configuration, expected to fail
- `TaskLifecycleLeases.tla` — crash/reclaim model with liveness
- `TaskLifecycleLeases.cfg` — lease configuration
- `TransitionEngine.tla` — transition scheduling/mutation model
- `TransitionEngine.cfg` — transition configuration
- `check.sh` — runs all checks
