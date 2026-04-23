# Lec12 - Scheduling 3: Scheduling and Deadlock

## Learning Objectives
After this lecture, you should be able to explain why deadlock is a severe form of non-progress, model resource dependencies using resource-allocation graphs, run vector-based deadlock detection and safety checks, and choose between prevention, recovery, avoidance, and denial in practical systems.

## 1. Recap: Scheduling Ideas That Matter for Progress
### 1.1 Real-time scheduling and EDF
The central goal of real-time scheduling is **predictability of performance**, not just high average speed. In hard real-time systems, missing deadlines is unacceptable, so admission and scheduling must provide guarantees before execution whenever possible.

A periodic task is described as $(P_i, C_i)$, where $P_i$ is period and $C_i$ is required computation per period. Under EDF, absolute deadlines evolve as:

$$
D_i^{t+1} = D_i^t + P_i
$$

The scheduling rule is: **always run the active task with the closest absolute deadline**.

### 1.2 Forward progress and starvation context
Progress reasoning still depends on starvation analysis:
- **LCFS, FCFS, strict priority, SRTF, and MLFQ** can all starve some jobs under certain workloads.
- **Priority inversion** is one concrete progress failure in which a high-priority job waits behind a low-priority lock holder while medium-priority work keeps running.

:::remark Question: At the inversion point, which job does strict-priority scheduling choose?
It chooses the **medium-priority runnable job**, not the blocked high-priority one. That is why inversion can persist unless we add a mechanism such as priority donation/inheritance.
:::

### 1.3 Fairness and policy recap
Two useful reminders before entering deadlock analysis:
- Proportional-share scheduling gives each job a share and avoids complete starvation if every job has nonzero share.
- Linux CFS approximates fair sharing by picking the thread with minimum virtual runtime.

A practical goal-to-policy mapping is:

| Goal | Typical Choice |
| --- | --- |
| CPU throughput | FCFS |
| Average completion time | SRTF approximation |
| I/O throughput | SRTF approximation |
| Fairness (CPU time) | Linux CFS |
| Fairness (wait to get CPU) | Round Robin |
| Meeting deadlines | EDF |
| Favoring important tasks | Priority scheduling |

## 2. From Starvation to Deadlock
A precise distinction is essential:
- **Starvation** means a thread waits indefinitely and may or may not eventually run.
- **Deadlock** means circular waiting for resources; without external intervention, progress cannot resume.

![Deadlock cycle and starvation relation](./lec12_materials/deadlock_cycle_starvation_relation.png)

Key relationship:
- **Deadlock implies starvation**, because some threads wait forever.
- **Starvation does not necessarily imply deadlock**, because the system may eventually schedule the starving thread.

:::remark Question: Why can starvation end while deadlock usually cannot?
Starvation can end if future scheduling decisions change in favor of the waiting thread. In deadlock, each waiting thread depends on another waiting thread in a cycle, so the cycle cannot break by normal local progress.
:::

## 3. Running Example: Single-Lane Bridge Crossing
The bridge example maps physical motion to resource acquisition:
- Each road segment is treated as a resource.
- A car must hold its current segment and acquire the next one before moving.
- On the narrow bridge, opposite directions compete for a constrained pair of segments.

![Bridge crossing deadlock flow](./lec12_materials/bridge_crossing_deadlock_flow.png)

If two cars enter from opposite ends and each holds one half while requesting the other, the state becomes deadlocked. If one side backs up (rollback/preemption flavor), the cycle can be broken.

This same example also separates deadlock from starvation:
- Deadlock: both directions wait on each other.
- Starvation: one direction keeps winning repeatedly, so the other waits for a long time but not necessarily forever.

## 4. Deadlock with Locks: Why It Is Non-Deterministic
Consider two threads and two locks:
- Thread A: `x.Acquire(); y.Acquire(); ... y.Release(); x.Release();`
- Thread B: `y.Acquire(); x.Acquire(); ... x.Release(); y.Release();`

![Lock deadlock pattern](./lec12_materials/lock_deadlock_pattern_overview.png)

This pattern is **non-deterministic**:
- In an unlucky schedule, each thread acquires one lock and stalls forever on the second.
- In a lucky schedule, one thread acquires both locks first and completes.

![Unlucky schedule deadlock](./lec12_materials/lock_deadlock_unlucky_schedule.png)

![Lucky schedule no deadlock](./lec12_materials/lock_deadlock_lucky_schedule.png)

Because the failure depends on timing/interleaving, reproduction and debugging are difficult.

## 5. Deadlocks Are Not Only About Locks
Threads can deadlock while waiting for many kinds of resources:
- Locks,
- Terminals,
- Printers,
- CD drives,
- Memory,
- Even other threads via communication dependencies.

A memory example:
- Two threads each need 2 MB total.
- System has only 2 MB free.
- Each thread allocates 1 MB and then waits for another 1 MB.
- Neither can proceed, so both wait forever.

![Deadlock with space example](./lec12_materials/deadlock_with_space_example.png)

## 6. Four Requirements for the Occurrence of Deadlock
Deadlock occurs only when all four conditions hold:
1. **Mutual exclusion**: at most one thread can use a resource instance at a time.
2. **Hold and wait**: a thread holds at least one resource while waiting for more.
3. **No preemption**: resources are released voluntarily by holders.
4. **Circular wait**: there exists a waiting cycle $T_1 \to T_2 \to \cdots \to T_n \to T_1$.

![Four deadlock conditions](./lec12_materials/four_deadlock_conditions.png)

Designing prevention techniques is essentially about breaking at least one of these four conditions.

## 7. Detecting Deadlock with Resource-Allocation Graphs
A resource-allocation graph (RAG) models system state with:
- Thread nodes $T_i$,
- Resource-type nodes $R_j$ (possibly multiple instances each),
- Request edges $T_i \rightarrow R_j$,
- Assignment edges $R_j \rightarrow T_i$.

![Resource-allocation graph examples](./lec12_materials/resource_allocation_graph_examples.png)

Important interpretation rule:
- A cycle is always suspicious.
- A cycle is **not always** sufficient for deadlock when resource types have multiple instances.

:::remark Question: Does a cycle in a resource-allocation graph always mean deadlock?
No. With single-instance resources, cycle and deadlock are equivalent. With multi-instance resources, a cycle can exist while some thread can still finish and release resources, which may break the cycle.
:::

## 8. Vector-Based Deadlock Detection Algorithm
Represent resource counts by nonnegative vectors:
- $[\mathrm{FreeResources}]$: currently free instances per resource type,
- $[\mathrm{Request}_x]$: current outstanding request of thread $x$,
- $[\mathrm{Alloc}_x]$: resources currently held by thread $x$.

Algorithm idea: repeatedly find a thread that can finish with currently available resources, simulate its completion, and release its allocation back to availability.

![Deadlock detection algorithm](./lec12_materials/deadlock_detection_algorithm.png)

```text
[Avail] = [FreeResources]
UNFINISHED = all threads
repeat
  progress = false
  for each t in UNFINISHED:
    if [Request_t] <= [Avail]:
      remove t from UNFINISHED
      [Avail] = [Avail] + [Alloc_t]
      progress = true
until progress == false

if UNFINISHED is not empty:
  deadlock exists
```

### 8.1 Applying detection to dining lawyers (two modeling cases)
- Case 1: represent chopsticks as one resource type `[5]`, and each lawyer can use any two.
- Case 2: represent chopsticks as `[1,1,1,1,1]`, and each lawyer can use only adjacent chopsticks.

:::remark Question: How do the two dining-lawyer cases behave under deadlock detection?
In both cases, the classic all-hold-one state is detected as deadlock because no thread has enough available resources to complete and release. The difference is modeling detail: Case 1 captures aggregate quantity; Case 2 captures adjacency constraints explicitly.
:::

## 9. Four System-Level Approaches to Deadlock
A system can choose among four broad approaches:
1. **Deadlock prevention**: design rules so deadlock preconditions never all hold.
2. **Deadlock recovery**: let deadlock happen, then force the system back to progress.
3. **Deadlock avoidance**: grant requests only when the resulting state remains safe.
4. **Deadlock denial**: ignore deadlock possibility (the ostrich approach).

In practice, many systems protect kernel/internal critical paths carefully but tolerate some application-level deadlock risk.

## 10. Prevention Techniques and Their Tradeoffs
### 10.1 (Virtually) infinite resources
If resource supply is sufficiently large, threads may never block on those resources.
- Real systems use this only approximately.
- Virtual memory is one example of creating the illusion of much larger memory space.

### 10.2 No sharing
If resources are never shared, many waiting patterns disappear. This is usually unrealistic for general-purpose operating systems.

### 10.3 Do not allow waiting (fail fast, then retry)
Instead of waiting while holding resources, deny immediately and retry later.
- This can avoid hold-and-wait cycles.
- It may waste work and reduce efficiency because repeated retries are costly.

### 10.4 Request everything at the beginning
Require each thread to ask for all needed resources upfront.
- Advantage: prevents incremental hold-and-wait cycles.
- Cost: hard to predict future needs; over-allocation lowers utilization.

### 10.5 Enforce a consistent resource order
Require all threads to acquire resources in the same global order.

![Acquire resources in consistent order](./lec12_materials/acquire_resources_consistent_order.png)

This breaks circular wait by construction.

:::remark Question: Does lock release order matter for deadlock prevention?
The primary deadlock condition is created by **acquire order**, not release order. Changing release order can affect performance and contention behavior, but consistent acquire order is what eliminates circular wait.
:::

### 10.6 Request resources atomically
Another prevention pattern is to replace incremental lock acquisition with an atomic interface such as `Acquire_both(x, y)`.

Important implementation detail:
- If `Acquire_both` still acquires in caller-given order, then `Acquire_both(x, y)` and `Acquire_both(y, x)` can recreate the same circular-wait risk.
- The implementation must either enforce a canonical global order internally or serialize entry with a gate lock like `z`.

The `z`-gate approach prevents deadlock by forcing one thread at a time into the multi-lock region, but it also reduces concurrency and may increase waiting time.

## 11. Recovery Techniques: Regaining Progress After Deadlock
Three common recovery ideas are:
1. Terminate a deadlocked thread and force resource release.
2. Preempt resources from a thread without fully terminating it.
3. Roll back one or more threads to a prior safe point.

![Deadlock recovery techniques](./lec12_materials/deadlock_recovery_techniques.png)

Tradeoffs:
- Termination can leave shared state inconsistent.
- Preemption may violate computation semantics for some resources.
- Rollback needs checkpointing or transactional semantics and can repeat if policy does not change.

## 12. Avoidance: Safe State vs Unsafe State
A naive policy says: “grant a request if it does not cause deadlock right now.” This is insufficient.

The right goal is to prevent the system from entering an **unsafe state**.

![Deadlock avoidance three states](./lec12_materials/deadlock_avoidance_three_states.png)

Definitions:
- **Safe state**: there exists at least one completion sequence for all threads.
- **Unsafe state**: no deadlock yet, but future requests can force deadlock.
- **Deadlocked state**: deadlock already exists.

:::remark Question: Why does checking “deadlock now” fail?
Because a request can be harmless at this instant but move the system into a state from which deadlock becomes unavoidable under some valid future requests. Avoidance must check future safety, not only present deadlock.
:::

## 13. Banker’s Algorithm for Deadlock Avoidance
Banker’s algorithm formalizes avoidance with two assumptions:
- Each thread declares a maximum resource demand in advance.
- Each request is tentatively granted only if the resulting state remains safe.

A common safety check uses:

$$
[\mathrm{Need}_i] = [\mathrm{Max}_i] - [\mathrm{Alloc}_i]
$$

After tentative grant, run a safety simulation similar to detection; grant permanently only if some safe completion order exists.

![Banker's algorithm core check](./lec12_materials/bankers_algorithm_core_check.png)

In words, we keep the system in a state where there exists a sequence $\{T_1,T_2,\ldots,T_n\}$ such that each thread can eventually get needed resources, finish, and release.

### 13.1 Banker with dining lawyers
For five lawyers and five chopsticks, Banker-style reasoning can be expressed as:
- A request is safe if it is not consuming the last critical availability in a way that leaves everyone still unable to finish.
- In the classic pattern, forbid transitions that make every lawyer hold one chopstick while none can get the second.

![Banker's algorithm dining lawyers](./lec12_materials/bankers_algorithm_dining_lawyers.png)

:::remark Question: How does this extend to k-handed lawyers?
If each lawyer needs $k$ chopsticks, a safe-state check must ensure that after granting a request there is still at least one thread that can eventually reach $k$, finish, and release. Heuristics like “do not grant the last/second-last/... unit if no one can complete” are intuitive special cases of the full Banker safety test.
:::

## 14. Key Takeaways
- Deadlock is a specific structural progress failure based on circular resource dependencies.
- The four conditions framework is the core lens for designing prevention rules.
- Cycles in graphs are warning signals, but multi-instance resources require deeper analysis.
- Detection finds deadlock after it appears; avoidance (Banker) tries to stay in safe states.
- Practical systems mix prevention, selective recovery, and scoped denial based on engineering cost.

## Appendix A. Exam Review

### A.1 Must-remember definitions
- **Starvation**: waiting indefinitely without guaranteed progress.
- **Deadlock**: circular waiting that cannot resolve without intervention.
- **Safe state**: a completion sequence for all threads exists.
- **Unsafe state**: no deadlock yet, but deadlock can become unavoidable.
- **Deadlocked state**: at least one circular wait already blocks progress.

### A.2 Compare the four handling strategies
| Strategy | Core Idea | Main Benefit | Main Cost |
| --- | --- | --- | --- |
| Prevention | Break one deadlock condition by design | Strong structural guarantee | Lower flexibility/utilization |
| Recovery | Repair after deadlock occurs | High concurrency before failure | Rollback/kill complexity |
| Avoidance | Grant only if state stays safe | Better utilization than strict prevention | Safety-check overhead and max-claim requirement |
| Denial | Ignore deadlock risk | Simplicity | Possible unresolved hangs |

### A.3 Algorithm templates to memorize
- Deadlock detection loop: find satisfiable request, simulate completion, release allocation, repeat.
- Banker safety loop: simulate tentative grant, test for a full safe sequence, then grant or delay.

### A.4 Typical short-answer questions
1. Why is deadlock a stronger claim than starvation?
2. Why can a cycle fail to imply deadlock in a multi-instance RAG?
3. Why is “check deadlock now” weaker than “check safe state”? 
4. Why does consistent acquire order prevent circular wait?
5. How do detection and Banker differ in timing and purpose?

### A.5 Common mistakes
- Treating all cycles as deadlock without checking resource multiplicity.
- Forgetting that unsafe is not yet deadlocked.
- Confusing detection (post-fact) with avoidance (pre-grant).
- Assuming rollback is always semantically valid for every resource.
