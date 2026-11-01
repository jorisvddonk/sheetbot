---------------------------- MODULE TransitionEngine ----------------------------
\* A focused model of SheetBot's transition evaluation.
\*
\* It models one task with a fixed transition table:
\*   1. COMPLETED -> DELETED, immediate
\*   2. FAILED    -> AWAITING, every, while retryCount < 2, increments retryCount
\*   3. AWAITING  -> PAUSED, every
\*
\* Conditions are abstracted to an operator over task data. JSON Schema itself
\* is not modeled. The point is to check scheduling, first-match immediate
\* transitions, data mutation, and schedule cleanup.

EXTENDS Naturals, FiniteSets, TLC

Statuses == {"AWAITING", "RUNNING", "COMPLETED", "FAILED", "PAUSED", "DELETED"}
TransitionIds == {1, 2, 3}
NoTransition == 0

From == <<{"COMPLETED"}, {"FAILED"}, {"AWAITING"}>>

Timing == <<"immediate", "every", "every">>

Target == <<"DELETED", "AWAITING", "PAUSED">>

Condition(i, data) ==
    CASE i = 1 -> TRUE
      [] i = 2 -> data.retryCount < 2
      [] OTHER -> TRUE

Mutate(i, data) ==
    CASE i = 2 -> [data EXCEPT !.retryCount = data.retryCount + 1]
      [] OTHER -> data

IsImmediate(i, s, data) ==
    /\ s \in From[i]
    /\ Timing[i] = "immediate"
    /\ Condition(i, data)

ImmediateMatch(s, data) ==
    IF IsImmediate(1, s, data) THEN 1
    ELSE IF IsImmediate(2, s, data) THEN 2
    ELSE IF IsImmediate(3, s, data) THEN 3
    ELSE NoTransition

ScheduledFor(s, data) ==
    {i \in TransitionIds :
        /\ s \in From[i]
        /\ Timing[i] = "every"
        /\ Condition(i, data)}

VARIABLES status, data, scheduled

vars == <<status, data, scheduled>>

TypeInvariant ==
    /\ status \in Statuses
    /\ data \in [retryCount : Nat]
    /\ scheduled \subseteq TransitionIds

Init ==
    /\ status = "AWAITING"
    /\ data = [retryCount |-> 0]
    /\ scheduled = {}

\* Simulate a task status change, such as an agent accepting or completing.
SetStatus(s) ==
    /\ status # s
    /\ status' = s
    /\ data' = data
    /\ scheduled' = ScheduledFor(s, data)

\* Apply the first matching immediate transition, if any.
Evaluate ==
    /\ ImmediateMatch(status, data) # NoTransition
    /\ LET i == ImmediateMatch(status, data)
           newData == Mutate(i, data)
       IN
         /\ status' = Target[i]
         /\ data' = newData
         /\ scheduled' = ScheduledFor(Target[i], newData)

\* Fire a scheduled transition.
Tick(i) ==
    /\ i \in scheduled
    /\ Condition(i, data)
    /\ LET newData == Mutate(i, data)
           newStatus == Target[i]
       IN
         /\ status' = newStatus
         /\ data' = newData
         /\ scheduled' = ScheduledFor(newStatus, newData)

\* Remove a scheduled transition whose condition no longer holds.
Drop(i) ==
    /\ i \in scheduled
    /\ ~Condition(i, data)
    /\ scheduled' = scheduled \ {i}
    /\ UNCHANGED <<status, data>>

Next ==
    \/ \E s \in Statuses: SetStatus(s)
    \/ Evaluate
    \/ \E i \in TransitionIds: Tick(i)
    \/ \E i \in TransitionIds: Drop(i)

Spec == Init /\ [][Next]_vars

ScheduledAreEvery ==
    \A i \in scheduled: Timing[i] = "every"

ScheduledMatchStatus ==
    \A i \in scheduled: status \in From[i]

ScheduledConditionsHold ==
    \A i \in scheduled: Condition(i, data)

DeletedHasNoSchedules ==
    status = "DELETED" => scheduled = {}

DataNonNegative ==
    data.retryCount >= 0

Inv ==
    /\ TypeInvariant
    /\ ScheduledAreEvery
    /\ ScheduledMatchStatus
    /\ ScheduledConditionsHold
    /\ DeletedHasNoSchedules
    /\ DataNonNegative

=============================================================================
