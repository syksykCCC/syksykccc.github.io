# Lec6 - Synchronization 1: Concurrency

## Learning Objectives
After this lecture, you should be able to explain how an OS creates concurrency with thread scheduling and context switching, describe how thread stacks/TCBs are saved and restored, explain why non-deterministic interleavings make correctness hard, and define the core synchronization concepts that lead to locks and semaphores.

## 1. Recap: Pipes, Sockets, and Server Concurrency

### 1.1 Pipe recap: bounded kernel queue and blocking behavior
A POSIX/Unix pipe is a fixed-size kernel queue between endpoints.
- Producer blocks when the pipe buffer is full.
- Consumer blocks when the pipe buffer is empty.
- `pipe(int fileds[2])` returns two descriptors:
  - `fileds[1]` for writing.
  - `fileds[0]` for reading.

### 1.2 Socket recap: network communication as file I/O
A socket is the communication endpoint abstraction. The key model is that network communication can still be read as file-like I/O (`read`/`write` over a descriptor), but with explicit naming and connection setup.

### 1.3 Recap server patterns and their tradeoffs
The lecture revisits three patterns for handling accepted connections:
1. Process-per-connection with protection: each connection has its own process/address space.
2. Process-based concurrency: parent keeps accepting while child processes serve requests.
3. Thread-based concurrency (without process-level isolation per connection): main thread accepts, spawned threads handle requests.

![Sockets with thread-based concurrency](./lec06_materials/sockets_concurrency_thread_model.png)

:::remark Question: What is similar and different between pipes and sockets?
**Similarity:** both provide queue-like communication endpoints and blocking `read`/`write` semantics.  
**Difference:** pipes are typically local IPC with fixed producer/consumer ends, while sockets support network endpoints, naming (`host:port`), connection establishment, and richer protocol families.
:::

## 2. How the OS Creates Concurrency: PCB, States, and Scheduler

### 2.1 Process Control Block (PCB)
The kernel represents each process as a PCB, including process state, program counter, register state, memory-related info, open files, and metadata (PID/user/priority/executable/time accounting).

A scheduler data structure stores PCBs and decides:
- Who receives CPU time.
- How non-CPU resources are allocated (memory/I/O related policies).

### 2.2 Context switch in the protection model
A context switch crosses privilege boundaries:
- Running user thread traps into kernel (interrupt/system call).
- Kernel saves old context to its PCB/TCB.
- Kernel restores next context.
- CPU returns to user mode for the selected thread/process.

### 2.3 Lifecycle and queues
A thread/process transitions among:
- `new`
- `ready`
- `running`
- `waiting`
- `terminated`

Key transitions:
- `new -> ready` (admitted)
- `ready -> running` (scheduler dispatch)
- `running -> waiting` (I/O/event wait)
- `waiting -> ready` (I/O/event completion)
- `running -> ready` (interrupt/preemption)
- `running -> terminated` (exit)

![Lifecycle of process/thread states](./lec06_materials/thread_lifecycle_states.png)

### 2.4 Queue-centric scheduling model
Scheduling is fundamentally queue movement: ready queue plus multiple wait queues for devices/signals/conditions.

![Ready queue and device queues](./lec06_materials/ready_and_device_queues.png)

Different policies prioritize different goals:
- Fairness.
- Real-time guarantees.
- Tail-latency optimization.

## 3. Dispatch Loop and How Control Returns to the Scheduler

### 3.1 Core dispatcher loop
A conceptual scheduler loop can be written as:

```c
Loop {
    RunThread();
    ChooseNextThread();
    SaveStateOfCPU(curTCB);
    LoadStateOfCPU(newTCB);
}
```

This is an **infinite loop** model of OS thread multiplexing.

### 3.2 Running a thread
To run a thread, the OS loads:
- Register state, PC, stack pointer.
- Execution environment (e.g., virtual memory context).
Then it jumps to the thread PC.

### 3.3 Internal events that give control back
Control can return voluntarily when a thread:
- Blocks on I/O.
- Waits for a signal/join condition.
- Calls `yield()` explicitly.

The yielding stack path is illustrated below.

![Yield stack and dispatcher path](./lec06_materials/yield_stack_and_dispatch.png)

### 3.4 External events: preemption via interrupts
If a thread never voluntarily yields, the OS still needs control. The mechanism is periodic interrupts, especially timer interrupts.

![Timer interrupt forces scheduler re-entry](./lec06_materials/timer_interrupt_regains_control.png)

A simplified interrupt routine:

```c
TimerInterrupt() {
    DoPeriodicHousekeeping();
    run_new_thread();
}
```

:::remark Question: What if a thread never does I/O, never waits, and never yields?
Then cooperative return paths disappear, so the dispatcher could starve. Timer interrupts solve this by forcibly preempting execution and returning control to kernel scheduling logic.
:::

## 4. Stacks, TCBs, and Context-Switch Correctness

### 4.1 Shared vs per-thread state
Within one process:
- Shared state: code, globals, heap.
- Per-thread state: TCB, saved registers, stack metadata, private stack.

This is why concurrency is cheap (shared address space) but also risky (shared mutable state).

### 4.2 What switch must save/restore
A switch routine preserves the old thread state and restores the new one.

```c
Switch(tCur, tNew) {
    /* unload old thread */
    TCB[tCur].regs.r7    = CPU.r7;
    ...
    TCB[tCur].regs.r0    = CPU.r0;
    TCB[tCur].regs.sp    = CPU.sp;
    TCB[tCur].regs.retpc = CPU.retpc;

    /* load new thread */
    CPU.r7    = TCB[tNew].regs.r7;
    ...
    CPU.r0    = TCB[tNew].regs.r0;
    CPU.sp    = TCB[tNew].regs.sp;
    CPU.retpc = TCB[tNew].regs.retpc;
    return;
}
```

### 4.3 Why switch bugs are dangerous
If even one register is not correctly saved/restored, failures become intermittent and timing-dependent. Results can be wrong with no explicit crash.

The lecture also emphasizes a cautionary engineering lesson: over-optimized low-level switch code may encode hidden assumptions that later maintenance silently violates.

:::remark Question: Can we exhaustively test context switch code?
In practice, this is extremely hard because the interleaving space is combinatorial. The safer strategy is to keep switch logic minimal, explicit, and architecture-convention-correct, then combine targeted stress tests with design simplicity.
:::

### 4.4 Is thread switching still a context switch?
Yes, but the key statement is: **"much cheaper than switching processes"**, mainly because no address-space replacement is required.

Illustrative numbers discussed in lecture:
- Typical context-switch period: `10-100 ms`.
- Process switch cost: roughly `3-4 us`.
- Thread switch cost: around `100 ns` (implementation-dependent, but much smaller).

## 5. Processes vs Threads vs SMT

### 5.1 Process/thread tradeoff dimensions
For threads in the same process versus across different processes:
- Switch overhead: same process low, different process high.
- Protection: same process low isolation, different process high isolation.
- Sharing overhead: same process low, cross-process generally higher.

### 5.2 Single-core and multicore effect
- Single core: no true parallel execution; scheduler time-slices one runnable context at a time.
- Multicore: multiple runnable contexts execute simultaneously; parallelism becomes real.

![Process vs thread tradeoffs on multicore](./lec06_materials/process_vs_thread_tradeoffs_multicore.png)

### 5.3 SMT/Hyperthreading
SMT duplicates architectural thread state (e.g., registers) so one physical core can better utilize execution slots with multiple instruction streams.
- Benefit: improved throughput and utilization.
- Limitation: speedup is usually sub-linear, not equivalent to doubling full cores.

## 6. How a New Thread Actually Starts

### 6.1 Initialize new TCB and stack
When creating a thread, setup logic initializes:
- Stack pointer (`sp`) to the new stack.
- Return PC (`retpc`) to `ThreadRoot` (a runtime stub/root).
- Argument registers (e.g., `r0/a0`, `r1/a1`) to function pointer and argument pointer.

![Setup of a newly created thread](./lec06_materials/new_thread_startup_setup.png)

### 6.2 Startup control transfer
Eventually, scheduler selection (`run_new_thread`) loads this TCB and returns into `ThreadRoot`, which is the real beginning of the new thread.

### 6.3 `ThreadRoot` responsibilities
The startup root routine executes bookkeeping, user-mode transition, user function call, and finish logic.

```c
ThreadRoot(fcnPTR, fcnArgPtr) {
    DoStartupHousekeeping();
    UserModeSwitch();   /* enter user mode */
    Call fcnPtr(fcnArgPtr);
    ThreadFinish();
}
```

![ThreadRoot execution path](./lec06_materials/threadroot_execution_flow.png)

:::remark Question: Why not jump directly to user function instead of ThreadRoot?
Because the runtime needs a controlled prologue/epilogue: startup accounting, proper mode transition, and guaranteed cleanup (`ThreadFinish`) when the function returns.
:::

## 7. Interlude: How to Read Systems Papers Efficiently

The lecture includes a practical research-reading framework.

### 7.1 Why this matters
Reading skill is used for:
- Coursework and research.
- Reviewing submissions.
- Giving peer feedback.
- Keeping up with new areas.

### 7.2 Keshav's three-pass method
1. **Step 1 (about 10 minutes):** scan title/abstract/introduction, section headings, conclusion, references; extract the five C's (Category, Context, Correctness, Contributions, Clarity).
2. **Step 2 (about 1 hour):** careful read of core ideas and figures, skip deep proofs, mark follow-up references.
3. **Step 3 (several hours):** virtually re-implement mentally, challenge assumptions, identify strengths/weaknesses, and propose future work.

### 7.3 Practical reading tips
- Read at the right depth for your goal.
- Read when mentally fresh.
- Read where distraction is low.
- Read actively (notes/questions).
- Read critically (challenge assumptions).

## 8. Case Study: Shinjuku and Microsecond-Scale Tail Latency

### 8.1 Problem chain in low-latency server OS design
The case study shows a sequence of bottlenecks and refinements:
1. High OS overhead motivates OS-bypass/polling/run-to-completion designs with distributed FCFS queues (`d-FCFS`).
2. Distributed queues create imbalance and can leave capacity idle (not work-conserving).
3. Centralized queue (`c-FCFS`) and work stealing improve balance, but short requests can still queue behind long requests.
4. Coarse preemption (e.g., `PS-1ms`) does not fix tail behavior enough for microsecond targets.
5. Very fast preemption (`PS-5us`) approaches near-optimal 99th-percentile latency.

![PS-5us microsecond preemption result](./lec06_materials/shinjuku_ps5us_performance.png)

### 8.2 Shinjuku design points
Shinjuku is presented as a single-address-space OS targeting microsecond-scale tail latency across variable workloads.
- **Preemption as often as 5 us**.
- Dedicated core for scheduling and queue management.
- Hardware virtualization support for fast preemption.
- Very fast user-space context switching.
- Policy matched to workload distribution and latency goals.

![Shinjuku key features](./lec06_materials/shinjuku_design_features.png)

:::remark Question: Why does balancing queues alone not solve tail latency?
Because queue balance and work conservation do not prevent head-of-line blocking by long requests. Without sufficiently fine-grained preemption, short requests can still wait behind long ones and inflate tail latency.
:::

## 9. Why Synchronization Is Necessary

### 9.1 Non-determinism and correctness goal
With concurrent threads, scheduler decisions are non-deterministic:
- Threads can run in **any order**.
- Context switches can occur **at any time**.

Independent threads (no shared state) are easier to reason about. Cooperating threads share state, so correctness must be designed explicitly.

Target: **correctness by design**.

### 9.2 Concurrency failures in real systems
The lecture highlights real incidents:
- Therac-25 radiation machine overdoses linked to concurrency/synchronization faults.
- Mars Pathfinder priority inversion (classic real-time scheduling pathology).
- Toyota uncontrolled acceleration discussions, with large codebase and inconsistent mutual exclusion concerns.

![Concurrency is hard in safety-critical systems](./lec06_materials/concurrency_real_world_failures.png)

:::remark Question: What is priority inversion in the Mars Pathfinder story, and why is it dangerous?
A high-priority task was blocked by a lower-priority task holding a shared resource, while medium-priority tasks kept running and delayed release further. This violates real-time expectations and can trigger system resets or missed deadlines unless techniques like priority inheritance are used.
:::

## 10. ATM Server Example: Throughput vs Correctness

### 10.1 Problem statement
The ATM server must:
- Serve many requests.
- Avoid database corruption.
- Avoid handing out too much money.

![ATM server problem setting](./lec06_materials/atm_server_problem.png)

### 10.2 Sequential baseline and speedup options
A simple server loop:
1. Receive request (`op`, `acctId`, `amount`).
2. Process it (`Deposit`, etc.).
3. Repeat.

The deposit path may involve disk I/O in account read/store, so pure sequential handling wastes overlap opportunities.

Speedup options introduced:
- Process more than one request at once.
- Event-driven overlap of I/O and compute.
- Multi-threading or multi-processing.

### 10.3 Event-driven single-CPU version
Event-driven code rewrites one request into multiple state-machine callbacks (`StartOnRequest`, `ContinueRequest`, `FinishRequest`) triggered by events.

Benefits:
- Can overlap I/O and useful work on one CPU without threads.

Costs:
- Program structure is fragmented into many non-blocking pieces.
- Easy to miss blocking points and break responsiveness.

:::remark Question: What are the two practical issues raised by the event-driven version?
1. **What if one blocking I/O step is missed?** The whole event loop can stall and destroy latency.  
2. **What if code must be split into hundreds of event fragments?** Control flow and state management become difficult to maintain and verify.
:::

### 10.4 Threaded version and race condition risk
Threads make overlap easier because each request can run in a mostly natural sequential style.

But shared-state races appear. For example, two deposit threads on one account:
1. `T1` loads `balance = B`.
2. `T2` loads `balance = B`.
3. `T2` stores `B + amount2`.
4. `T1` stores `B + amount1`.

Final balance becomes `B + amount1` (or `B + amount2`) instead of `B + amount1 + amount2`.

![Threaded ATM race example](./lec06_materials/threaded_atm_race_condition.png)

This is the classic **lost update** problem and motivates synchronization.

## 11. Core Definitions from the Conclusion

The lecture closes with core definitions (kept in original wording):
- **Atomic Operation: an operation that always runs to completion or not at all**.
- **Synchronization: using atomic operations to ensure cooperation between threads**.
- **Mutual Exclusion: ensuring that only one thread does a particular thing at a time**.
- **Critical Section: piece of code that only one thread can execute at once**.
- **Locks: synchronization mechanism for enforcing mutual exclusion on critical sections to construct atomic operations**.

Concurrency is implemented by multiplexing CPU time:
- Unload current thread state (PC/registers).
- Load new thread state.
- Context switches can be voluntary (`yield`, blocking I/O) or involuntary (interrupt/preemption).
- TCB + stack together store restartable thread execution state.

## 12. Conclusion
- Scheduler + context switching create concurrency.
- Concurrency without shared state is easier; shared-state concurrency needs explicit synchronization.
- Threading improves structure/performance compared with heavy event-driven decomposition, but introduces races.
- Correctness requires atomicity + mutual exclusion around critical sections.

## Appendix A. Exam Review

### A.1 Definitions to memorize
- PCB, TCB, context switch, preemption, atomic operation, mutual exclusion, critical section, lock.

### A.2 Mechanism chain to be able to explain
1. Ready/wait queues + scheduling policy pick runnable thread.
2. CPU state is saved to old TCB and restored from new TCB.
3. Control returns either voluntarily (I/O/wait/yield) or by timer interrupt.
4. Shared state without synchronization can corrupt correctness.

### A.3 Must-know comparisons
- Same-process thread switch vs cross-process switch cost.
- Process isolation benefit vs thread sharing efficiency.
- Event-driven overlap vs threaded overlap tradeoff.
- d-FCFS/c-FCFS/PS-1ms/PS-5us qualitative impact on tail latency.

### A.4 Typical short-answer prompts
- Why can a CPU scheduler be modeled as queue movement plus policy?
- Why is context-switch code hard to test exhaustively?
- Why does faster preemption improve short-request tail latency?
- Why can thread-based ATM processing return wrong balances?

### A.5 Common pitfalls
- Assuming a single test run proves concurrent correctness.
- Equating high throughput with correctness.
- Ignoring blocked I/O paths in event-driven code.
- Updating shared variables without mutual exclusion.

### A.6 Self-check list
- Can you draw the lifecycle transitions (`new/ready/running/waiting/terminated`)?
- Can you explain exactly where timer interrupts re-enter scheduling?
- Can you step through a lost-update interleaving without skipping steps?
- Can you define atomic operation, mutual exclusion, and critical section precisely?
