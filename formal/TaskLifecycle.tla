---------------------------- MODULE TaskLifecycle ----------------------------
\* A small TLA+ model of SheetBot's task lifecycle.
\*
\* The model is deliberately narrower than the implementation:
\*   - task scripts and capabilities are abstracted to task/agent types
\*   - one transition per task class (rearm, retry, delete)
\*   - time is abstracted by a nondeterministic Tick action
\*   - persistence details and sheets/artefacts are out of scope
\*
\* The important safety properties are in Inv below. In particular,
\* Accept is the atomic "claim" operation the implementation should provide.
\* Set UnsafeAccept = TRUE in the config to model the current read-then-update
\* race and watch AtMostOneOwner fail.

EXTENDS Naturals, FiniteSets, TLC

CONSTANT UnsafeAccept

Agents == {"a1", "a2", "a3"}
Tasks == {"t1", "t2", "t3", "t4"}

NoTask == "NO_TASK"

Statuses == {"none", "AWAITING", "RUNNING", "COMPLETED", "FAILED"}

InitialDeps == [
    t1 |-> {},
    t2 |-> {},
    t3 |-> {"t1"},
    t4 |-> {"t1", "t2"}
]

TaskType == [
    t1 |-> "build",
    t2 |-> "test",
    t3 |-> "build",
    t4 |-> "test"
]

AgentType == [
    a1 |-> "build",
    a2 |-> "test",
    a3 |-> "build"
]

RearmTasks == {"t2"}
RetryTasks == {"t3"}
DeleteTasks == {"t4"}

ASSUME NoTask \notin Tasks
ASSUME RearmTasks \cap RetryTasks = {}
ASSUME DeleteTasks \cap (RearmTasks \cup RetryTasks) = {}
ASSUME \A t \in Tasks: \A d \in InitialDeps[t]: d \in Tasks
ASSUME \A t \in Tasks: t \notin InitialDeps[t]

VARIABLES status, owners, deps, scheduled, candidate

vars == <<status, owners, deps, scheduled, candidate>>

TypeInvariant ==
    /\ status \in [Tasks -> Statuses]
    /\ owners \in [Tasks -> SUBSET Agents]
    /\ deps \in [Tasks -> SUBSET Tasks]
    /\ scheduled \subseteq Tasks
    /\ candidate \in [Agents -> Tasks \cup {NoTask}]

Init ==
    /\ status = [t \in Tasks |-> "none"]
    /\ owners = [t \in Tasks |-> {}]
    /\ deps = [t \in Tasks |-> InitialDeps[t]]
    /\ scheduled = {}
    /\ candidate = [a \in Agents |-> NoTask]

\* Create a task. Its dependencies must already exist, but need not be done.
Create(t) ==
    /\ status[t] = "none"
    /\ \A d \in deps[t]: status[d] # "none"
    /\ status' = [status EXCEPT ![t] = "AWAITING"]
    /\ owners' = [owners EXCEPT ![t] = {}]
    /\ scheduled' = scheduled \ {t}
    /\ UNCHANGED <<deps, candidate>>

\* An agent polls and remembers a candidate. Polling does not claim it.
Poll(a, t) ==
    /\ status[t] = "AWAITING"
    /\ owners[t] = {}
    /\ TaskType[t] = AgentType[a]
    /\ \A d \in deps[t]: status[d] = "COMPLETED"
    /\ candidate' = [candidate EXCEPT ![a] = t]
    /\ UNCHANGED <<status, owners, deps, scheduled>>

\* The safe claim condition. The implementation should enforce this in one
\* conditional UPDATE, not by reading AWAITING and then updating RUNNING.
CanAccept(a, t) ==
    /\ status[t] = "AWAITING"
    /\ owners[t] = {}
    /\ TaskType[t] = AgentType[a]
    /\ \A d \in deps[t]: status[d] = "COMPLETED"

\* Accept the remembered candidate.
\* UnsafeAccept = TRUE keeps the stale candidate valid after another agent
\* has already claimed the task. That reproduces the current race.
Accept(a) ==
    /\ candidate[a] # NoTask
    /\ LET t == candidate[a] IN
         /\ (UnsafeAccept \/ CanAccept(a, t))
         /\ status' = [status EXCEPT ![t] = "RUNNING"]
         /\ owners' = [owners EXCEPT ![t] = owners[t] \union {a}]
         /\ candidate' = [candidate EXCEPT ![a] = NoTask]
         /\ UNCHANGED <<deps, scheduled>>

Complete(a, t) ==
    /\ status[t] = "RUNNING"
    /\ owners[t] = {a}
    /\ status' = [status EXCEPT ![t] = "COMPLETED"]
    /\ owners' = [owners EXCEPT ![t] = {}]
    /\ scheduled' = scheduled \union (IF t \in RearmTasks THEN {t} ELSE {})
    /\ UNCHANGED <<deps, candidate>>

Fail(a, t) ==
    /\ status[t] = "RUNNING"
    /\ owners[t] = {a}
    /\ status' = [status EXCEPT ![t] = "FAILED"]
    /\ owners' = [owners EXCEPT ![t] = {}]
    /\ scheduled' = scheduled \union (IF t \in RetryTasks THEN {t} ELSE {})
    /\ UNCHANGED <<deps, candidate>>

\* Abstract passage of time: a scheduled re-arm/retry becomes due.
Tick(t) ==
    /\ t \in scheduled
    /\ status[t] \in {"COMPLETED", "FAILED"}
    /\ status' = [status EXCEPT ![t] = "AWAITING"]
    /\ scheduled' = scheduled \ {t}
    /\ owners' = [owners EXCEPT ![t] = {}]
    /\ UNCHANGED <<deps, candidate>>

\* Shared deletion effect: remove the task and every reference to it.
DeleteState(t) ==
    /\ status' = [status EXCEPT ![t] = "none"]
    /\ owners' = [owners EXCEPT ![t] = {}]
    /\ scheduled' = scheduled \ {t}
    /\ deps' = [x \in Tasks |-> deps[x] \ {t}]
    /\ candidate' = [a \in Agents |->
        IF candidate[a] = t THEN NoTask ELSE candidate[a]]

Delete(t) ==
    /\ status[t] # "none"
    /\ DeleteState(t)

\* Auto-delete is a transition that fires after a terminal status.
AutoDelete(t) ==
    /\ status[t] \in {"COMPLETED", "FAILED"}
    /\ t \in DeleteTasks
    /\ DeleteState(t)

Next ==
    \/ \E t \in Tasks: Create(t)
    \/ \E a \in Agents, t \in Tasks: Poll(a, t)
    \/ \E a \in Agents: Accept(a)
    \/ \E a \in Agents, t \in Tasks: Complete(a, t)
    \/ \E a \in Agents, t \in Tasks: Fail(a, t)
    \/ \E t \in Tasks: Tick(t)
    \/ \E t \in Tasks: AutoDelete(t)
    \/ \E t \in Tasks: Delete(t)

Spec == Init /\ [][Next]_vars

\* Safety properties.
AtMostOneOwner ==
    \A t \in Tasks: Cardinality(owners[t]) <= 1

RunningHasOneOwner ==
    \A t \in Tasks: status[t] = "RUNNING" <=> Cardinality(owners[t]) = 1

\* Dependency gating is enforced by Poll/CanAccept at claim time. It is not a
\* state invariant: a dependency may re-arm while an already-running dependent
\* continues, which is valid because the dependent already consumed its input.

NoDanglingDeps ==
    \A t \in Tasks:
        status[t] # "none" =>
            \A d \in deps[t]: status[d] # "none"

ScheduledOnlyTerminal ==
    \A t \in scheduled: status[t] \in {"COMPLETED", "FAILED"}

ScheduledRelevant ==
    scheduled \subseteq RearmTasks \cup RetryTasks

Inv ==
    /\ TypeInvariant
    /\ AtMostOneOwner
    /\ RunningHasOneOwner
    /\ NoDanglingDeps
    /\ ScheduledOnlyTerminal
    /\ ScheduledRelevant

=============================================================================
