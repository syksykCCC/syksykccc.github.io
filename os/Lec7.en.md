# Lec7 - Synchronization 2: Lock Implementation

## Learning Objectives
After this lecture, you should be able to explain why synchronization needs stronger primitives than plain load/store, design a correct bounded-buffer solution with semaphores, analyze ordering constraints in `P/V` operations, and reason about safety/liveness using the Too-Much-Milk case study.

## 1. Quick Recap: Why We Need Better Synchronization Primitives

### 1.1 Three-pass reading mindset (method reminder)
The lecture briefly revisits Keshav's three-pass method because systems work depends on reading and validating ideas carefully:
1. First pass: quick structure scan.
2. Second pass: core ideas and figures.
3. Third pass: virtual re-implementation and assumption checking.

### 1.2 Context switch crosses privilege boundaries
A context switch is not just "switching threads"; it includes trap/interrupt entry, state save, state restore, and return to user mode.

![Context switch and privilege levels](./lec07_materials/context_switch_privilege_path.png)

### 1.3 Dispatch loop as the conceptual core
```c
Loop {
    RunThread();
    ChooseNextThread();
    SaveStateOfCPU(curTCB);
    LoadStateOfCPU(newTCB);
}
```
This model is an infinite loop that keeps multiplexing CPU execution among runnable threads.

### 1.4 ATM recap: easier overlap with threads, but race risks
Threaded request handling keeps code structure natural, but shared state can be corrupted by interleavings. The bank example shows why critical sections must be protected with one shared lock.

![Lock-guarded critical section for ATM updates](./lec07_materials/lock_protects_critical_section_atm.png)

### 1.5 Atomic operation is the base concept
The key original definition is: **"Atomic Operation: an operation that always runs to completion or not at all."**  
Atomicity is indivisibility. Without reliable atomic primitives, threads cannot safely cooperate.

## 2. Producer-Consumer with a Bounded Buffer

### 2.1 Problem setup and real example
Producer-consumer decouples production speed from consumption speed by using a finite shared buffer.
- Producer must wait when the buffer is full.
- Consumer must wait when the buffer is empty.
- Access to shared queue state must be synchronized.

![Producer-consumer bounded-buffer model](./lec07_materials/producer_consumer_bounded_buffer_model.png)

The coke-machine analogy is exact:
- Supplier can only refill a limited number of slots.
- Customer cannot take a drink if the machine is empty.

### 2.2 Circular buffer sequential structure
The queue keeps `write_index` and `read_index` and supports enqueue/dequeue by advancing pointers modulo buffer size.

![Circular buffer structure](./lec07_materials/circular_buffer_structure.png)

The real design questions are:
- How do we detect full/empty robustly?
- What must be atomic?
- What should a producer/consumer do while waiting?

:::remark Question: "How to tell if Full (on insert) Empty (on remove)? And what do you do if it is?"
Two common implementations are:
1. Keep an explicit count:
   - Empty iff `count == 0`
   - Full iff `count == BUFSIZE`
2. Keep one slot unused:
   - Empty iff `read_index == write_index`
   - Full iff `(write_index + 1) % BUFSIZE == read_index`

When full/empty is reached, producer/consumer must block (or wait) according to the synchronization policy. Busy waiting is possible but usually undesirable for efficiency.
:::

### 2.3 First cut with only one lock fails
If producer/consumer hold `buf_lock` and spin in `while (buffer full/empty)`, they can block each other forever:
- Producer may hold the lock while waiting for consumer action.
- Consumer cannot acquire the lock to perform that action.

:::remark Question: "Will we ever come out of the wait loop?"
In this first cut, potentially no. A waiting thread can hold the mutex and prevent the other side from making progress, causing deadlock-like behavior.
:::

### 2.4 Second cut avoids that deadlock but is still poor
Releasing and reacquiring lock inside the wait loop can avoid "waiting while holding lock," but it still causes aggressive spinning and scheduling churn.

:::remark Question: "What happens when one is waiting for the other?"
They repeatedly release/reacquire the lock, which is a form of busy waiting. The system can make progress, but CPU time is wasted and fairness can degrade under contention.
:::

### 2.5 Semaphore refresher (original phrasing preserved)
- **Down() or P(): an atomic operation that waits for semaphore to become positive, then decrements it by 1**
- **Up() or V(): an atomic operation that increments the semaphore by 1, waking up a waiting P, if any**

Additional facts:
- Semaphore value is a non-negative integer.
- `P` from Dutch *proberen* ("to test"), `V` from *verhogen* ("to increment").

### 2.6 Correctness constraints for bounded buffer
Any correct solution must satisfy all three constraints:
1. Consumer waits if there is no full slot.
2. Producer waits if there is no empty slot.
3. Only one thread manipulates queue internals at a time.

Rule of thumb: **use one semaphore per constraint**.
- `fullSlots`: consumer-side scheduling constraint
- `emptySlots`: producer-side scheduling constraint
- `mutex`: mutual exclusion

### 2.7 Full semaphore solution
![Full bounded-buffer solution with semaphores](./lec07_materials/bounded_buffer_semaphore_full_solution.png)

```c
Semaphore fullSlots = 0;
Semaphore emptySlots = bufSize;
Semaphore mutex = 1;

Producer(item) {
    semaP(&emptySlots);  // wait for space
    semaP(&mutex);       // enter critical section
    Enqueue(item);
    semaV(&mutex);       // leave critical section
    semaV(&fullSlots);   // announce one more full slot
}

Consumer() {
    semaP(&fullSlots);   // wait for available item
    semaP(&mutex);       // enter critical section
    item = Dequeue();
    semaV(&mutex);       // leave critical section
    semaV(&emptySlots);  // announce one more empty slot
    return item;
}
```

### 2.8 Why asymmetry and ordering matter
- Producer does `P(emptySlots)` then `V(fullSlots)` because it consumes an empty slot and creates an occupied slot.
- Consumer does `P(fullSlots)` then `V(emptySlots)` because it consumes an occupied slot and creates an empty slot.

:::remark Question: "Is order of P's important?"
Yes. Wrong order can deadlock.  
If a thread acquires `mutex` first and then blocks on `emptySlots/fullSlots`, it may hold the lock needed by others to change the slot counts.
:::

:::remark Question: "Is order of V's important?"
For correctness, usually not as strict as `P` ordering; for performance, yes, because it can affect which thread wakes first and thus scheduling efficiency.
:::

:::remark Question: "What if we have 2 producers or 2 consumers? Do we need to change anything?"
No algorithmic change is required. The same three semaphores still encode the same three constraints; more threads simply contend on those synchronization points.
:::

## 3. Where Synchronization Is Heading
Synchronization is built as a hierarchy: hardware atomic primitives at the bottom, then locks/semaphores/monitors/message passing at higher levels.

![Synchronization abstraction stack](./lec07_materials/synchronization_abstraction_stack.png)

The key takeaway is that user-level synchronization APIs must be built on stronger atomic support than plain load/store.

## 4. Motivating Case Study: Too Much Milk

### 4.1 Problem scenario and timeline
Two people coordinate milk buying, but timing overlap can cause duplicate buys.

![Too-Much-Milk timeline example](./lec07_materials/too_much_milk_timeline.png)

From the timeline:
1. A sees no milk and goes to store.
2. Before A returns, B also sees no milk and goes to store.
3. Both buy milk.  
This is a synchronization error in real-world form.

### 4.2 Lock intuition and over-serialization
A lock means:
- lock before critical section/shared data access,
- unlock when leaving,
- wait if locked.

The fridge-key analogy prevents double-buying but over-constrains unrelated actions (for example, roommate cannot get orange juice while lock is held). Good synchronization should protect the right critical section, not everything.

### 4.3 Correctness properties to preserve
The problem requires:
1. **Never more than one person buys** (safety).
2. **Someone buys if needed** (liveness/progress).

### 4.4 Solution #1 (single shared note) and intermittent failure
```c
if (noMilk) {
    if (noNote) {
        leave Note;
        buy Milk;
        remove Note;
    }
}
```

:::remark Question: What is wrong with Solution #1?
A thread can be context-switched after checking `noMilk`/`noNote` but before `buy Milk`. Another thread can then pass the same checks. Result: still too much milk, but only occasionally.  
This intermittent failure is exactly what makes concurrent bugs difficult to debug.
:::

### 4.5 Solution #1½ (place note first) breaks liveness
```c
leave Note;
if (noMilk) {
    if (noNote) {
        buy Milk;
    }
}
remove Note;
```
Both can place notes first, each sees the other's note, and nobody buys.

:::remark Question: Why does this version produce "no one ever buys milk"?
The condition can become mutually blocking: each participant's note causes the other to skip buying. Safety may hold, but liveness fails.
:::

### 4.6 Solution #2 (labeled notes) still has lockup risk
```c
Thread A: leave NoteA; if (noNoteB) { if (noMilk) buy; } remove NoteA;
Thread B: leave NoteB; if (noNoteA) { if (noMilk) buy; } remove NoteB;
```
Under unlucky timing, each may conclude the other will buy, so neither buys.

The lecture calls this lockup **"starvation"** in this context.

:::remark Question: Why is this bug especially dangerous in practice?
Because it can be rare but high-impact. Low-frequency concurrency bugs often appear only under production timing, then fail at the worst possible time.
:::

### 4.7 Solution #3 works (two-note asymmetric algorithm)
```c
Thread A:
leave NoteA;
while (NoteB) { /* do nothing */ }   // X
if (noMilk) { buy Milk; }
remove NoteA;

Thread B:
leave NoteB;
if (noNoteA) {                        // Y
    if (noMilk) { buy Milk; }
}
remove NoteB;
```

![Solution #3 structure](./lec07_materials/too_much_milk_solution3_overview.png)

Both threads can guarantee one of two outcomes:
1. It is safe to buy.
2. The other side will buy, so quitting is safe.

### 4.8 Case analysis (process change over time)

#### Case 1: `leave NoteA` happens before `if (noNoteA)`
![Case 1 flow](./lec07_materials/too_much_milk_case1_flow.png)

Flow:
1. A leaves `NoteA`.
2. B reaches `if (noNoteA)` and sees `NoteA`, so B skips buying.
3. A may wait while `NoteB` exists.
4. B removes `NoteB`; A continues.
5. A checks milk and buys if still needed.

Result: at most one buyer, and milk is bought if needed.

#### Case 2: `if (noNoteA)` happens before `leave NoteA`
![Case 2 flow](./lec07_materials/too_much_milk_case2_flow.png)

Flow:
1. B executes `if (noNoteA)` before A leaves `NoteA`, so B may enter buy path.
2. B buys milk (if needed) and removes `NoteB`.
3. A later waits for `NoteB` to disappear, then continues.
4. A checks `noMilk`; now milk is already present, so A does not buy.

Result: still no duplicate buy, and progress is preserved.

### 4.9 Why Solution #3 is still unsatisfying
It is correct, but has major engineering drawbacks:
- Too complex for such a simple task.
- Thread A code and Thread B code are different (poor scalability for many threads).
- Waiting loop consumes CPU time (**busy-waiting**).

This motivates hardware primitives such as test-and-set / compare-and-swap and higher-level synchronization abstractions.

## 5. Key Definitions (Original Wording)
- **Synchronization: using atomic operations to ensure cooperation between threads**
- **Mutual Exclusion: ensuring that only one thread does a particular thing at a time**
- **Critical Section: piece of code that only one thread can execute at once**
- **Locks: synchronization mechanism for enforcing mutual exclusion on critical sections to construct atomic operations**
- **Semaphores: synchronization mechanism for enforcing resource constraints**
- **Atomic Operations: an operation that runs to completion or not at all**

## 6. Conclusion
- Load/store atomicity alone is too weak for practical coordination.
- Bounded buffer requires both scheduling constraints and mutual exclusion.
- Correct semaphore decomposition uses separate semaphores for separate constraints.
- Correctness must hold under any interleaving, not just "typical" timing.
- Busy waiting can be correct but inefficient, so better primitives are needed.

## Appendix A. Exam Review

### A.1 Definitions to memorize
- Atomic operation, synchronization, mutual exclusion, critical section, lock, semaphore (`P/V`).

### A.2 Canonical bounded-buffer template
1. `P(empty/full)` to satisfy availability constraint.
2. `P(mutex)` to enter queue critical section.
3. Enqueue/dequeue.
4. `V(mutex)` to leave critical section.
5. `V(full/empty)` to signal state change.

### A.3 Questions you should be able to answer
- Why does "one lock + busy wait inside lock" fail?
- Why is `P` ordering safety-critical?
- Why can `V` ordering influence performance?
- Why does Solution #1 fail intermittently?
- Why does Solution #1½/#2 violate progress?
- Why is Solution #3 correct but still not a good abstraction?

### A.4 Common mistakes
- Holding `mutex` while waiting for resource-count semaphores.
- Confusing safety (no double buy) with liveness (someone buys).
- Assuming "rare failure" means "acceptable."
- Ignoring busy-wait CPU cost.

### A.5 Self-check list
- Can you write the full producer/consumer semaphore solution from memory?
- Can you explain the asymmetry between producer and consumer operations?
- Can you walk through Case 1 and Case 2 of Solution #3 without skipping steps?
- Can you distinguish correctness from efficiency tradeoffs?
