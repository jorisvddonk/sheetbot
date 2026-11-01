---------------------------- MODULE TaskLifecycleLeases ----------------------------
\* Task lifecycle with time-based leases, lease tokens, heartbeats, and crashes.
\*
\* Time is discrete and bounded by MaxTime. A claim gives the task a token and
\* an expiry. Heartbeat extends the expiry. Reclaim returns an expired task to
\* AWAITING. Complete/Fail require the current token.

EXTENDS Naturals, FiniteSets, TLC

Agents == {"a1", "a2"}
Tasks == {"t1", "t2"}
NoAgent == "NO_AGENT"
NoLease == 0

Statuses == {"none", "AWAITING", "RUNNING", "COMPLETED", "FAILED"}
LeaseDuration == 3
MaxTime == 12
LeaseTokenMax == MaxTime + LeaseDuration

VARIABLES status, owner, lease, leaseUntil, up, now

vars == <<status, owner, lease, leaseUntil, up, now>>

TypeInvariant ==
    /\ status \in [Tasks -> Statuses]
    /\ owner \in [Tasks -> Agents \cup {NoAgent}]
    /\ lease \in [Tasks -> Nat]
    /\ leaseUntil \in [Tasks -> Nat]
    /\ up \subseteq Agents
    /\ now \in 0..MaxTime

Init ==
    /\ status = [t \in Tasks |-> "none"]
    /\ owner = [t \in Tasks |-> NoAgent]
    /\ lease = [t \in Tasks |-> NoLease]
    /\ leaseUntil = [t \in Tasks |-> 0]
    /\ up = Agents
    /\ now = 0

Create(t) ==
    /\ status[t] = "none"
    /\ status' = [status EXCEPT ![t] = "AWAITING"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ lease' = [lease EXCEPT ![t] = NoLease]
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = 0]
    /\ UNCHANGED <<up, now>>

\* Atomic claim. The token is derived from the claim time; only the holder of
\* that token can heartbeat, complete, or fail the task.
Claim(a, t) ==
    /\ a \in up
    /\ status[t] = "AWAITING"
    /\ owner[t] = NoAgent
    /\ lease[t] = NoLease
    /\ status' = [status EXCEPT ![t] = "RUNNING"]
    /\ owner' = [owner EXCEPT ![t] = a]
    /\ lease' = [lease EXCEPT ![t] = now + 1]
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = now + LeaseDuration]
    /\ UNCHANGED <<up, now>>

Heartbeat(a, t, l) ==
    /\ a \in up
    /\ l \in 1..LeaseTokenMax
    /\ status[t] = "RUNNING"
    /\ owner[t] = a
    /\ lease[t] = l
    /\ leaseUntil[t] > now
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = now + LeaseDuration]
    /\ UNCHANGED <<status, owner, lease, up, now>>

Complete(a, t, l) ==
    /\ a \in up
    /\ l \in 1..LeaseTokenMax
    /\ status[t] = "RUNNING"
    /\ owner[t] = a
    /\ lease[t] = l
    /\ status' = [status EXCEPT ![t] = "COMPLETED"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ lease' = [lease EXCEPT ![t] = NoLease]
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = 0]
    /\ UNCHANGED <<up, now>>

Fail(a, t, l) ==
    /\ a \in up
    /\ l \in 1..LeaseTokenMax
    /\ status[t] = "RUNNING"
    /\ owner[t] = a
    /\ lease[t] = l
    /\ status' = [status EXCEPT ![t] = "FAILED"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ lease' = [lease EXCEPT ![t] = NoLease]
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = 0]
    /\ UNCHANGED <<up, now>>

Crash(a) ==
    /\ a \in up
    /\ up' = up \ {a}
    /\ UNCHANGED <<status, owner, lease, leaseUntil, now>>

Recover(a) ==
    /\ a \notin up
    /\ up' = up \union {a}
    /\ UNCHANGED <<status, owner, lease, leaseUntil, now>>

\* The lease has expired. Reclaiming clears the token, so a late completion
\* with the old token is no longer enabled.
Reclaim(t) ==
    /\ status[t] = "RUNNING"
    /\ lease[t] # NoLease
    /\ leaseUntil[t] <= now
    /\ status' = [status EXCEPT ![t] = "AWAITING"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ lease' = [lease EXCEPT ![t] = NoLease]
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = 0]
    /\ UNCHANGED <<up, now>>

DeleteState(t) ==
    /\ status' = [status EXCEPT ![t] = "none"]
    /\ owner' = [owner EXCEPT ![t] = NoAgent]
    /\ lease' = [lease EXCEPT ![t] = NoLease]
    /\ leaseUntil' = [leaseUntil EXCEPT ![t] = 0]
    /\ UNCHANGED <<up, now>>

Delete(t) ==
    /\ status[t] # "none"
    /\ DeleteState(t)

Tick ==
    /\ now < MaxTime
    /\ now' = now + 1
    /\ UNCHANGED <<status, owner, lease, leaseUntil, up>>

Next ==
    \/ \E t \in Tasks: Create(t)
    \/ \E a \in Agents, t \in Tasks: Claim(a, t)
    \/ \E a \in Agents, t \in Tasks, l \in 1..LeaseTokenMax: Heartbeat(a, t, l)
    \/ \E a \in Agents, t \in Tasks, l \in 1..LeaseTokenMax: Complete(a, t, l)
    \/ \E a \in Agents, t \in Tasks, l \in 1..LeaseTokenMax: Fail(a, t, l)
    \/ \E a \in Agents: Crash(a)
    \/ \E a \in Agents: Recover(a)
    \/ \E t \in Tasks: Reclaim(t)
    \/ \E t \in Tasks: Delete(t)
    \/ Tick

Spec == Init /\ [][Next]_vars

\* Fairness: time advances, and an expired lease is eventually reclaimed.
LiveSpec == Spec /\ WF_vars(Tick) /\ \A t \in Tasks: WF_vars(Reclaim(t))

RunningHasLease ==
    \A t \in Tasks:
        status[t] = "RUNNING" =>
            /\ owner[t] \in Agents
            /\ lease[t] # NoLease
            /\ leaseUntil[t] >= lease[t]

NoLeaseWhenNotRunning ==
    \A t \in Tasks:
        status[t] # "RUNNING" =>
            /\ owner[t] = NoAgent
            /\ lease[t] = NoLease
            /\ leaseUntil[t] = 0

LeaseTokenBounded ==
    \A t \in Tasks:
        lease[t] \in 0..LeaseTokenMax

Inv ==
    /\ TypeInvariant
    /\ RunningHasLease
    /\ NoLeaseWhenNotRunning
    /\ LeaseTokenBounded

\* Once a lease is expired, the task must stop being RUNNING under that lease.
ExpiredLeaseEventuallyReleased ==
    \A t \in Tasks:
        (status[t] = "RUNNING" /\ leaseUntil[t] <= now) ~>
            (status[t] # "RUNNING")

=============================================================================
