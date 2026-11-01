---------------------------- MODULE TaskLifecycleLeases ----------------------------
\* Extends the task lifecycle with agent crashes and lease reclamation.
\*
\* A running task whose agent is no longer up is reclaimed to AWAITING.
\* The liveness property ReclaimedEventually is checked under weak fairness
\* of the Reclaim action.

EXTENDS Naturals, FiniteSets, TLC

Agents == {"a1", "a2"}
Tasks == {"t1", "t2"}
NoAgent == "NO_AGENT"
NoTask == "NO_TASK"

Statuses == {"none", "AWAITING", "RUNNING", "COMPLETED", "FAILED"}

ASSUME NoAgent \notin Agents
ASSUME NoTask \notin Tasks

VARIABLES status, owner, up, candidate

vars == <<status, owner, up, candidate>>

TypeInvariant ==
    /\ status \in [Tasks -> Statuses]
    /\ owner \in [Tasks -> Agents \cup {NoAgent}]
    /\ up \subseteq Agents
    /\ candidate \in [Agents -> Tasks \cup {NoTask}]

Init ==
    /\ status = [t \in Tasks |-> "none"]
    /\ owner = [t \in Tasks |-> NoAgent]
    /\ up = Agents
    /\ candidate = [a \in Agents |-> NoTask]

Create(t) ==
    /\ status[t] = "none"
    /\ status' = [status EXCEPT ![t] = "AWAITING"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ UNCHANGED <<up, candidate>>

Poll(a, t) ==
    /\ a \in up
    /\ status[t] = "AWAITING"
    /\ owner[t] = NoAgent
    /\ candidate' = [candidate EXCEPT ![a] = t]
    /\ UNCHANGED <<status, owner, up>>

Accept(a) ==
    /\ a \in up
    /\ candidate[a] # NoTask
    /\ LET t == candidate[a] IN
         /\ status[t] = "AWAITING"
         /\ owner[t] = NoAgent
         /\ status' = [status EXCEPT ![t] = "RUNNING"]
         /\ owner' = [owner EXCEPT ![t] = a]
         /\ candidate' = [candidate EXCEPT ![a] = NoTask]
         /\ UNCHANGED up

Complete(a, t) ==
    /\ a \in up
    /\ status[t] = "RUNNING"
    /\ owner[t] = a
    /\ status' = [status EXCEPT ![t] = "COMPLETED"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ UNCHANGED <<up, candidate>>

Fail(a, t) ==
    /\ a \in up
    /\ status[t] = "RUNNING"
    /\ owner[t] = a
    /\ status' = [status EXCEPT ![t] = "FAILED"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ UNCHANGED <<up, candidate>>

\* An agent disappears. Its RUNNING task stays RUNNING until reclaimed.
Crash(a) ==
    /\ a \in up
    /\ up' = up \ {a}
    /\ UNCHANGED <<status, owner, candidate>>

Recover(a) ==
    /\ a \notin up
    /\ up' = up \union {a}
    /\ UNCHANGED <<status, owner, candidate>>

\* The lease has expired because the owner is not up.
Reclaim(t) ==
    /\ status[t] = "RUNNING"
    /\ owner[t] \notin up
    /\ status' = [status EXCEPT ![t] = "AWAITING"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ UNCHANGED <<up, candidate>>

DeleteState(t) ==
    /\ status' = [status EXCEPT ![t] = "none"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ candidate' = [a \in Agents |->
        IF candidate[a] = t THEN NoTask ELSE candidate[a]]
    /\ UNCHANGED up

Delete(t) ==
    /\ status[t] # "none"
    /\ DeleteState(t)

Next ==
    \/ \E t \in Tasks: Create(t)
    \/ \E a \in Agents, t \in Tasks: Poll(a, t)
    \/ \E a \in Agents: Accept(a)
    \/ \E a \in Agents, t \in Tasks: Complete(a, t)
    \/ \E a \in Agents, t \in Tasks: Fail(a, t)
    \/ \E a \in Agents: Crash(a)
    \/ \E a \in Agents: Recover(a)
    \/ \E t \in Tasks: Reclaim(t)
    \/ \E t \in Tasks: Delete(t)

Spec == Init /\ [][Next]_vars

\* Fairness on reclamation is required to prove crash recovery.
LiveSpec == Spec /\ \A t \in Tasks: WF_vars(Reclaim(t))

\* Safety.
RunningHasOneOwner ==
    \A t \in Tasks:
        (status[t] = "RUNNING") <=> (owner[t] # NoAgent)

NoOwnerWhenNotRunning ==
    \A t \in Tasks:
        status[t] # "RUNNING" => owner[t] = NoAgent

OwnerAlwaysKnown ==
    \A t \in Tasks:
        status[t] = "RUNNING" => owner[t] \in Agents

CandidateExists ==
    \A a \in Agents:
        candidate[a] = NoTask \/ candidate[a] \in Tasks

Inv ==
    /\ TypeInvariant
    /\ RunningHasOneOwner
    /\ NoOwnerWhenNotRunning
    /\ OwnerAlwaysKnown
    /\ CandidateExists

\* Liveness: a running task whose owner is gone is eventually no longer
\* running under that owner. The task may be reclaimed to AWAITING, finish
\* after the owner recovers, or be deleted.
ReclaimedEventually ==
    \A t \in Tasks:
        (status[t] = "RUNNING" /\ owner[t] \notin up) ~>
            (status[t] # "RUNNING" \/ owner[t] \in up)

=============================================================================
