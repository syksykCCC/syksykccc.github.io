# Lec2 - Four Fundamental OS Concepts

## Learning Objectives
After this lecture, you should be able to explain the four fundamental OS concepts, describe why protection needs both hardware and software support, and reason about how a single machine gives the illusion of many independent programs running safely.

## 1. Fast Recall: What an Operating System Is

### 1.1 Core definition
A key definition is:

- **"Special layer of software that provides application software access to hardware resources."**

This layer provides convenient abstraction, protected sharing, security/authentication, and communication among logical entities.

### 1.2 Three-role mental model
Operating systems can be viewed as three roles at once:
- **Referee**: manage protection, isolation, and sharing of resources.
- **Illusionist**: provide clean abstractions over physical resources.
- **Glue**: provide common services such as storage, windowing, networking, sharing, and authorization.

## 2. Why OS Design Keeps Changing

### 2.1 Three historical phases
The lecture frames OS history using cost tradeoffs:
- Hardware expensive, humans cheap.
- Hardware cheaper, humans expensive.
- Hardware really cheap, humans really expensive.

### 2.2 What changed with hardware evolution
Rapid hardware changes drove OS evolution:
- Batch -> Multiprogramming -> Timesharing -> Graphical UI -> Ubiquitous devices.
- Features gradually migrated into smaller machines.

Representative scale estimates in the lecture:
- Small OS: around **100K lines**.
- Large OS: around **10M lines**.
- Development effort: around **100-1000 people-years**.

### 2.3 OS archaeology: lineage matters
Because building an OS from scratch is expensive, modern OSes inherit long lineages. The lecture lists major families such as Unix/BSD lines, Mach+BSD to XNU/iOS, MINIX->Linux ecosystems, and DOS->Windows families.

## 3. Four Fundamental Concepts at a Glance

The lecture states four core concepts:
- **Thread**.
- **Address space (with translation)**.
- **Process**.
- **Dual mode operation / Protection**.

A key summary sentence is:

- **"Only the 'system' has the ability to access certain resources."**

## 4. OS Bottom Line: Run Programs

At minimum, an OS must make program execution happen correctly and safely:
- Load instruction/data segments of an executable into memory.
- Create stack and heap.
- Transfer control to the program.
- Provide services while the program runs.
- Protect both the OS and programs.

![OS bottom line: run programs](./lec02_materials/os_bottom_line_run_programs.png)

## 5. First Concept: Thread of Control

### 5.1 Definition
A key definition is:

- **"Thread: Single unique execution context: fully describes program state."**
- **"Program Counter, Registers, Execution Flags, Stack."**

### 5.2 Why thread context is concrete state
The PC points to the current instruction, and registers hold execution context such as stack pointer and other convention-defined pointers. A thread is executing when its context is resident in processor registers.

### 5.3 Root state idea
Registers hold the root state of a running thread. The remaining program state lives in memory.

## 6. Second Concept: Program Address Space (with Translation)

### 6.1 Definition
A key definition is:

- **"Address space -> the set of accessible addresses + state associated with them."**

For intuition:
- 32-bit machine: up to `2^32` addresses.
- 64-bit machine: up to `2^64` addresses.

### 6.2 What an address access can mean
A read/write to an address may behave like normal memory, be ignored, trigger I/O (memory-mapped I/O), or raise an exception/fault.

### 6.3 Segment view
A process address space is commonly discussed in terms of code/text, static data, heap, and stack segments.

![Address space in a picture](./lec02_materials/address_space_in_picture.png)

:::remark Question set on address space segments
**Question:** "What's in the code segment? Static data segment?" "What's in the Stack Segment? How is it allocated? How big is it?" "What's in the Heap Segment? How is it allocated? How big?"

Concise answers:
- Code segment holds machine instructions and often read-only constants.
- Static data segment holds global/static variables (initialized and uninitialized).
- Stack holds call frames, return addresses, parameters, and local variables; it is managed automatically per thread and typically has OS-configured limits.
- Heap holds dynamically allocated objects; it is process-wide memory managed by allocators (`malloc/new`) plus OS virtual-memory mechanisms.
:::

:::tip Question on address accesses
**Question:** "What happens when you read or write to an address?"

The behavior depends on mapping and permissions. Valid mapped pages behave like memory, device-mapped regions trigger I/O semantics, and invalid/protected accesses trap into the OS as faults.
:::

## 7. Third Concept: Process

### 7.1 Definition and role
A key definition is:

- **"Process: execution environment with Restricted Rights."**

The process includes an address space plus one or more threads, and owns resources such as file descriptors and file-system context.

Another key line is:

- **"An instance of an executing program is a process consisting of an address space and one or more threads of control."**

### 7.2 Protection-efficiency tradeoff
Processes improve protection and isolation, but process boundaries increase communication cost compared with communication among threads inside one process.

### 7.3 Single-threaded and multithreaded processes
Threads encapsulate concurrency, while address spaces encapsulate protection.

![Single and multithreaded processes](./lec02_materials/single_and_multithreaded_processes.png)

:::remark Questions on threads in one process
**Question:** "Why have multiple threads per address space?" and "Do multiple threads share heap?"

Yes, threads in one process share the same address space, including code/data/heap, while each thread keeps its own register context and stack. Multiple threads are used to increase concurrency and overlap CPU work with blocking operations.
:::

### 7.4 Multiprogramming and virtual CPU illusion
With one physical CPU, the OS multiplexes execution in time to create the illusion of many virtual CPUs.

![Illusion of multiple processors by time multiplexing](./lec02_materials/illusion_of_multiple_processors.png)

To switch between virtual CPUs, the OS saves/restores PC, SP, and registers. Switch triggers include timer interrupts, voluntary yield, and I/O events.

:::tip Question on virtual CPU illusion
**Question:** "How can we give the illusion of multiple processors?" and "How can it keep all these things straight?"

The OS virtualizes CPU execution by time slicing and context switching. It keeps the system coherent by storing per-thread/process state, serializing privileged updates in kernel mode, and reacting to asynchronous events (timer/I/O interrupts) through controlled mode transfer paths.
:::


### 7.5 Basic concurrency problem
Concurrency is fundamentally a shared-resource coordination problem. Processes behave as if they have exclusive access, while hardware resources are actually shared. The OS solves this using abstraction and controlled multiplexing.

The lecture also highlights a simpler unprotected model (common in some embedded/legacy systems): sharing improves convenience but weakens isolation and safety.

## 8. Fourth Concept: Dual Mode Operation and Protection

### 8.1 Why protection is mandatory
The OS must protect itself and programs for reliability, security, privacy, and fairness. A primary mechanism is controlling translation from program addresses to physical memory.

![OS protection boundary](./lec02_materials/os_protection_boundary.png)

### 8.2 Dual-mode hardware support
A key statement is:
- Hardware provides at least **Kernel mode** and **User mode**.

Support requirements include:
- A mode bit (user/system).
- Privileged operations that fail or trap in user mode.
- Controlled user->kernel transition that saves user PC/state.
- Controlled kernel->user return that restores user PC/state (e.g., return-from-interrupt).

![User/kernel privileged mode](./lec02_materials/user_kernel_privileged_mode.png)

:::remark Question on dual mode
**Question:** "What is needed in the hardware to support dual mode operation?"

At minimum, hardware needs a protection state bit, trap/interrupt machinery, and permission checks on privileged operations. Without these, software alone cannot reliably enforce isolation against buggy or malicious user code.
:::

## 9. Base and Bound: A Simple Protection Mechanism

### 9.1 Address translation with bounds checking
Base-and-Bound (B&B) uses two key registers:
- **Base**: starting physical location of a process region.
- **Bound**: size/limit for legal virtual offsets.

On each access, hardware checks bounds and translates legal addresses (conceptually `physical = base + virtual_offset`). Illegal accesses trap.

![Base-and-Bound address translation](./lec02_materials/base_bound_address_translation.png)

### 9.2 Static relocation variant (load time)
The lecture also presents a simpler load-time relocation approach:
- Addresses translated when program is loaded.
- Requires relocating loader.
- Still protects OS and isolates programs.
- No extra addition on the address path during execution.

:::remark Questions on B&B safety
**Question:** "Can the program touch OS?" and "Can it touch other programs?"

Not if bounds/translation are enforced correctly. A process can only access addresses mapped into its own allowed region; out-of-range accesses trap into the OS.
:::

### 9.3 User code running and return path
When user code runs, the mode is user mode and direct privileged operations are blocked. The next design question is how control returns to the OS for scheduling and system services.

![Simple B&B: user code running](./lec02_materials/simple_bb_user_code_running.png)

:::tip Question on switching between processes
**Question:** "How does kernel switch between processes? First question: How to return to system?"

Control returns via mode transfer events (syscall, interrupt, exception). Once in kernel mode, the OS can save current context and load another process context, then return to user mode.
:::

## 10. Mode Transfer and Interrupt Vector

### 10.1 Three types of mode transfer
The lecture distinguishes three mechanisms:
- **Syscall**: process requests OS service.
- **Interrupt**: asynchronous external event (timer, device).
- **Trap/Exception**: synchronous internal fault in current process.

A key sentence is:
- **"All 3 are an UNPROGRAMMED CONTROL TRANSFER."**

### 10.2 Where does transfer go?
The target is found through the interrupt/exception vector: an indexed table storing handler addresses and properties.

![Interrupt vector](./lec02_materials/interrupt_vector.png)

:::remark Question on target address resolution
**Question:** "How do we get the system target address of the unprogrammed control transfer?"

Hardware uses an event number (interrupt/exception/trap ID) to index into a privileged vector table, then jumps to the corresponding kernel handler entry.
:::

## 11. Lab 0 and Main Takeaway

### 11.1 Lab 0 focus
Lab 0 tasks:
- Booting Pintos.
- Debugging.
- Kernel Monitor.

Listed deadline: **February 27, 2025**.

### 11.2 Main takeaway
The lecture builds one coherent chain:
- Thread defines execution context.
- Address space defines accessible memory view.
- Process packages threads plus resources with isolation boundaries.
- Dual mode and translation enforce protection and controlled control transfer.

## Appendix A. Exam Review

### A.1 Must-know definitions
- **Thread**: single unique execution context (PC, registers, flags, stack).
- **Address space**: accessible addresses plus associated state, distinct from physical memory via translation.
- **Process**: executing-program instance containing an address space and one or more threads.
- **Dual mode**: user/kernel privilege separation enforced by hardware.
- **B&B**: base+bound protection/translation mechanism.

### A.2 Must-remember mechanisms
- Time multiplexing gives the illusion of multiple CPUs on one processor.
- Context switch requires saving/restoring PC/SP/registers.
- Protection relies on translation control plus privileged operations.
- Syscall/interrupt/exception all transfer control into kernel handlers.
- Interrupt vector maps event IDs to handler addresses/properties.

### A.3 High-value short-answer templates
- **Why is thread the first OS concept?**
  Because execution must always be represented as concrete machine state, and thread context is that state.
- **Why do we need address translation?**
  It separates program view from machine memory, enabling relocation, isolation, and controlled sharing.
- **Why can鈥檛 software-only protection work?**
  Protection requires hardware-enforced mode and privilege checks; otherwise user code could bypass policy.
- **How does one CPU run many processes?**
  The OS performs time multiplexing and context switching triggered by timer/syscall/exception events.

### A.4 Common mistakes
- Confusing thread with process.
- Assuming threads in one process have separate heaps.
- Ignoring the role of hardware in enforcing protection.
- Treating interrupts and exceptions as the same trigger type.
- Forgetting that address translation also supports isolation, not only relocation.

### A.5 Last-minute checklist
1. Can you define thread, address space, process, and dual mode in one sentence each?
2. Can you explain how B&B blocks illegal memory access?
3. Can you describe context switching steps (save/restore state)?
4. Can you distinguish syscall vs interrupt vs exception with one example each?
5. Can you explain how interrupt vectors choose kernel handlers?

:::tip How to use this review
Memorize A.1 first, rehearse A.3 as spoken answers, and use A.5 as your final self-check before exams.
:::
