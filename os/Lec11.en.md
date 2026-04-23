# Lec11 - Scheduling 2: Case Studies, Fairness, Real Time, and Forward Progress

## Learning Objectives
After this lecture, you should be able to analyze starvation and priority inversion in concrete execution flows, explain why real-time scheduling needs deadline-based policies such as **EDF**, compare Linux **O(1)** and **CFS** design choices, and choose an appropriate scheduler for a stated system goal.

## 1. Recap: Why Scheduling Is Still About Tradeoffs
CPU scheduling still balances the same core goals:
- **Minimize completion time** (especially for interactive work).
- **Maximize throughput** (especially for batch computation).
- **Maintain fairness** (so jobs all make progress).
- **Provide predictability** (especially for real-time workloads).

Classical policies remain useful reference points:
- **FCFS** is simple but suffers head-of-line blocking.
- **Round Robin (RR)** improves waiting-time fairness by time slicing.
- **Strict Priority** handles importance but can cause starvation and priority inversion.
- **SJF/SRTF** are strong for average completion time but can be unfair to long jobs.

:::remark Question: Could we always mirror the best FCFS ordering?
Only with an oracle that knows future runtimes exactly. Real schedulers do not have perfect future information, so practical policies approximate this ideal using history and heuristics.
:::

## 2. Predicting Future CPU Bursts from Past Behavior
A practical way to approximate shortest-remaining-time behavior is to estimate the next burst from prior bursts.

Programs are often behaviorally stable over short windows:
- If a program was mostly I/O-bound recently, it is likely to remain bursty and short.
- If behavior were purely random, history-based prediction would not help.

A standard estimator is **exponential averaging**:

$$
\tau_n = \alpha t_{n-1} + (1-\alpha)\tau_{n-1}, \quad 0 < \alpha \le 1
$$

Here:
- $t_{n-1}$ is the actual previous burst length,
- $\tau_{n-1}$ is the previous estimate,
- $\tau_n$ is the next estimate.

![Adaptive burst prediction example](./lec11_materials/adaptive_burst_prediction_example.png)

## 3. Lottery Scheduling: Proportional Progress with Randomized Choice
Lottery scheduling gives each job some number of tickets and draws a winning ticket each quantum. Over time, expected CPU share is proportional to ticket count.

Benefits:
- Simple proportional-share intuition.
- Natural starvation avoidance if every job has at least one ticket.
- Graceful behavior when load changes (shares adjust proportionally, not via hard queue barriers).

One policy example is to give short jobs many tickets and long jobs fewer tickets:

| # short jobs / # long jobs | % CPU each short job gets | % CPU each long job gets |
| --- | --- | --- |
| 1 / 1 | 91% | 9% |
| 0 / 2 | N/A | 50% |
| 2 / 0 | 50% | N/A |
| 10 / 1 | 9.9% | 0.99% |
| 1 / 10 | 50% | 5% |

![Lottery ticket allocation table](./lec11_materials/lottery_ticket_allocation_table.png)

:::remark Question: What if there are too many short jobs to still give good completion time?
If system load is already very high (for example, load average near 100), no ticket trick can create missing CPU cycles. At that point the system needs admission control, load shedding, or capacity expansion.
:::

A simple implementation uses cumulative ticket ranges:
1. Compute total tickets:
$$
N_{ticket}=\sum_i N_i
$$
2. Draw a random integer $d \in [1, N_{ticket}]$.
3. Pick the first job $j$ whose cumulative ticket sum exceeds $d$.

![Lottery simple mechanism](./lec11_materials/lottery_simple_mechanism.png)

## 4. Multi-Level Feedback Queue (MLFQ): Priority as a Dynamic Signal
MLFQ uses multiple queues with different priorities and often different scheduling behavior.

Typical state transitions:
1. A new job starts at high priority.
2. If it uses a full quantum (CPU-bound behavior), demote it.
3. If it yields early or sleeps often (interactive/I/O behavior), keep or promote it.

This tries to approximate SRTF without exact future knowledge:
- Long CPU-bound jobs drift downward.
- Short interactive bursts stay near the top.

![MLFQ priority feedback overview](./lec11_materials/mlfq_priority_feedback_overview.png)

Between-queue scheduling can be done in two common ways:
- **Fixed priority across queues**: run highest non-empty queue first.
- **CPU-share split across queues**: for example 70% / 20% / 10% by level.

### 4.1 Gaming the scheduler
MLFQ can be gamed: a CPU-heavy app may insert meaningless I/O to appear interactive and stay high-priority.

A classic anecdote is an Othello program that inserted extra `printf` operations to manipulate scheduling behavior and run faster than competitors.

:::remark Question: Why does gaming hurt everyone if everyone does it?
Because the classifier signal becomes meaningless. If every CPU-bound app pretends to be interactive, high-priority queues saturate and the distinction that MLFQ relies on collapses.
:::

## 5. Mixed Workloads and Multi-Core Effects
Real systems run mixtures of interactive apps, throughput-oriented jobs, and periodic/background tasks at the same time.

Key design tensions:
- Should short observed bursts imply high priority?
- Should servers, desktops, tablets, and phones share identical policies?
- Can we trust applications to self-report that they are interactive?

:::remark Question: How should a scheduler treat mixed app types?
The scheduler should infer behavior from observed execution patterns, but also cap the impact of misclassification. In practice, systems combine heuristics, fairness constraints, and starvation guards.
:::

On multi-core systems:
- Algorithmic ideas are similar to single-core scheduling.
- Implementation benefits from per-core run queues.
- **CPU affinity** improves cache reuse by keeping a thread on the same core when possible.

## 6. Multiprocessor Locking and Coordination Implications
### 6.1 Spinlocks and test-and-test-and-set
A spinlock waits by busy looping instead of sleeping. This can be useful for very short waits (for example at barriers in tightly coupled parallel code).

Basic lock (high coherence traffic):

```c
int value = 0; // free

void Acquire() {
    while (test_and_set(&value)) { }
}

void Release() {
    value = 0;
}
```

Every `test_and_set` is a write, so lock ownership metadata can ping-pong between caches. A common improvement is **test-and-test-and-set**:

```c
void Acquire() {
    do {
        while (value) { }          // read-spin
    } while (test_and_set(&value));
}
```

### 6.2 Gang scheduling and scheduler activations
For parallel programs with cooperating threads:
- **Gang scheduling** tries to run related threads together to reduce wasteful spin waiting.
- **Scheduler activations** let the OS tell the runtime how many processors it currently has, so the runtime adapts thread-level parallelism.

### 6.3 Process vs thread scheduling cost
Switching threads and switching processes are not equivalent:
- Thread switch: mainly register state.
- Process switch: registers plus address-space switch, with higher cache/TLB disruption.

## 7. Real-Time Scheduling: Predictability over Average Case
Real-time scheduling focuses on whether deadlines are met, not on maximizing average throughput.

- **Hard real-time**: missing deadlines is unacceptable (safety-critical).
- **Soft real-time**: occasional misses may be tolerated (for example multimedia).

Representative policy families:
- **EDF** (Earliest Deadline First),
- **RMS** (Rate Monotonic Scheduling),
- **DM** (Deadline Monotonic),
- **CBS** (Constant Bandwidth Server, often in soft RT contexts).

### 7.1 Workload model
A common task model assumes tasks are:
- preemptable,
- independent,
- released over time,
- characterized by compute time $C$ and deadline $D$.

![Realtime workload characteristics](./lec11_materials/realtime_workload_characteristics.png)

### 7.2 Why plain RR can fail for real time
RR fairness in waiting time does not guarantee deadline satisfaction. A task can still miss its deadline under cyclic slicing.

![RR misses deadline example](./lec11_materials/rr_misses_deadline_example.png)

### 7.3 EDF policy core
For periodic task $i$ with period $P_i$ and compute demand $C_i$, represent each task as $(P_i, C_i)$.

Absolute deadlines advance by period:

$$
D_i^{t+1} = D_i^t + P_i
$$

**EDF rule**: always run the active task with the closest absolute deadline.

![EDF periodic task scheduling](./lec11_materials/edf_periodic_task_scheduling.png)

### 7.4 EDF schedulability test
A standard feasibility condition is:

$$
\sum_{i=1}^{n}\frac{C_i}{D_i} \le 1
$$

Example:

$$
\frac{1}{4} + \frac{2}{5} + \frac{2}{7} = 0.936 \le 1
$$

So this task set is schedulable under the given assumptions.

## 8. Ensuring Forward Progress: Starvation and Priority Inversion
### 8.1 Starvation vs deadlock
- **Starvation**: a thread fails to make progress for an unbounded time.
- **Deadlock**: cyclic waiting among resources.

They are different failure modes, even though both can look like "nothing moves".

### 8.2 Work-conserving assumption
A **work-conserving scheduler** never idles CPU while runnable work exists. Non-work-conserving behavior can trivially create starvation, so it is usually excluded unless explicitly intended.

### 8.3 Starvation by policy type
- **LCFS/LIFO** can starve old requests when arrival rate exceeds service rate.
- **Non-preemptive FCFS** can starve others if one task never yields.
- **RR** provides bounded waiting per cycle (though not equal throughput).
- **Strict priority** can starve low-priority work indefinitely.

### 8.4 Priority inversion flow
A canonical three-job flow:
1. Low-priority `Job 1` acquires a lock.
2. High-priority `Job 3` tries `Acquire()` and blocks.
3. Medium-priority `Job 2` keeps running, delaying `Job 1`.
4. `Job 3` is effectively starved by medium-priority work.

![Priority inversion blocking flow](./lec11_materials/priority_inversion_blocking_flow.png)

### 8.5 Priority donation / inheritance
A common fix is temporary priority transfer:
- blocked high-priority task donates priority to lock holder,
- lock holder runs and releases lock sooner,
- donated priority is removed afterward.

![Priority donation transition](./lec11_materials/priority_donation_transition.png)

:::remark Question: At the blocked point, which job does strict-priority scheduling choose without donation?
It chooses the medium-priority runnable job, which worsens inversion. Donation changes this by elevating the lock holder so it can finish the critical section.
:::

### 8.6 Live-lock corner case
Priority can also interact badly with spinning patterns:
- A high-priority loop like `while (try_lock) {}` can consume CPU aggressively.
- A low-priority lock holder may not run enough to release the lock.
- The system keeps "running" but useful progress stalls (live-lock flavor).

:::remark Question: When else can priority cause starvation or live lock?
Any pattern where high-priority work repeatedly preempts the very thread that must run to release a contended resource can trigger this behavior. Lock-aware scheduling and bounded spinning are common mitigations.
:::

### 8.7 Case study: Mars Pathfinder
The Mars Pathfinder mission experienced resets due to priority inversion in VxWorks:
- A low-priority task held a mutex needed by a high-priority data-distribution task.
- Medium-priority activity delayed the mutex holder.
- A watchdog detected missing forward progress and reset the system.

The field fix was to re-enable **priority inheritance** (which had been disabled due to performance concerns).

![Mars Pathfinder priority inversion case](./lec11_materials/mars_pathfinder_priority_inversion_case.png)

### 8.8 SRTF and MLFQ starvation risk
- SRTF can starve long jobs under a stream of short arrivals.
- MLFQ approximates SRTF, so it can inherit similar starvation pressure.

## 9. Scheduling in a Changing System Landscape
Scheduling evolved with workload and hardware shifts:
- Time-sharing era: strict priority to multiplex scarce machines.
- PC/workstation era: stronger emphasis on fairness and avoiding extremes.
- Web and datacenter era: emphasis on predictability and tail latency (for example 95th percentile goals).

This history explains why modern schedulers often combine fairness, heuristics, and workload adaptation rather than using only rigid fixed-priority rules.

## 10. Unix Nice and Linux O(1) Scheduler
### 10.1 Unix `nice`
Unix exposed user-visible priority influence via `nice` values (`-20` to `19`):
- Lower `nice` means less "nice" to others (more favored).
- Higher `nice` means lower effective priority.

### 10.2 Linux O(1) scheduler architecture
Key points:
- 140 priority levels.
- User tasks mapped to a subset; real-time/kernel tasks to higher-priority classes.
- Constant-time core operations via bitmaps and per-priority queues.
- Two arrays: **active** and **expired**; swap when active drains.

### 10.3 O(1) heuristics and RT classes
O(1) used many heuristics:
- `sleep_avg` style interactivity estimation,
- interactive credit to avoid flip-flopping,
- starvation-oriented boosting.

Real-time classes included:
- `SCHED_FIFO`: preemptive, no timeslice cap among same-priority tasks.
- `SCHED_RR`: preemptive, round-robin within priority level.

## 11. Proportional Share and Linux CFS
### 11.1 Proportional-share idea
Instead of absolute queue priority, allocate CPU in proportion to weight/share so every job can still make progress.

### 11.2 CFS core mechanism
Linux CFS tracks per-thread CPU time and picks the thread with minimum virtual runtime, approximating an ideal fair processor.

Implementation notes:
- Heap-like run queue,
- about $O(\log N)$ insertion/removal,
- sleeping threads accumulate less runtime and receive natural responsiveness boost when waking.

![Linux CFS fair queueing illustration](./lec11_materials/linux_cfs_fair_queueing_illustration.png)

### 11.3 Responsiveness constraints
Two important constraints:
1. **Target latency**: interval in which every runnable process should run.
2. **Minimum granularity**: lower bound for any single slice to avoid excessive switching.

Examples:
- Target latency 20 ms with 4 processes gives 5 ms each.
- Target latency 20 ms with 200 processes gives 0.1 ms each (too much overhead risk).
- With minimum granularity 1 ms, 100-process case can be clamped to 1 ms slices.

### 11.4 Weighted shares in CFS
Equal-share baseline:

$$
Q_i = \text{TargetLatency}\cdot\frac{1}{N}
$$

Weighted share:

$$
Q_i = \left(\frac{w_i}{\sum_p w_p}\right)\cdot\text{TargetLatency}
$$

CFS maps `nice` to weight exponentially:

$$
\text{Weight} = \frac{1024}{(1.25)^{\text{nice}}}
$$

So two CPU-bound tasks separated by `nice = 5` differ by roughly $\approx 3\times$ in weight.

## 12. Choosing and Evaluating Schedulers
### 12.1 Goal-to-policy mapping
A practical mapping is:

| I Care About | Then Choose |
| --- | --- |
| CPU Throughput | FCFS |
| Avg. Completion Time | SRTF Approximation |
| I/O Throughput | SRTF Approximation |
| Fairness (CPU Time) | Linux CFS |
| Fairness (Wait Time to Get CPU) | Round Robin |
| Meeting Deadlines | EDF |
| Favoring Important Tasks | Priority |

![Scheduler selection table](./lec11_materials/scheduler_selection_table.png)

### 12.2 How to evaluate a scheduling algorithm
Three standard methods:
- **Deterministic modeling**: fixed workload, compare computed outcomes.
- **Queueing models**: stochastic mathematical modeling.
- **Implementation/simulation**: run real algorithms on traces/data; most flexible in practice.

![Scheduling evaluation methods](./lec11_materials/scheduling_evaluation_methods.png)

## 13. Final Practical Perspective: Policy vs Capacity
Scheduling details matter most when resources are tight.

A useful operations heuristic:
- As utilization approaches 100%, response time can grow explosively.
- Most schedulers behave similarly in the linear region but fail near saturation.
- Capacity upgrades are often justified at the "knee" of the response-time curve.

![Response-time utilization knee curve](./lec11_materials/response_time_utilization_knee_curve.png)

:::remark Question: When should you optimize policy, and when should you buy faster hardware?
Tune policy while there is scheduling inefficiency to recover. Once the system is near saturation and queueing delay dominates, additional capacity (CPU/network/storage) usually gives the larger and safer gain.
:::

## 14. Key Takeaways
- **Predictability** is a first-class requirement in real-time systems; fairness alone is insufficient.
- **Priority inversion** is a concrete forward-progress bug, not just a theoretical edge case.
- **Priority donation/inheritance** is a practical mechanism that has solved real mission failures.
- **CFS** reframes scheduling as fair-rate tracking with responsiveness and throughput constraints.
- No single scheduler wins every metric; policy must match workload and system goals.

## Appendix A. Exam Review

### A.1 Must-remember definitions
- **Starvation**: unbounded delay in making progress.
- **Deadlock**: circular wait with no possible progress.
- **Priority inversion**: high-priority task blocked behind low-priority lock holder and delayed by medium-priority work.
- **EDF**: always schedule the task with nearest absolute deadline.
- **CFS**: approximate fair CPU share by virtual-runtime tracking.

### A.2 Fast policy selection checklist
1. Hard deadline guarantees needed -> use EDF-family real-time scheduling.
2. Strong wait-time fairness needed -> use RR or RR-like slices.
3. Proportional CPU fairness needed -> use CFS/proportional-share designs.
4. Importance tiers needed -> use priority scheduling with starvation safeguards.

### A.3 Core formulas to memorize
- Burst prediction:
$$
\tau_n = \alpha t_{n-1} + (1-\alpha)\tau_{n-1}
$$
- EDF feasibility:
$$
\sum_{i=1}^{n}\frac{C_i}{D_i}\le1
$$
- CFS equal share:
$$
Q_i=\text{TargetLatency}/N
$$
- CFS weighted share:
$$
Q_i=\left(\frac{w_i}{\sum_p w_p}\right)\cdot\text{TargetLatency}
$$
- Nice-to-weight mapping:
$$
\text{Weight}=1024/(1.25)^{\text{nice}}
$$

### A.4 Typical short-answer prompts
1. Why can RR fail for real-time deadline guarantees?
2. Explain the step-by-step mechanism of priority inversion.
3. Why does priority donation restore forward progress?
4. Why does CFS need both target latency and minimum granularity?
5. Why can SRTF/MLFQ still starve long jobs?

### A.5 Common mistakes
- Treating fairness as equivalent to deadline satisfaction.
- Ignoring lock-holder scheduling when analyzing priority systems.
- Assuming proportional-share policies eliminate all latency problems under overload.
- Forgetting that near 100% utilization, queueing delay can dominate any policy tweak.
