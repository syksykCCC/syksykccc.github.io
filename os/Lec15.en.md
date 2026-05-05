# Lec15 - Memory 2: Virtual Memory (Cont.), Caching, and TLBs

## Learning Objectives
After this lecture, you should be able to explain why simple page tables do not scale, describe multi-level and inverted page-table designs, reason about protection and dual-mode constraints, and analyze how TLBs and cache organizations reduce translation and memory-access cost.

## 1. Recap: Translation Basics and the Scaling Problem
Address translation still follows the same core rule:
- The CPU generates virtual addresses.
- The MMU maps them to physical addresses.
- Protection checks happen during translation, not as a separate optional step.

### 1.1 Base-and-bound and segmentation recap
Base-and-bound and segmentation both isolate processes, but they do not fully solve long-term allocation and scaling issues. Segmentation improves flexibility but still suffers from fragmentation and management complexity.

### 1.2 Simple paging recap
In paging, a virtual address is split into `VPN + offset`:
- `VPN` indexes a page table entry (PTE).
- `offset` is copied unchanged into the physical address.
- PTE holds physical-page information plus permissions (`V/R/W/...`).

### 1.3 Why simple page tables become too large
For a 32-bit virtual address space and 4KB pages:

$$
\text{#PTEs} = \frac{2^{32}}{2^{12}} = 2^{20}
$$

With 4-byte PTEs:

$$
\text{Page-table size} = 2^{20}\times4 = 2^{22}\text{ bytes} = 4\text{ MB}
$$

For 64-bit virtual addresses and 4KB pages:

$$
\text{#PTEs} = \frac{2^{64}}{2^{12}} = 2^{52}
$$

With 8-byte PTEs:

$$
\text{Page-table size} = 2^{52}\times8 = 2^{55}\text{ bytes} \approx 36\times10^{15}\text{ bytes}
$$

This is huge mainly because address spaces are sparse; many entries would map nothing.

## 2. Two-Level and Multi-Level Page Tables
![Two-level paging overview](./lec15_materials/two_level_paging_overview.png)

### 2.1 Two-level split and sparse-space fix
A common 32-bit split is:
- `10 bits` for first-level index
- `10 bits` for second-level index
- `12 bits` offset (4KB page size)

This tree structure allocates second-level tables only when needed, so sparse regions do not force full table materialization.

### 2.2 What a PTE really stores
A PTE stores:
- A pointer (to next-level table or final physical page).
- Flags (`valid`, read/write permissions, and status bits).

An invalid entry can mean either:
- Truly unmapped/illegal region, or
- Not currently resident in memory (e.g., backing location on disk known by OS metadata).

### 2.3 Core PTE use cases
1. **Demand Paging**: keep only active pages in memory; missing pages trigger faults and are brought in on demand.
2. **Copy on Write (CoW)**: parent/child initially share read-only pages; first write fault creates private copies.
3. **Zero Fill On Demand (ZFOD)**: new pages are logically zero and are allocated/zeroed when first touched.

### 2.4 Worked translation example
![Two-level translation example](./lec15_materials/two_level_translation_example_0x90_to_0x80.png)

Example from the lecture diagram:
- Virtual address `0x90` (`1001 0000`) is split into first-level index, second-level index, and offset.
- First-level entry points to the corresponding second-level table.
- Second-level lookup returns the physical page.
- Final physical address becomes `0x80` (`1000 0000`) with the same offset bits.

### 2.5 Segments + pages as a table tree
![Multi-level segments + pages](./lec15_materials/multilevel_segments_plus_pages.png)

Multi-level translation can combine segmentation at upper levels and paging at lower levels:
- Top-level segment metadata checks validity/range.
- Lower-level page tables map to physical pages.
- Permission checks can reject access even after address lookup.

:::remark Question: What must be saved/restored on a context switch in this design?
At minimum, the OS must restore the top-level translation context: segment-register state (if used by that ISA design) and the pointer to the top-level table (e.g., page-table root).
:::

### 2.6 Sharing complete regions
![Complete segment sharing](./lec15_materials/complete_segment_sharing_across_processes.png)

Processes can share an entire segment/table subtree by pointing their top-level entries to the same lower-level structure. This supports efficient code/library sharing with per-entry permissions still enforced.

## 3. 64-bit Translation Depth and Protection Constraints
![x86_64 four-level page table](./lec15_materials/x86_64_four_level_page_table.png)

### 3.1 x86_64 typical split
With 48-bit canonical virtual addresses and 4KB pages, a common breakdown is:
- `9 + 9 + 9 + 9 + 12`

Each page-table entry is 8 bytes. A 4KB page-table page therefore holds:

$$
\frac{4096}{8}=512=2^9
$$

entries, which matches each 9-bit index level.

### 3.2 Why “just add more levels” is not always good
A deeper tree (e.g., hypothetical six-level lookup for broad 64-bit spaces) increases:
- Translation latency.
- Number of almost-empty intermediate tables in sparse spaces.

:::remark Question: What are the pros and cons of multi-level translation?
Pros: it allocates page-table memory on demand, handles sparse address spaces well, and supports sharing at page/subtree granularity.  
Cons: each reference may require multiple lookups, table pages must still be managed carefully, and misses can become expensive without TLB support.
:::

### 3.3 Dual-mode protection is mandatory
**A process must not modify its own translation tables.**  
If user code could rewrite page-table roots or entries, it could map arbitrary physical memory and break isolation completely.

Therefore:
- Privileged operations (e.g., updating page-table base registers and descriptor structures) are kernel-only.
- Page-table pages must be protected from user writes.
- User mode reaches kernel mode only through controlled exceptions/traps/system calls.

## 4. Inverted Page Table Alternative
![Inverted page table](./lec15_materials/inverted_page_table_hash_mapping.png)

A classic forward page table scales with virtual space.  
An **Inverted Page Table** uses a hash-based structure keyed around resident mappings, so size is tied more directly to physical memory.

Benefits:
- Attractive for very large virtual address spaces.
- Avoids allocating huge forward tables for sparse unmapped regions.

Costs:
- Hash-chain handling complexity (often hardware-assisted).
- Worse locality for translation metadata in some workloads.

![Address-translation comparison](./lec15_materials/address_translation_comparison_table.png)

### 4.1 Side-by-side tradeoff summary
| Scheme | Advantages | Disadvantages |
|---|---|---|
| Simple Segmentation | Fast context switching (CPU-maintained segment map) | Internal/external fragmentation |
| Paging (Single-Level) | No external fragmentation; simple allocation | Large table size (scales with virtual space), internal fragmentation |
| Paged Segmentation / Multi-Level Paging | Better handling of sparse spaces; easier incremental allocation/sharing | Multiple memory references per translation |
| Inverted Page Table | Table size scales with physical memory | Hash complexity; weaker metadata locality |

## 5. Why MMU Translation Must Be Cached
The MMU participates in every instruction fetch, load, and store.  
With multi-level tables, pure table-walk on every memory reference is too expensive.

Even a simple two-level situation can require multiple memory reads before the real data read. If translation structures miss in cache or are paged out, latency gets even worse.

## 6. Caching Fundamentals and AMAT
Caching keeps frequent cases fast and makes infrequent slow cases less dominant.

Two core locality principles:
- **Temporal Locality (Locality in Time)**: recently accessed items are likely to be accessed again soon.
- **Spatial Locality (Locality in Space)**: nearby addresses are likely to be accessed together.

Average Memory Access Time:

$$
\text{AMAT}=(\text{Hit Rate}\times\text{Hit Time})+(\text{Miss Rate}\times\text{Miss Time})
$$

with:

$$
\text{Hit Rate}+\text{Miss Rate}=1
$$

Lecture numeric example (`HitTime=1ns`, DRAM `100ns`, so `MissTime=101ns`):

$$
\text{AMAT}_{90\%}=0.9\times1+0.1\times101=11\text{ns}
$$

$$
\text{AMAT}_{99\%}=0.99\times1+0.01\times101=2\text{ns}
$$

The jump from 90% to 99% hit rate drastically improves average performance.

## 7. TLB: Caching Translation Results
![TLB translation cache structure](./lec15_materials/tlb_translation_cache_structure.png)

The **Translation Look-Aside Buffer (TLB)** caches recent `VPN -> PPN` mappings (plus permission/valid metadata):
- On TLB hit, hardware gets translation without page-table traversal.
- On TLB miss, hardware/software performs page-table walk, then refills TLB.
- If the located PTE is invalid, a page fault is raised.

Practical notes:
- TLB is typically small (often hundreds of entries) and commonly highly associative or fully associative because conflict misses are expensive.
- When page tables change, related TLB entries must be invalidated.
- TLB is logically in front of (or tightly overlapped with) the cache/memory pipeline.

:::remark Question: Does page-level locality really exist strongly enough for a TLB?
Yes. Instruction streams usually stay on a few nearby pages for long periods, stack activity is highly local, and data streams still have partial locality. That is why a small TLB often captures most translations.
:::

## 8. Cache Miss Sources and Cache Organization
![Cache miss sources](./lec15_materials/cache_miss_sources.png)

### 8.1 Major miss categories
1. **Compulsory misses**: first touch of a block.
2. **Capacity misses**: working set exceeds cache size.
3. **Conflict misses**: mapping collisions force eviction.
4. **Coherence misses**: external updates (other CPUs/devices) invalidate cached copies.

### 8.2 Block-address decomposition
A block address is decomposed into:
- `Tag`: identifies which memory block is present.
- `Index` (set select): selects candidate set/line(s).
- `Block offset` (data select): selects byte/word inside the cached block.

### 8.3 Direct-mapped, set-associative, fully-associative
![Cache placement example](./lec15_materials/cache_placement_example_block12.png)

For “block 12 in an 8-block cache”:
- Direct mapped: only one location (`12 mod 8 = 4`).
- Set associative: any way inside one set (`set = 12 mod #sets`).
- Fully associative: any line in the cache.

Higher associativity reduces conflict misses but increases lookup complexity.

### 8.4 Replacement on a miss
:::remark Question: Which block should be replaced on a miss?
Direct-mapped caches have exactly one victim choice.  
Set-associative and fully-associative caches choose among candidates, often with policies like Random or **LRU (Least Recently Used)** (or approximations of LRU in real hardware).
:::

### 8.5 Write policies
![Write-through vs write-back](./lec15_materials/write_through_vs_write_back.png)

- **Write through**: update cache and lower memory immediately.
  - Pro: read misses do not trigger dirty writeback.
  - Con: stores can stall on lower-level write traffic.
- **Write back**: update cache first; write lower memory on eviction of dirty lines.
  - Pro: repeated writes to same line avoid repeated DRAM writes.
  - Con: needs dirty tracking and can require writeback before servicing a read miss.

## 9. Key Takeaways
- Simple page tables are conceptually clean but scale poorly for large sparse virtual spaces.
- Multi-level tables reduce wasted metadata by allocating structure on demand.
- Inverted page tables trade locality and complexity for tighter memory scaling with physical RAM.
- Without caching, translation overhead can dominate memory latency.
- TLB is the critical translation cache that makes virtual memory practical at high speed.
- Cache design choices (mapping, associativity, replacement, write policy) directly shape miss behavior and system performance.

## Appendix A. Exam Review
### A.1 Must-remember definitions
- **Page table**: metadata that maps virtual page numbers to physical page numbers plus permissions/status.
- **PTE (Page Table Entry)**: one translation record with pointer and flags.
- **TLB**: hardware cache of recent translation results.
- **Temporal locality**: recently used data likely used again soon.
- **Spatial locality**: nearby addresses likely used together.

### A.2 Must-remember formulas
$$
\text{#pages}=\frac{\text{virtual space size}}{\text{page size}}
$$

$$
\text{Page-table size}=\text{#entries}\times\text{entry size}
$$

$$
\text{AMAT}=(\text{Hit Rate}\times\text{Hit Time})+(\text{Miss Rate}\times\text{Miss Time})
$$

### A.3 High-frequency short questions
1. Why does sparse address space make single-level page tables inefficient?
2. What exactly is cached in a TLB, and what happens on a TLB miss?
3. Why are user processes forbidden from modifying translation tables?
4. How do direct-mapped, set-associative, and fully-associative caches differ in block placement?
5. Compare write-through and write-back in terms of latency and complexity.

### A.4 Common mistakes
- Forgetting that page offset is copied unchanged from virtual to physical address.
- Treating “invalid PTE” as only one meaning (it may represent non-resident-but-known pages too).
- Ignoring TLB invalidation requirements after page-table updates.
- Confusing conflict misses with capacity misses.
- Assuming higher associativity is always better regardless of hardware cost.
