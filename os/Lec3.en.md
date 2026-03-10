# Lec3 - Abstractions 1: Threads and Processes

## Learning Objectives
After this lecture, you should be able to explain why threads are the OS abstraction for concurrency, reason about interleavings and race conditions, apply lock/semaphore patterns, and use the core process/thread APIs (`pthread_*`, `fork`, `exec`, `wait`, `kill`, `sigaction`) with a clear model of state changes.

## 1. Starting Point: Four Concepts and Base-and-Bound

### 1.1 Fast recall of the four fundamental OS concepts
This lecture starts from the same four anchors:
- **Thread**: execution context.
- **Address Space w/ translation**: program-visible addresses are translated and protected.
- **Process**: running-program environment with restricted rights.
- **Dual Mode / Protection**: only system mode can access privileged resources.

### 1.2 Base-and-Bound (B&B): two implementation styles
One concrete protection mechanism is Base-and-Bound, with two common styles:

- **Load-time relocation**: addresses are translated when the program is loaded.
- **On-the-fly translation**: every address is checked and translated during execution.

![Load-time relocation style](./lec03_materials/bb_load_time_translation.png)

![On-the-fly translation style](./lec03_materials/bb_on_the_fly_translation.png)

:::remark Key questions on Base-and-Bound
**Question:** "Can the program touch OS? Can it touch other programs?"

If B&B is enforced correctly, a program can only access addresses inside its legal range. Out-of-range access traps to the OS, so it cannot directly read/write OS memory or another program's memory.

**Question:** "What are the pros and cons of Base and Bound? What are the pros and cons of the two implementation approaches?"

A concise comparison:
- B&B advantage: conceptually simple and fast to check.
- B&B limitation: each process needs a contiguous range and careful range management.
- Load-time relocation: no per-access add in the critical path, but needs relocating loader support.
- On-the-fly translation: more dynamic at run time, but adds hardware checks/translation on each access.
:::

## 2. Why Threads: Handling MTAO

### 2.1 Why MTAO appears everywhere
Operating systems and real programs must handle **Multiple Things At Once (MTAO)**:
- OS kernel work (interrupts, maintenance, background work).
- Network servers handling many connections.
- Parallel programs chasing throughput.
- UI programs that must stay responsive while computing.
- Network/disk-bound programs that must hide I/O latency.

A key statement is:
- **"Threads are a unit of concurrency provided by the OS."**

### 2.2 Multiprocessing, multiprogramming, multithreading
Useful distinctions:
- **Multiprocessing**: multiple physical CPUs/cores.
- **Multiprogramming**: many jobs/processes share CPUs over time.
- **Multithreading**: one process can have multiple threads of control.

Another key distinction:
- **Concurrency** means handling multiple tasks in overlapping time.
- **Parallelism** means tasks execute simultaneously.

So two threads on one core can be concurrent but not parallel.

### 2.3 From blocking code to concurrent progress
A single-threaded sequence like:
- `ComputePI(...)`
- then `PrintClassList(...)`

can fail to make progress on the second task if the first never finishes.

Creating separate threads enables concurrent progress:
- one thread runs long computation or I/O,
- another thread handles user-visible work.

A practical pattern is to read a large file in background while keeping UI responsive.

:::tip Behavior question: background I/O + UI thread
**Question:** If one thread runs `ReadLargeFile("pi.txt")` and another runs `RenderUserInterface`, what behavior should we expect?

The UI can keep responding while file reading proceeds in background. The key gain is not "faster CPU" by itself, but better responsiveness and overlap between independent work.
:::

### 2.4 Threads mask I/O latency through state transitions
A thread can be in three states:
- **RUNNING**: currently executing.
- **READY**: eligible to run.
- **BLOCKED**: not eligible (e.g., waiting for I/O).

When a running thread issues blocking I/O, the OS marks it BLOCKED, schedules another READY thread, and later marks the blocked thread READY when I/O completes.

![Threads masking I/O latency](./lec03_materials/threads_mask_io_latency.png)

The key "change" in timeline is:
1. Thread 1 starts I/O and becomes BLOCKED.
2. Thread 2 uses CPU while Thread 1 waits.
3. I/O completion event moves Thread 1 to READY.
4. Scheduler can run Thread 1 again.

## 3. From Library API to System Calls

### 3.1 Why many programmers "never see a syscall"
A common confusion is: "I never wrote a syscall instruction directly."

The reason is that user code usually calls an OS library (for example, libc / pthread library), and the library issues syscalls on behalf of the program.

![System call interface as the software 'narrow waist'](./lec03_materials/syscall_interface_narrow_waist.png)

![OS library issues syscalls for applications](./lec03_materials/os_library_issues_syscalls.png)

### 3.2 Core pthread APIs
Key API signatures:

```c
int pthread_create(pthread_t *thread, const pthread_attr_t *attr,
                   void *(*start_routine)(void *), void *arg);

void pthread_exit(void *value_ptr);

int pthread_join(pthread_t thread, void **value_ptr);
```

Operational meaning:
- `pthread_create`: start `start_routine(arg)` in a new thread.
- returning from `start_routine` is like an implicit `pthread_exit`.
- `pthread_join`: caller blocks until target thread terminates.

### 3.3 What changes when `pthread_create(...)` is called
A compact control-flow view:
1. Library code prepares syscall number + args in registers.
2. A trap/syscall instruction transfers control to kernel mode.
3. Kernel reads args, dispatches handler, creates thread state.
4. Kernel writes return value and returns to user mode.
5. Library returns to caller like a normal function.

### 3.4 Fork-Join pattern for thread coordination
A widely used structure:
- one main thread **creates** worker threads,
- workers execute independently and eventually **exit**,
- main thread **joins** and collects completion/results.

![Fork-Join pattern](./lec03_materials/fork_join_pattern.png)

:::remark Group discussion question: pThreads example
**Question 1:** How many threads are in the program?

If `nthreads = N`, total threads are typically `N + 1` (workers + main thread).

**Question 2:** Does main join workers in creation order?

Yes, the loop can call `pthread_join(threads[t], ...)` in creation order; however, each join may wait for that specific target even if another worker already finished.

**Question 3:** Do threads exit in the same order they were created?

No. Exit order is nondeterministic and depends on scheduling and run-time timing.

**Question 4:** If we run again, can result change?

Yes. Without synchronization around shared updates like `common++`, output values and print order can vary across runs.
:::

## 4. Thread State, Execution Stack, and Memory Layout

### 4.1 Shared vs private thread state
Inside one process:
- Shared among threads: code, global data, heap, and many I/O resources.
- Private per thread: registers (including PC) and execution stack.

Private thread control metadata is kept in a **TCB (Thread Control Block)**.

### 4.2 What execution stacks store
Execution stacks store:
- parameters,
- temporary/local variables,
- return program counters while called procedures run.

This is why recursion is natural with stack-based execution.

### 4.3 Execution-stack change walkthrough (important process view)
For the call chain `A(1) -> B() -> C() -> A(2)`, stack frames evolve like this:
1. Push frame `A(tmp=1, ret=exit)`.
2. Condition true, call `B`, push `B(ret=A+2)`.
3. `B` calls `C`, push `C(ret=B+1)`.
4. `C` calls `A(2)`, push `A(tmp=2, ret=C+1)`.
5. In `A(2)`, condition false, print `2`, then return (pop).
6. Return through `C` then `B` (pop both).
7. Resume outer `A(1)`, print `1`, return to `exit`.

![Deep call with stack growth](./lec03_materials/execution_stack_deep_call.png)

![Unwinding to final output order](./lec03_materials/execution_stack_unwind_output.png)

So output order is `2` then `1`, exactly because of call depth and unwind order.

### 4.4 Memory layout with multiple threads
In a multithreaded process:
- each thread has its own stack region,
- heap/global/code remain shared,
- stacks typically grow downward while heap grows upward.

![Memory layout with two threads](./lec03_materials/memory_layout_two_threads.png)

## 5. Interleaving, Nondeterminism, and Correctness

### 5.1 Programmer abstraction vs physical reality
A useful mental model is:
- abstraction: each thread seems to "own a CPU",
- physical reality: limited CPUs run some threads now, others wait READY.

![Thread abstraction vs physical reality](./lec03_materials/thread_abstraction_physical_reality.png)

Programs must be correct for any legal schedule, not one favorite schedule.

### 5.2 Possible executions differ in granularity
Scheduling can switch:
- in large chunks,
- in medium chunks,
- or very fine-grained interleavings.

![Different possible executions](./lec03_materials/possible_executions.png)

### 5.3 Correctness framing for concurrent threads
Three central points:
- scheduler can run threads in **any order**,
- scheduler can switch at **any time**,
- testing alone becomes difficult under nondeterminism.

Thread categories:
- **Independent threads**: no shared state, more reproducible behavior.
- **Cooperating threads**: shared state, require synchronization.

Goal:
- **Correctness by design**.

### 5.4 Race-condition examples
Example A (independent writes):
- initial `x=0, y=0`
- Thread A: `x=1`
- Thread B: `y=2`
- final `x` is deterministically `1`.

Example B (shared dependency):
- initial `x=0, y=0`
- Thread A: `x = y + 1`
- Thread B: `y = 2; y = y * 2`
- final `x` can be `1`, `3`, or `5`.

:::tip Why can x be 1, 3, or 5?
**Question:** How do these three values arise?

- `x=1`: A reads `y=0` before B updates.
- `x=3`: A reads after `y=2` but before `y=4`.
- `x=5`: A reads after both B updates.

This is exactly a race condition: outcome depends on interleaving timing.
:::

### 5.5 Shared data structures need protected critical sections
For a shared tree-based set, concurrent operations like insert/get require synchronization around critical sections to preserve consistency.

![Tree-based set with lock-protected operations](./lec03_materials/tree_set_locking.png)

## 6. Synchronization Primitives: Locks and Semaphores

### 6.1 Relevant definitions
Key definitions to retain:
- **"Synchronization: Coordination among threads, usually regarding shared data."**
- **"Mutual Exclusion: Ensuring only one thread does a particular thing at a time."**
- **"Critical Section: Code exactly one thread can execute at once."**
- **"Lock: An object only one thread can hold at a time."**

### 6.2 Locks
A lock exposes two atomic operations:
- `Lock.acquire()`: wait until free, then mark busy and become holder.
- `Lock.release()`: mark free (only current holder should release).

In pthreads, common forms are:
- `pthread_mutex_init(...)`
- `pthread_mutex_lock(...)`
- `pthread_mutex_unlock(...)`

### 6.3 Semaphores as generalized locks
A semaphore has a non-negative integer value and two atomic operations:
- `P()` / `down()`: wait until value > 0, then decrement.
- `V()` / `up()`: increment and wake a waiter if present.

Historical note:
- `P` from Dutch *proberen* (to test),
- `V` from Dutch *verhogen* (to increment).

### 6.4 Two semaphore patterns you should memorize
- **Mutual exclusion pattern** (binary semaphore / mutex style):
  - initialize semaphore to `1`.
  - `down()` before critical section.
  - `up()` after critical section.

- **Signaling pattern** (ThreadJoin style):
  - initialize semaphore to `0`.
  - waiting side does `down()`.
  - finishing side does `up()`.

:::remark Lock vs semaphore (quick decision rule)
If you need "exactly one owner in a critical section," a mutex/lock is usually simplest. If you need counting or explicit event signaling between threads, semaphores are often the cleaner primitive.
:::

## 7. Process Abstraction and Process APIs

### 7.1 What a process is
A process is an execution environment with restricted rights:
- one or more threads in one address space,
- ownership of resources like file descriptors/network connections,
- isolation from other processes and from the kernel boundary.

A key definition is:
- **"An instance of an executing program is a process consisting of an address space and one or more threads of control."**

In modern OSes, anything outside the kernel runs inside some process.

### 7.2 Creating processes with `fork()`
`fork()` copies the current process:
- child gets a different PID,
- child starts with one thread,
- many states are duplicated into parent and child (address space, file descriptors, etc.).

Return semantics:
- `fork() > 0`: running in parent, return value is child PID.
- `fork() == 0`: running in child.
- `fork() < 0`: error path (still in original process context).

### 7.3 Interleaving in `fork_race.c`
After `fork`, parent and child execute different branches concurrently, so printed lines interleave nondeterministically.

:::tip Group discussion: what does `fork_race.c` print? does `sleep()` matter?
**Question:** What is guaranteed, and what is not guaranteed?

Guaranteed:
- parent branch prints its own sequence,
- child branch prints its own sequence.

Not guaranteed:
- cross-process print order.

Adding `sleep()` changes timing and often changes observed interleavings, but does not make ordering fundamentally deterministic.
:::

### 7.4 Replacing program image with `exec()`
`exec` changes the program being run by the current process. On success, `exec` does not return to old code.

Typical shell-style launch flow:
1. parent calls `fork()`.
2. child calls `exec(...)` to run target program.
3. parent calls `wait(...)` to wait for child completion.

![Shell-style fork-exec-wait flow](./lec03_materials/shell_fork_exec_wait_flow.png)

### 7.5 Process management API checklist
Core APIs:
- `exit`: terminate current process.
- `fork`: copy current process.
- `exec`: replace current process image.
- `wait`: wait for child completion.
- `kill`: send signal to another process.
- `sigaction`: install signal handlers.

Two concrete examples:
- `fork2.c`: parent waits; child exits (e.g., `exit(42)`); parent obtains child PID/status.
- `inf_loop.c`: process loops forever until a signal (e.g., SIGINT) is caught by a registered handler.

### 7.6 Why `fork()+exec()` for processes, but `pthread_create()` for threads?
Main practical reasons:
- It is convenient to `fork` without immediate `exec` when parent/child logic lives in one executable.
- Child can adjust state before `exec` (for example, file descriptor setup in shells).
- This separation gives programmatic control over child setup.

Windows takes a different API path (`CreateProcess`), which also works but is a more complex interface.

### 7.7 Threads vs processes: tradeoff summary
- Threads:
  - lower creation/switch overhead,
  - easy shared-memory communication,
  - but synchronization bugs and weaker fault isolation.
- Processes:
  - stronger isolation/security/fault containment,
  - but higher creation/context/IPC cost.

:::remark Design question: separate threads or separate processes?
Choose threads when tasks are tightly coupled and high-rate shared-state communication is central. Choose separate processes when fault isolation, security boundaries, or independent lifecycle control is the priority.
:::

## 8. Conclusion
The central takeaways are:
- **"Threads are the OS unit of concurrency."**
- Threads in one process share data, so synchronization is required to avoid races.
- Processes package one or more threads inside an address-space protection boundary.
- The OS library provides program-facing APIs and interfaces with kernel services via system calls.

## Appendix A. Exam Review

### A.1 Must-know definitions
- Thread, process, address space, dual mode.
- Synchronization, mutual exclusion, critical section, lock, semaphore.
- Concurrency vs parallelism.

### A.2 Must-know state-change flows
- Thread state flow around blocking I/O:
  - `RUNNING -> BLOCKED -> READY -> RUNNING`.
- `fork` return-value split:
  - parent branch (`>0`) vs child branch (`==0`) vs error (`<0`).
- Shell launch flow:
  - `fork -> child exec -> parent wait`.
- Lock discipline:
  - `acquire -> critical section -> release`.

### A.3 Short-answer templates
- Why nondeterminism is hard:
  - scheduler can choose any interleaving, so behavior may vary per run.
- Why races happen:
  - unsynchronized shared state + overlapping execution windows.
- Why synchronization helps:
  - forces ordering or exclusion so shared-state invariants hold.

### A.4 Common pitfalls
- Assuming creation order equals completion order.
- Assuming one test run proves concurrent correctness.
- Forgetting that thread stacks are private but heap/global data are shared.
- Forgetting `exec` replaces the process image and usually does not return on success.

### A.5 Self-check checklist
- Can you compute all outcomes of a small race-condition example?
- Can you explain where `pthread_create` transitions from user to kernel?
- Can you explain why output order changes in `fork_race.c`?
- Can you justify thread vs process choice for a concrete scenario?
- Can you write lock/semaphore placement for one critical section and one signaling dependency?
