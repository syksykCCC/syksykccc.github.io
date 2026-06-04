# Lec16 - Memory 3: Demand Paging

## Learning Objectives
After this lecture, you should be able to connect address translation, TLBs, caches, page faults, backing store, working sets, and replacement policies into one coherent virtual-memory story. You should also be able to compute the effective access-time cost of page faults and explain why even a tiny page-fault rate can dominate performance.

## 1. Address Translation Recap
Virtual memory works because every user address is translated before it reaches physical memory. The translation mechanism simultaneously provides three properties:
- **Relocation**: a process can run as if it owns a clean virtual address space.
- **Protection**: invalid or unauthorized references are rejected during translation.
- **Flexible placement**: a virtual page can be backed by a physical frame, by disk, or by another backing object.

### 1.1 Base-and-bound translation
In a base-and-bound design, the CPU-generated virtual address is checked against a bound and then relocated by adding a base address. The base gives the physical start of the process region; the bound gives the legal size of that region.

This design is simple and fast, but it treats a process as one mostly contiguous region. That makes it hard to grow stack and heap independently, share selected regions, or handle sparse address spaces efficiently.

:::remark Question: Can a program touch the OS or another program under base-and-bound?
Only if the hardware/OS has set the base and bound incorrectly. A user reference outside the legal interval fails the bound check before it becomes a physical address. This is the protection role of relocation hardware: the program can compute any virtual address it wants, but only addresses inside its assigned interval are translated.
:::

### 1.2 Segmentation
Segmentation generalizes base-and-bound by letting one process have multiple variable-sized regions. A virtual address is split into:
- `segment number`
- `offset`

The segment number selects a segment-map entry containing a base, limit, valid bit, and permissions. The offset must be inside the limit; then the hardware adds the base to form the physical address. Architectures such as x86 expose this idea through segment registers, for example an instruction like `mov [es:bx], ax` uses the `es` segment and the `bx` offset.

:::remark Question: What is `V/N` in a segment or page-table entry?
`V/N` means **valid / not valid**. In segmentation, it says whether the segment entry may be used. In paging, a not-valid entry may mean an illegal/unmapped page, or it may mean a legal page that is simply not resident in memory and must be handled by the OS.
:::

Segmentation improves flexibility, but because segments have variable sizes it can still suffer from external fragmentation and placement complexity.

### 1.3 Simple paging
Paging splits memory into fixed-size pages and frames. A virtual address is split into:
- `VPN` (virtual page number)
- `offset`

The `VPN` indexes a page table entry (PTE), and the `offset` is copied unchanged into the physical address. A PTE stores a physical page/frame number plus permission and status bits.

Fixed-size pages make allocation easy and avoid external fragmentation, but a single-level page table can be huge. For example, a 32-bit virtual address with a 10-bit offset has a 22-bit virtual page number, so the page table would need about four million entries. With 4KB pages, the common 32-bit split is `20-bit VPN + 12-bit offset`, still requiring `2^20` PTEs for a fully materialized single-level table.

### 1.4 Two-level and multi-level page tables
Two-level paging treats the page table as a tree. A classic 32-bit, 4KB-page split is:
- `10 bits` first-level index
- `10 bits` second-level index
- `12 bits` offset

Each page-table page contains 1024 entries if entries are 4 bytes. On a context switch, the OS can switch address spaces by changing one page-table-root register, such as `CR3` on x86-like designs.

The important scaling trick is that invalid top-level entries mean the corresponding second-level table does not need to exist. Even second-level page-table pages can themselves be placed on disk if they are not currently needed.

Multi-level translation extends the same idea into a deeper tree. Some designs combine upper-level segmentation with lower-level paging: upper entries check coarse validity and bounds, while lower page tables map individual pages.

:::remark Question: What must be saved/restored on a context switch with segments plus pages?
The OS must restore the top-level translation context. That includes the page-table root pointer and, in a segmented design, the relevant segment-register or segment-table state. Without restoring this state, the same virtual address would be interpreted in the wrong address space.
:::

### 1.5 Inverted page tables
A normal forward page table scales with virtual address space size. An **Inverted Page Table** instead stores information about resident physical frames and uses a hash table to locate the mapping for a `(process, virtual page)` pair.

Its size is tied to physical memory rather than virtual address-space size, which is attractive for large 64-bit spaces. The tradeoff is that the hash lookup and collision chains are more complex and can have worse locality than walking a compact page-table tree.

### 1.6 Translation design comparison
| Scheme | Advantage | Disadvantage |
|---|---|---|
| Simple Segmentation | Fast context switching when the CPU maintains a segment map | Internal/external fragmentation |
| Single-level Paging | No external fragmentation; physical-page allocation is simple | Page-table size scales with virtual memory; internal fragmentation remains |
| Paged Segmentation / Multi-level Paging | Page-table size scales more closely with used virtual pages; allocation stays simple | Translation may require multiple memory references |
| Inverted Page Table | Table size scales with physical memory | Hashing is complex; page-table locality is weaker |

## 2. Translation Caching: TLBs and Cache Interaction
Without caching, every instruction fetch, load, and store could require a page-table walk before the real memory access. The system therefore caches translation results in a **Translation Look-Aside Buffer (TLB)**.

### 2.1 TLB locality
A TLB caches recent `VPN -> PPN` mappings, along with protection and status metadata. TLBs work because page-level locality exists:
- Instruction fetches often proceed sequentially through the same few pages.
- Stack activity is highly local.
- Data access has weaker but still useful locality.

:::remark Question: Can there be a TLB hierarchy?
Yes. Just like data caches, TLBs can have multiple levels with different sizes and access latencies. A small fast L1 TLB catches the common case, while a larger lower-level TLB reduces expensive page-table walks.
:::

### 2.2 Physically indexed and virtually indexed caches
![Physically indexed versus virtually indexed caches](./lec16_materials/physically_vs_virtually_indexed_caches.png)

A **physically indexed cache** receives a physical address after translation. This gives every physical byte one canonical cache location and lets the cache survive context switches cleanly. The cost is that TLB lookup lies on the cache-access critical path.

A **virtually indexed cache** begins lookup using the virtual address before translation. This can be faster because the TLB is less directly on the critical path, but it creates two hard problems:
- The same physical data may appear at multiple virtual addresses, creating synonyms/aliases.
- On a context switch, different processes may both use virtual address `0`, so cache entries may need process tags or flushing.

For the rest of this discussion, it is simplest to reason with physically addressed caches.

### 2.3 What TLB organization makes sense?
TLBs must be extremely fast, because their hit time is part of the common-case memory path. That pushes designers toward direct-mapped or low-associativity structures.

At the same time, a TLB miss is very expensive because it may trigger a multi-level page-table walk. Conflict misses are especially painful. If low-order page-number bits are used as the TLB index, the first code page, first data page, and first stack page can easily collide. If high-order bits are used instead, small programs may leave most of the TLB unused.

For this reason, small TLBs are often highly associative or fully associative. They are also small enough that associativity is feasible: classic TLBs may have 128 to 512 entries, and larger modern systems still treat the TLB as a precious hardware structure.

TLB entries must include protection information, not just addresses. A lookup by virtual address returns:
- physical page/frame number
- valid/status information
- permissions such as read/write/execute or user/supervisor access

If a fully associative lookup is too slow, a very small direct-mapped front-end, often called a **TLB slice**, can cache a few recent translations.

### 2.4 Overlapping TLB and cache access
![Overlapping TLB and cache access](./lec16_materials/overlapping_tlb_cache_access.png)

For physically indexed caches, the TLB and cache appear serial: translate first, then index the cache. Hardware can reduce this cost by overlapping the two operations.

The key observation is that the **page offset does not change** during translation. If the cache index and byte offset fit entirely inside the page offset bits, the cache can start selecting candidate bytes while the TLB is still translating the virtual page number.

In the lecture example, a 4KB cache with 4-byte lines uses:
- `10 bits` for cache index
- `2 bits` for byte offset

These 12 bits fit inside a 4KB page offset, so the cache index can be chosen before translation completes.

:::remark Question: What if the cache size is increased to 8KB?
An 8KB direct-mapped cache needs one more index bit. With 4-byte lines, the cache would need `11 index bits + 2 byte bits = 13 bits`, but a 4KB page offset has only 12 bits. One index bit would come from the virtual page number, whose physical value is not known until TLB lookup completes. The clean overlap breaks unless the design uses additional tricks such as higher associativity, page coloring, virtual indexing, or other cache/TLB pipeline techniques.
:::

### 2.5 Context switches and TLB consistency
A TLB entry maps a virtual page in one address space to a physical page. After a context switch, the same virtual page number may mean something completely different. The OS has two main options:
- **Invalidate or flush the TLB** on every address-space switch. This is simple but expensive.
- **Include a process identifier/address-space identifier in each TLB entry**. This lets translations from multiple address spaces coexist safely.

TLB consistency is also required when page tables change. If a page moves from memory to disk, from disk to memory, or changes permissions, any stale cached TLB entry must be invalidated; otherwise the processor may use an old translation.

### 2.6 Putting translation, TLB, and cache together
![Address translation, TLB, and cache flow](./lec16_materials/translation_tlb_cache_flow.png)

A complete memory reference follows this common path:
1. The CPU generates a virtual address.
2. The TLB is searched using the virtual page number, and possibly an address-space identifier.
3. On a TLB hit, permissions are checked and the physical page number is returned.
4. On a TLB miss, hardware or software walks the page table. If the PTE is valid, the TLB is refilled; if the PTE is not valid for the reference, the access becomes a page fault.
5. The physical address is split into cache tag, index, and byte offset.
6. On a cache hit, the requested data returns quickly.
7. On a cache miss, lower memory levels are accessed and the cache is refilled.

The figures in the lecture build this flow in stages: first page-table translation, then TLB shortcut, then physical-cache lookup. The important change at each stage is that one slow path is replaced by a fast common case, while the slow path remains available for misses.

## 3. Page Faults and Demand Paging
**A page fault occurs when the Virtual-to-Physical Translation fails.** It is a synchronous fault/trap caused by the instruction currently executing, not an asynchronous interrupt.

### 3.1 Why page faults happen
A reference can fault because:
- The PTE is marked invalid.
- The reference violates privilege level.
- The access mode violates permissions, such as writing a read-only page.
- The referenced mapping does not exist.

Protection violations usually terminate the faulting instruction or process. Other page faults may be recoverable: the OS can allocate a new stack page, implement copy-on-write, change accessibility, or bring a page from secondary storage into memory.

This is a fundamental inversion of the hardware/software boundary. Hardware detects the failed translation precisely, but software decides whether the fault is illegal or repairable.

### 3.2 Demand paging as caching
Modern programs and systems want more memory than DRAM can hold at once, but programs do not use all of their address space all the time. The classic **90-10 rule** says a program often spends about 90% of its time in about 10% of its code.

The solution is **Demand Paging: Treating the DRAM as a cache on disk**. Pages are brought into memory only when they are actually needed.

![Page fault to demand paging flow](./lec16_materials/page_fault_to_demand_paging_flow.png)

Interpreting demand paging as caching gives a useful map:
| Cache question | Demand-paging answer |
|---|---|
| What is the block size? | One page, such as 4KB |
| What is the organization? | Fully associative, because any virtual page can be placed in any physical frame |
| How is a page located? | First check the TLB; if needed, traverse the page table |
| What happens on a miss? | Trap to the OS, locate the page on disk/backing store, read it into memory, update metadata, then retry |
| What happens on a write? | Write-back style: mark the page dirty and write it back only when needed |

:::remark Question: Why is demand paging like a cache, and where does it differ from a normal hardware cache?
It is a cache because DRAM stores a subset of pages whose backing copy is on disk or another lower-level object. It differs because a miss is handled by the OS, the miss penalty is enormous, and replacement decisions interact with process scheduling, disk bandwidth, and fairness.
:::

### 3.3 The illusion of infinite memory
![Illusion of infinite memory](./lec16_materials/illusion_of_infinite_memory.png)

Demand paging creates the illusion that each process has a very large virtual memory, even though physical memory is smaller. The page table is the transparent level of indirection: the program sees a stable virtual address, while the OS may place the page in DRAM, on disk, or even behind a network-backed memory system.

This transparency affects performance, not correctness. If the page is not resident, the program may pause for a page fault, but the virtual address itself remains meaningful.

## 4. Demand Paging Mechanisms
![Demand paging mechanisms](./lec16_materials/demand_paging_mechanisms.png)

Demand paging is implementable because the PTE can represent both resident and non-resident states:
- **Valid => Page in memory, PTE points at physical page**.
- **Not Valid => Page not in memory; use info in PTE to find it on disk when necessary**.

When a user references a page with an invalid PTE, the MMU traps to the OS. The resulting trap is a **page fault**.

:::remark Question: What does the OS do on a page fault?
The OS first decides whether the fault is legal and repairable. If the page should exist but is not resident, the OS chooses a frame, possibly evicts an old page, writes the old page back if it is dirty, invalidates the old PTE and any cached TLB entry, loads the new page from disk, updates the page table, and resumes the thread at the original faulting instruction. The new TLB entry is loaded when execution continues.
:::

While the missing page is being read from disk, the faulting process is placed on a wait queue and the scheduler can run another ready process. This overlap is crucial because disk/page-fault service time is far longer than CPU time.

## 5. Backing Store, Executables, and Virtual Address Spaces
### 5.1 Historical and modern motivation
Historically, paging was motivated by systems with relatively small memory, large disks, and many users connected through terminals. Most of the address space lived on disk, while memory was kept full of frequently accessed pages and pages were actively swapped to and from disk.

Modern systems look different: a single machine may have large DRAM, large local disk, and remote/cloud storage. The motivation still remains because applications, shared libraries, file caches, and multiple processes can collectively use far more virtual memory than physical DRAM.

A real machine snapshot can show memory staying around 80% used and a large amount of memory shared among processes. Shared pages are one reason virtual memory is not simply "one private copy per process."

### 5.2 Many uses of virtual memory and demand paging
Demand paging supports several important OS behaviors:
- **Extend the stack**: allocate a page and zero it when the stack grows into a new page.
- **Extend the heap**: reserve virtual space and allocate physical frames only as the heap is touched.
- **Process fork**: create a copy of the page table, point entries at parent pages as no-write, keep shared read-only pages shared, and copy a page only on the first write.
- **Exec**: bring in only the actively used parts of the binary, on demand.
- **MMAP**: explicitly share a region or access a file as if it were RAM.

These examples all use the same central trick: virtual mappings can exist before physical frames are committed, and page faults fill in the missing physical state.

### 5.3 Loading an executable into memory
![Loading an executable into memory](./lec16_materials/loading_executable_into_memory.png)

An executable file lives on disk in the file system. It contains code and data segments, relocation entries, symbols, and metadata. To start a program, the OS creates the process state, initializes registers and the initial stack pointer, and creates virtual mappings for the executable's regions.

The OS does not have to read the whole executable into DRAM immediately. Code and data pages can be demand-paged from the executable image when the process first touches them.

### 5.4 Backing store for each virtual address space
![Backing store across multiple processes](./lec16_materials/backing_store_multiple_processes.png)

Each process has its own virtual address space and its own page-table view. Resident pages have PTEs pointing to physical frames. Non-resident but valid pages need a disk/backing location recorded by the OS.

The disk area used for these pages is called the **backing store** or **swap file**. It is often implemented as an optimized block store, but conceptually it can be viewed as a file-like region that stores page-sized blocks.

For every utilized virtual region, the OS must know either:
- where its resident physical frame is, or
- where to find its non-resident backing block.

:::remark Question: What data structure maps non-resident pages to disk?
Conceptually, the OS needs `FindBlock(PID, page#) -> disk_block`. Some systems store disk-block information in spare PTE bits when the PTE is invalid; others keep a separate software structure, sometimes compact if swap space is contiguous, or hash-based like an inverted page table. This structure is like a page table, but it is purely software metadata for finding backing storage.
:::

Usually the OS wants backing store even for resident pages, because a resident page may later need to be evicted. Clean code pages can often be mapped directly to the executable image on disk, saving a separate copy in the swap file. Multiple instances of the same program can also share code pages.

## 6. Handling a Page Fault Step by Step
![Summary of page-fault handling steps](./lec16_materials/page_fault_handling_steps.png)

A recoverable demand-paging fault proceeds as follows:
1. The process references a virtual page whose PTE is invalid or non-resident.
2. The MMU traps to the OS page-fault handler.
3. The OS verifies that the page is legal and identifies its backing-store location.
4. The OS obtains a free frame, or chooses a victim frame if necessary.
5. If the victim page is dirty, the OS schedules it to be written back to disk.
6. The OS starts reading the missing page into the selected frame.
7. While I/O is in progress, the faulting thread waits and another ready thread/process can run.
8. When the I/O completes, the OS updates the PTE to point at the new frame and invalidates/refreshes related TLB state.
9. The faulting thread is eventually rescheduled and the original instruction is restarted.

Restarting the original instruction matters: from the program's perspective, the memory access simply took a very long time and then succeeded.

### 6.1 Where does a free frame come from?
The OS usually keeps a free list of physical frames. If memory becomes too full, Unix-like systems may run a background page-out daemon or "reaper" that:
- schedules dirty pages to be written back to disk,
- zeroes clean pages that have not been accessed for a while,
- prepares frames that can be reused quickly.

As a last resort, the OS must evict a page before satisfying the fault. This leads directly to the replacement-policy problem.

:::remark Question: How should these mechanisms be organized?
They should be organized around replacement policy and resource allocation. The OS must decide which pages to keep, which dirty pages to clean in the background, how many frames each process receives, and how disk paging bandwidth is shared. This is analogous to CPU scheduling: utilization, fairness, and priority all matter.
:::

## 7. Working Set Model and Page-Fault Cost
### 7.1 Working set model
![Working set model](./lec16_materials/working_set_model.png)

As a program executes, it transitions through a sequence of **working sets**: varying-sized subsets of its address space that are actively used for some interval of time. A loop may use one working set; a function call may shift into another; loading a new module may create a much larger temporary working set.

The operating system wants the active working set to fit in memory. If it does, the process runs with few faults. If it does not, the process repeatedly faults and evicts pages it will soon need again.

### 7.2 Cache behavior under the working set model
![Cache behavior under the working set model](./lec16_materials/working_set_cache_behavior.png)

Hit rate generally rises as cache or memory size increases, but not smoothly. It often increases in steps when a whole working set begins to fit. A new working set can create a new plateau: initially many pages miss, then the hit rate improves after the active set becomes resident.

The same miss categories used for caches apply to demand paging:
- **Compulsory misses**: first time a page is brought into memory.
- **Capacity misses**: the active working set is larger than available memory.
- **Conflict misses**: technically absent in virtual memory because the page cache is fully associative; any page can be placed in any frame.
- **Policy misses**: a page was in memory, but the replacement policy evicted it too early.

:::remark Question: How can these page-cache misses be reduced?
Compulsory misses can be reduced by prefetching, but only if future accesses can be predicted. Capacity misses require more available memory or better allocation among processes. Conflict misses are not a real issue for demand paging because physical frames are fully associative. Policy misses require a better replacement policy, such as approximating LRU rather than evicting useful pages prematurely.
:::

### 7.3 Demand paging cost model
Since demand paging behaves like caching, average access time can be computed using **Effective Access Time (EAT)**:

$$
EAT = HitRate \times HitTime + MissRate \times MissTime
$$

Because `HitRate + MissRate = 1`, this can also be written as:

$$
EAT = HitTime + MissRate \times MissPenalty
$$

where:

$$
MissPenalty = MissTime - HitTime
$$

Example:
- Memory access time is `200 ns`.
- Average page-fault service time, used as miss penalty, is `8 ms`.
- Let `p` be the probability of a page fault.

Then:

$$
EAT = 200ns + p \times 8ms
$$

Converting `8 ms` to nanoseconds:

$$
EAT = 200ns + p \times 8{,}000{,}000ns
$$

If one access out of 1,000 causes a page fault, then `p = 0.001`:

$$
EAT = 200ns + 0.001 \times 8{,}000{,}000ns = 8{,}200ns = 8.2\mu s
$$

That is about a 40x slowdown relative to 200 ns memory access. Page faults are so expensive that a miss rate that looks tiny can still dominate performance.

:::remark Question: What if we want slowdown by less than 10%?
We need `EAT < 200ns x 1.1 = 220ns`. Using `EAT = 200ns + p x 8,000,000ns`, we need `p x 8,000,000ns < 20ns`, so `p < 2.5 x 10^-6`. That is roughly one page fault in 400,000 memory accesses.
:::

### 7.4 Replacement policies
When memory is full, the OS must choose a victim page. Common policies include:
- **FIFO**: place pages on a queue and replace the page at the end.
- **Random**: pick a random page for each replacement.
- **MIN**: replace the page whose next use is farthest in the future. This is optimal but not implementable online because the future is unknown.
- **LRU**: replace the page used farthest in the past. This approximates the idea that recent past use predicts near future use.

Replacement policy matters because the cost of a bad decision is not just a cache miss; it can be an 8 ms disk-level page fault.

## 8. Key Takeaways
- **Demand Paging: Treating the DRAM as a cache on disk** is the central idea of this lecture.
- The page table tracks which pages are resident in memory and which require OS intervention.
- A page fault is a precise synchronous trap caused by a failed virtual-to-physical translation.
- TLBs make translation fast, but TLB entries must be protected and kept consistent across context switches and page-table updates.
- Physically indexed caches simplify correctness but put translation on the critical path; overlap works when cache index bits fit in the page offset.
- Backing store connects non-resident virtual pages to disk blocks.
- The working set model explains why memory pressure can be gentle when active sets fit and disastrous when they do not.
- Even a page-fault probability of 1/1000 can produce about a 40x slowdown in the example cost model.

## Appendix A. Exam Review
### A.1 Must-remember definitions
- **Page fault**: a synchronous fault/trap caused when virtual-to-physical translation fails.
- **Demand paging**: bringing pages into DRAM only when they are referenced, treating DRAM as a cache for disk/backing store.
- **Backing store / swap file**: disk storage used to hold page-sized backing blocks for virtual pages.
- **Resident page**: a virtual page currently present in physical memory.
- **Non-resident page**: a valid virtual page whose contents are not currently in physical memory.
- **Dirty page**: a resident page modified in memory and requiring write-back before eviction.
- **Working set**: the subset of a process's address space actively used during an interval.
- **TLB consistency**: invalidating or updating cached translations when page tables or permissions change.

### A.2 Must-remember formulas
$$
EAT = HitRate \times HitTime + MissRate \times MissTime
$$

$$
EAT = HitTime + MissRate \times MissPenalty
$$

$$
MissPenalty = MissTime - HitTime
$$

For the lecture example:

$$
EAT = 200ns + p \times 8{,}000{,}000ns
$$

To keep slowdown under 10%:

$$
p < 2.5 \times 10^{-6} \approx \frac{1}{400{,}000}
$$

### A.3 Page-fault handling checklist
1. Detect failed translation and trap to the OS.
2. Verify the reference is legal and repairable.
3. Locate the missing page in backing store.
4. Obtain a free frame or select a victim.
5. Write back the victim if dirty.
6. Read the missing page into memory.
7. Update the PTE and TLB state.
8. Restart the original instruction.

### A.4 High-frequency short questions
1. Why can an invalid PTE mean either "illegal" or "not resident yet"?
2. Why is demand paging a fully associative cache?
3. Why does write-back make more sense than write-through for demand paging?
4. Why must stale TLB entries be invalidated after page-table changes?
5. Why does a page-fault rate of 1/1000 cause such a large slowdown?
6. What is the difference between compulsory, capacity, conflict, and policy misses in demand paging?

### A.5 Common mistakes
- Treating a page fault as an asynchronous interrupt rather than a synchronous trap.
- Forgetting that a protection fault and a demand-paging fault have different OS outcomes.
- Ignoring the wait-queue/scheduler step while disk I/O is in progress.
- Assuming physical memory must contain every virtual page of every running process.
- Confusing backing store metadata with hardware page-table traversal.
- Believing conflict misses are central to demand paging; the page cache is fully associative, so policy and capacity dominate.
