# Lec22 - File System 3: Buffering, Reliability, and Transactions

## Learning Objectives
After this note, you should be able to explain how memory-mapped files connect the virtual-memory system to the file system, how the buffer cache changes open/read/write/eviction behavior, why delayed writes improve performance but create crash-recovery risks, and why file systems need durability, reliability, and transaction-like all-or-nothing update semantics. You should also be able to compare RAID 1, RAID 5, RAID 6, erasure coding, geographic replication, careful ordering with recovery, and copy-on-write.

## 1. File Layout Background
The file system already has several ways to map a file name or file number to data blocks:

- FAT uses a File Allocation Table. A file number indexes the root of a linked list of blocks, and logical block lookup follows that chain.
- Unix-style inodes store metadata and a multi-level pointer tree with direct, indirect, double-indirect, and triple-indirect pointers.
- Berkeley FFS keeps inode-based indexing but improves locality by distributing inodes, data blocks, metadata, and free space across block groups.
- NTFS uses the Master File Table, attribute-value records, resident data for small files, and variable-length extents for larger files.

These layouts decide where persistent data lives. Lec22 focuses on what happens between memory and storage while those data structures are being used: file contents can be mapped into virtual address spaces, disk blocks can be cached in memory, writes can be delayed, and crashes can interrupt updates halfway through.

:::remark Question: Why does a file-system note need memory-management concepts?
Files and virtual memory are not separate worlds. `exec` maps executable file contents into a process address space. `mmap()` maps ordinary files into virtual memory. The buffer cache stores file-system blocks in memory. Once file data moves through memory, page faults, replacement, dirty bits, and writeback policy all become part of file-system behavior.
:::

## 2. Memory-Mapped Files
Traditional file I/O uses explicit transfers between process buffers and file regions. A program calls `read()` or `write()`, the kernel copies data between user memory and kernel buffers, and the file system eventually moves disk blocks to or from storage. This involves system calls and multiple memory copies.

Memory-mapped files change the interface. Instead of explicitly copying bytes into a buffer, the kernel maps a file directly into an empty region of the process address space. Reading that address implicitly pages file contents in. Writing that address modifies memory first and eventually pages the modified contents out.

Executable files use the same idea when a process is executed. Code and data regions of the executable are backed by file contents, and the system can load pages on demand rather than reading the whole executable upfront.

:::remark Question: What does it mean for a virtual-memory region to be "backed by a file"?
It means the page table region has a persistent source and destination. If a page in that region is missing, the page-fault handler can fill it from the corresponding file offset. If a page in that region is modified, the system can eventually write the dirty contents back to the file, depending on mapping flags and synchronization policy.
:::

## 3. Using Paging to Implement `mmap()`
A normal demand-paging page fault loads a missing page from disk and updates the page-table entry so the instruction can retry. A file-backed mapping uses the same machinery, but the backing object is a file rather than anonymous swap space.

![Using paging to mmap files](./lec22_materials/mmap_paging_file_backed_region.png)

The process is:

1. A process touches a virtual address in a mapped file region.
2. The MMU consults the page table and finds that the page is not resident.
3. The access triggers a page fault.
4. The page-fault handler recognizes that this virtual page is backed by a file.
5. The kernel reads the corresponding file contents into memory.
6. The kernel creates or updates the page-table entry for the mapped region.
7. The original instruction retries and now reads file contents from memory.

The key change is that file access becomes implicit. A load instruction can cause file I/O through the page-fault path.

:::remark Question: Why is this not just a normal `read()` in disguise?
Both paths may eventually read the same disk block, but the control flow is different. With `read()`, the program explicitly requests bytes and the kernel copies them into a user buffer. With `mmap()`, the program reads an address; if the page is absent, the page fault brings in the file contents and the program continues as if it were ordinary memory.
:::

## 4. The `mmap()` System Call
The system call interface is:

```c
void *mmap(void *addr, size_t len, int prot, int flags, int fd, off_t offset);
```

![mmap example code](./lec22_materials/mmap_example_code.png)

The mapping may request a specific virtual address region, or it may let the system find one. Letting the OS choose is common because it is tricky for an application to know where the holes in its virtual address space are.

The call is used for both file manipulation and interprocess sharing:

- `addr` chooses the starting virtual address, or `0` asks the OS to choose.
- `len` is the mapped length.
- `prot` controls permissions such as `PROT_READ` and `PROT_WRITE`.
- `flags` describes mapping behavior such as `MAP_FILE` and `MAP_SHARED`.
- `fd` identifies the opened file.
- `offset` selects where in the file the mapping begins.

:::remark Question: What is the meaning of `mmap(0, 10000, PROT_READ|PROT_WRITE, MAP_FILE|MAP_SHARED, myfd, 0)`?
The first `0` asks the OS to choose the starting virtual address. The length is 10,000 bytes. The region is readable and writable. It is backed by a file and shared, so writes to the mapping are meant to be visible through the file rather than only private to this process. `myfd` identifies the file, and the final `0` maps starting at file offset 0.
:::

## 5. `mmap()` Example: Scenario, Steps, and Result
The example program opens a file named by `argv[1]`, maps 10,000 bytes from the beginning of that file, prints the address of several memory regions, prints the mapped file content with `puts(mfile)`, and then executes:

```c
strcpy(mfile + 20, "Let's write over it");
```

![mmap example output](./lec22_materials/mmap_example_output.png)

The example begins with a file whose content is:

```text
This is line one
This is line two
This is line three
This is line four
```

The program output shows representative addresses:

- data segment: `105d63058`;
- heap: `7f8a33c04b70`;
- stack: `7fff59e9db10`;
- mapped file region: `105d97000`.

The mapped region is a normal virtual address range from the program's perspective, but it is backed by the file. When the program writes at `mfile + 20`, it overwrites bytes beginning 20 bytes into the file mapping. After the program exits, `cat test` shows that the file content has changed:

```text
This is line one
ThiLet's write over its line three
This is line four
```

The result demonstrates the core mechanism: a memory write can become a file modification because the virtual page is file-backed and shared.

:::remark Question: Why does writing to `mfile + 20` change the file rather than just a private buffer?
The mapping uses `MAP_SHARED`, so the mapped memory is a shared view of the file. A write modifies the cached page for that file region. The modified page may not reach disk immediately, but it is part of the file's shared state and can eventually be written back.
:::

## 6. Sharing Through Mapped Files
Two processes can map the same file into their own virtual address spaces.

![Sharing through mapped files](./lec22_materials/mapped_file_sharing.png)

Each process sees its own VAS layout, including instructions, data, heap, stack, and OS region. The mapped file pages may appear at different virtual addresses in different processes, but both mappings can refer to the same physical memory page and the same file contents. This is a natural way to share data between processes.

Anonymous memory can also be shared between parents and children. In that case there is no file backing; the backing storage is swap space.

:::remark Question: If two processes map the same file, do they need the same virtual address?
No. Virtual addresses are per-process names. Process A can map the file at one virtual address and Process B can map it at another. Sharing works because both virtual mappings can point to the same physical page or the same file-backed object.
:::

## 7. Buffer Cache: Core Idea
The kernel must copy disk blocks into main memory before it can inspect or modify them. These blocks may be file data, inodes, directory contents, free-space maps, or other metadata.

The key definition is:

**Buffer Cache: Memory used to cache kernel resources, including disk blocks and name translations**.

The buffer cache exploits locality by caching:

- name translations, such as path-to-inode mappings;
- disk blocks, such as block-address-to-disk-content mappings;
- metadata blocks, such as inodes, directory blocks, and free bitmaps.

The buffer cache can contain **dirty** blocks, meaning blocks that have been modified in memory but not yet written back to disk.

![File system buffer cache overview](./lec22_materials/buffer_cache_overview.png)

:::remark Question: Why is the buffer cache implemented in OS software rather than hardware?
The OS understands file-system block identities, metadata purposes, name translations, open files, and writeback policy. Hardware caches and TLBs cache low-level addresses, but they do not know that a block is an inode, a directory block, a free bitmap, or a dirty file block that must be written carefully.
:::

## 8. Buffer Cache During `open()`
Opening a file begins with directory lookup.

![Buffer cache open lookup](./lec22_materials/buffer_cache_open_lookup.png)

The directory lookup repeats as needed:

1. Load a directory block from disk into the buffer cache.
2. Search the directory block for a name-to-inumber mapping.
3. If the path has more components, use the inumber to find the next directory inode.
4. Repeat until the final file is found.

The buffer-cache state changes because a directory block that was free in memory becomes a cached directory block. If the needed directory block is not already cached, it enters a transient **being read** state while disk I/O is in progress.

After lookup succeeds, the kernel creates a reference through the open file descriptor.

![Buffer cache open descriptor](./lec22_materials/buffer_cache_open_descriptor.png)

The open file descriptor points to kernel state that eventually reaches the inode. The directory block contains an entry like `<name>:inumber`, and the inode becomes cached as well.

:::remark Question: Why can repeated `open()` calls become faster?
If directory blocks, name translations, and inodes stay in the buffer cache, later `open()` calls avoid disk reads. The kernel can reuse cached directory contents and cached inode blocks instead of reloading the same metadata from storage.
:::

## 9. Buffer Cache During `read()`
A read starts from the file descriptor and the inode.

![Buffer cache read flow](./lec22_materials/buffer_cache_read_flow.png)

The read process is:

1. Use the inode to traverse the file's index structure.
2. Find the data block containing the requested file offset.
3. Load the data block into the buffer cache if it is missing.
4. Copy all or part of the cached block into the user's read buffer.

If the data block is already cached, the disk read is avoided. If only part of the block is requested, the kernel still caches the full disk block but copies only the requested byte range to user space.

## 10. Buffer Cache During `write()`
A write is similar to a read, but it may have to allocate new blocks and update metadata.

![Buffer cache write flow](./lec22_materials/buffer_cache_write_flow.png)

A write can require:

- loading the relevant existing data block;
- allocating a new data block if the file grows;
- updating the free map or free bitmap;
- updating the inode so it points to the new block;
- eventually writing dirty blocks back to disk.

The question "blocks need to be written back to disk; inode?" matters because file data and metadata must agree. If a new data block is written but the inode is not updated, the data is unreachable. If the inode points to a block before the block is correctly initialized, a crash can expose garbage or someone else's old data.

:::remark Question: Why does writing a file often modify more than one disk block?
A logical write may change file data, the inode, an indirect block, the free bitmap, and a directory entry. The user thinks "write these bytes", but the file system may need several physical block updates to make the persistent structure consistent.
:::

## 11. Buffer Cache Eviction and Transitional States
When the buffer cache fills up, the OS must choose blocks to evict. Clean blocks can simply be discarded because the disk already has the same contents. Dirty blocks must be written back.

![Buffer cache eviction dirty state](./lec22_materials/buffer_cache_eviction_dirty.png)

Blocks being written back to disk go through a transient state. During that time, the block is neither simply free nor simply stable: it is in motion between memory and storage. The OS must track this state so another operation does not reuse the buffer incorrectly or assume the disk has already been updated.

Buffer-cache blocks therefore move among states such as:

- free;
- being read from disk;
- in use as a directory block, inode block, data block, or free-map block;
- dirty;
- being written to disk.

## 12. Buffer Cache Replacement
The buffer cache is implemented entirely in OS software. Blocks go through transitional states between free and in-use, and they serve many purposes: inodes, directory data, file data, and free-space maps. The OS maintains pointers into these cached blocks, so replacement must respect active users.

The natural replacement policy is LRU. Unlike hardware caches or TLBs, the buffer cache can often afford the overhead of a full LRU implementation.

| Policy issue | Benefit | Cost or failure mode |
|---|---|---|
| LRU for buffer cache | Works well when memory holds the active working set of files. | A large sequential scan can flush useful cached data with blocks used only once. |
| "Use Once" hint | Allows the file system to discard blocks as soon as they are consumed. | Requires applications or the OS to identify streaming access accurately. |
| Dynamic cache sizing | Balances file caching against virtual-memory paging. | A poor boundary can either starve applications or make file caching ineffective. |

:::remark Question: Why can LRU perform badly for a sequential scan?
A sequential scan touches many blocks once. LRU treats recent blocks as valuable, so the scan can push out older but actually reusable blocks. After the scan ends, the cache may be full of data that will not be used again.
:::

## 13. Buffer Cache Size
The OS must decide how much memory belongs to the buffer cache and how much remains available for virtual memory.

Too much memory for the file-system cache means fewer applications can run or the virtual-memory system may page heavily. Too little memory for the file-system cache means many file accesses miss the cache and applications run slowly because disk caching is ineffective.

The practical solution is to adjust the boundary dynamically so that disk access rates for paging and file access are balanced.

:::remark Question: What does "balanced" mean for buffer cache versus virtual memory?
If paging traffic is high, applications need more memory. If file-cache miss traffic is high, the buffer cache needs more memory. A dynamic boundary tries to put memory where it reduces disk I/O the most, rather than fixing the split permanently.
:::

## 14. File-System Prefetching
**Read Ahead Prefetching: fetch sequential blocks early**.

The idea is to exploit the fact that common file access is often sequential. If a process reads block `i`, the system may prefetch blocks `i+1`, `i+2`, and so on before the process asks for them. The disk elevator algorithm can interleave prefetches from concurrent applications efficiently.

The amount of prefetching is a tradeoff:

- Too much prefetching delays requests from other applications and wastes cache space.
- Too little prefetching causes many seeks and rotational delays among concurrent file requests.

:::remark Question: How should the system decide how much to prefetch?
It should treat prefetching as a prediction problem. Sequential streams benefit from larger read-ahead windows, while random access benefits from little or no prefetch. Many systems adapt the window: increase it when sequential predictions are correct, and shrink it when prefetched blocks are not used.
:::

## 15. Delayed Writes
**Buffer cache is a writeback cache (writes are termed "Delayed Writes")**.

When a program calls `write()`, the kernel copies data from user space into the kernel buffer cache and can return quickly to user space. Later `read()` calls are fulfilled by the cache, so they see the results of the write even if the data has not reached disk.

Data from a write syscall finally reaches disk when:

- the buffer cache is full and the OS needs to evict something;
- the buffer cache is flushed periodically to reduce crash-loss exposure.

Delayed writes improve performance because the program does not wait for disk I/O on every write. They also give the disk scheduler many requests to reorder, and they can allow delayed block allocation so multiple blocks can be allocated together and kept contiguous. Some short-lived files never need to reach disk at all.

:::remark Question: Why can delayed writes improve file layout?
If blocks are allocated immediately one at a time, the allocator may not know how large the file will become. If allocation is delayed, the system may observe several dirty blocks for the same growing file and allocate them together as a contiguous run.
:::

## 16. Buffer Caching Versus Demand Paging
Buffer caching and demand paging both cache disk-backed data in memory, but they have different goals and policies.

| Aspect | Demand paging | Buffer cache |
|---|---|---|
| Main object | Virtual-memory pages. | File-system blocks, metadata blocks, and name translations. |
| Replacement | Full LRU is usually infeasible, so approximations such as Clock are used. | LRU is often acceptable because the OS has more software control. |
| Eviction timing | Evict not-recently-used pages when memory is close to full. | Write back dirty blocks periodically even if recently used. |
| Reason for periodic writeback | Not the central policy. | Minimize data loss in case of a crash. |

:::remark Question: Why write back a dirty buffer-cache block even if it was used recently?
Recency is useful for performance, but persistent data also has a risk window. A recently used dirty block may contain important metadata or file contents. Periodic writeback shrinks the amount of data that can be lost or left inconsistent if the machine crashes.
:::

## 17. Persistent State and Dirty Metadata
Delayed writes are not foolproof. The system can still crash while dirty blocks remain in memory. Linux, for example, periodically flushes dirty data, but a crash can happen before the next flush.

The dangerous case is dirty metadata. If a dirty block is a directory block and the machine crashes before it reaches disk, the system might lose the pointer from a file name to the file's inode. The inode or data blocks may still exist, but the directory no longer points to them. This can leak space and leave the file system inconsistent.

The conclusion is direct: **File systems need recovery mechanisms**.

:::remark Question: What if the dirty block was for a directory?
If the directory update is lost, the file name may not point to the inode anymore. The file's data blocks may have been allocated, and the inode may exist, but no directory entry reaches it. That is a space leak and a consistency problem: the file system has allocated state that is not reachable through the namespace.
:::

## 18. Availability, Durability, and Reliability
Three related terms are important:

- **Availability: the probability that the system can accept and process requests**. Availability is often measured in "nines"; for example, 99.9% is 3-nines of availability. The key idea is independence of failures.
- **Durability: the ability of a system to recover data despite faults**. This is fault tolerance applied to data. Durability does not necessarily imply availability: data on disk may be durable, but it cannot be accessed while the machine is down.
- **Reliability: the ability of a system or component to perform its required functions under stated conditions for a specified period of time**. Reliability is usually stronger than simple availability because the system must be up and working correctly. It includes availability, security, fault tolerance, and durability.

The file system must ensure that data survives system crashes, disk crashes, and other problems.

:::remark Question: Why does high durability not automatically mean high availability?
A powered-off disk may still contain perfectly recoverable data, so durability is high. But while the machine is down, the system cannot accept or process requests, so availability is low. Availability is about service now; durability is about data survival.
:::

## 19. Making File Systems More Durable
Durability can be improved at several layers.

First, disk blocks can contain Reed-Solomon error-correcting codes (ECC) to handle small media defects. This allows recovery from small defects in the disk drive.

Second, writes can be made to survive in the short term:

- abandon delayed writes and force data to disk sooner; or
- use battery-backed RAM, called non-volatile RAM or NVRAM, for dirty blocks in the buffer cache.

Third, data can be made to survive in the long term through replication. More than one copy of the data is needed. The important element is **independence of failure**:

- copies on the same disk do not survive a disk-head failure;
- copies on different disks may not survive a server failure;
- copies on different servers may not survive a building-wide failure;
- copies on different continents can survive much larger correlated failures.

:::remark Question: Why is "independence of failure" central to replication?
Replication only helps if replicas do not fail together. Two copies on the same broken disk are not meaningfully safer than one copy. The more independent the failure domains are, the more likely at least one copy survives.
:::

## 20. RAID
**RAID: Redundant array of inexpensive/independent disks**.

RAID provides storage virtualization by building a logical disk drive from multiple physical disk drives. The goals are reliability, performance, and capacity. A RAID system can provide better reliability, performance, and capacity than a single physical drive, depending on the RAID level.

## 21. RAID 1: Disk Mirroring or Shadowing
RAID 1 fully duplicates each disk onto its shadow.

![RAID 1 mirroring and shadowing](./lec22_materials/raid1_mirroring_shadowing.png)

Its properties are:

- It is useful in high-I/O-rate and high-availability environments.
- It is expensive because it has 100% capacity overhead.
- A logical write becomes two physical writes.
- Highest write bandwidth requires synchronized heads and rotation, which is challenging.
- Reads can be optimized because either copy can serve the read, and two independent reads to the same data can proceed in parallel.
- Recovery after disk failure means replacing the disk and copying data to the new disk.
- A hot spare is an idle disk attached to the system for immediate replacement.

:::remark Question: Why are RAID 1 reads easier to optimize than writes?
A read can use either mirror, so the system can choose the less busy disk or the disk whose head is closer. A write must update both mirrors, so it waits for the slower side and consumes bandwidth on both disks.
:::

## 22. RAID 5: High I/O Rate Parity
RAID 5 stripes data across multiple disks. Successive data blocks are stored on successive non-parity disks, which increases bandwidth over a single disk.

![RAID 5 parity](./lec22_materials/raid5_high_io_rate_parity.png)

Parity blocks are constructed by XORing data blocks in the same stripe. In the first stripe:

$$
P0 = D0 \oplus D1 \oplus D2 \oplus D3
$$

If Disk 3 fails, the missing block `D2` can be reconstructed as:

$$
D2 = D0 \oplus D1 \oplus D3 \oplus P0
$$

This works because XOR has the property that applying the same value twice cancels it out. RAID 5 can tolerate the loss of any one disk in a stripe.

:::remark Question: Why can RAID 5 reconstruct one missing disk but not generally two?
Each stripe has one independent parity equation. One missing value can be solved from one equation. If two values are missing, there are two unknowns but still only one equation, so RAID 5 does not have enough information to reconstruct both.
:::

## 23. RAID 6 and Erasure Codes
In general, a RAID scheme can be viewed as an **erasure code**. The system must know which disks are bad and treat missing disks as erasures.

Modern disks are large, so RAID 5 is often not sufficient. Rebuilding a failed disk can take so long that another disk may fail during recovery. RAID 6 allows two disks in a replication stripe to fail, using a more complex erasure code such as EVENODD.

More general Reed-Solomon erasure coding works like this:

- start with `m` data fragments;
- generate `n - m` extra fragments;
- tolerate `n - m` failures;
- recover the original data from any `m` surviving fragments.

For example, data can be split into `m = 4` fragments, expanded into `n = 16` fragments, and distributed across the Internet. Any 4 fragments can recover the original data, making the data very durable.

:::remark Question: Why does RAID 6 become important as disks become larger?
Large disks take longer to rebuild. During a long rebuild window, the array is vulnerable: if another disk fails before recovery completes, RAID 5 loses data. RAID 6 reduces that risk by tolerating two failures in the same stripe.
:::

## 24. Geographic Replication
Durability can be increased by spreading replicas or erasure-coded fragments across geographically separated locations.

![Geographic replication](./lec22_materials/geographic_replication.png)

The benefits are:

- It is highly durable because destroying all copies is difficult.
- It is highly available for reads.
- With simple replication, a reader can read any copy.
- With erasure coding, a reader can read any `m` of `n` fragments.

The cost is write availability and consistency:

- If strict replication is required, a write may fail when any one replica is unavailable.
- Alternatively, the system may use a relaxed consistency model, accepting that replicas may temporarily diverge.

:::remark Question: Why are geographically replicated writes harder than reads?
A read can often use any available replica or enough erasure-coded fragments. A write must update the system's durable state. If every replica must agree before the write commits, one unavailable replica can block the write. If the system does not wait for every replica, it needs a consistency model that handles temporary disagreement.
:::

## 25. File-System Reliability Versus Block-Level Reliability
Block-level reliability protects against media defects or disk failures, but file-system reliability also has to handle crashes during multi-block updates.

If disk loses power or software crashes:

- some operations in progress may complete;
- some operations in progress may be lost;
- overwriting a block may only partially complete.

RAID does not protect against all such failures:

- it does not protect against writing bad state correctly to every disk;
- if one disk in a RAID group is not written while others are, the group can become inconsistent.

The file system needs durability at minimum: previously stored data must be retrievable, perhaps after recovery, regardless of failure. But durability alone is not enough, because the file system also needs consistency.

:::remark Question: Why can RAID preserve bad state?
RAID mirrors or reconstructs blocks; it does not understand file-system invariants. If the file system writes an inconsistent directory or inode state, RAID can faithfully store that inconsistent state on multiple disks.
:::

## 26. The Storage Reliability Problem
A single logical file operation can involve updates to multiple physical disk blocks:

- inode;
- indirect block;
- data block;
- bitmap or free map;
- directory block.

With sector remapping, even one physical block update can require multiple lower-level sector updates. At the physical level, operations complete one at a time, but the system also wants concurrent operations for performance.

The core question is:

**How do we guarantee consistency regardless of when crash occurs?**

:::remark Question: How can a crash create inconsistency in a multi-block operation?
Suppose creating a file requires allocating a data block, updating the inode, updating the bitmap, and linking a directory entry. A crash after some but not all updates may leave allocated blocks with no directory name, a directory entry pointing to an uninitialized inode, or a bitmap that disagrees with actual ownership.
:::

## 27. Threats to Reliability
There are two major threats.

First, an interrupted operation can leave stored data inconsistent. The classic example is transferring funds from one bank account to another. If withdrawal happens before deposit and the system crashes between them, money disappears. File-system updates have the same shape: several related changes must either all happen or none happen.

Second, stored data can be lost if non-volatile storage media fail. Previously stored data may disappear or become corrupted.

:::remark Question: What does the bank-transfer example teach about file-system updates?
It teaches atomicity. A multi-step update should not expose a half-finished state. For a bank transfer, withdrawal and deposit must commit together. For a file system, allocating a block, updating metadata, and linking the file into the directory must be treated as one logical operation.
:::

## 28. Two Reliability Approaches
There are two broad approaches.

| Approach | Examples | Main idea | Recovery behavior |
|---|---|---|---|
| Careful ordering and recovery | FAT and FFS with `fsck` | Each step builds structure in an order such as data block, inode, free map, directory. The last step links the new structure into the rest of the file system. | Recovery scans the structure looking for incomplete actions. |
| Versioning and copy-on-write | ZFS and similar designs | Create a new version that links back to unchanged parts of the old structure. The last step declares the new version ready. | Recovery chooses the last complete version and ignores incomplete new versions. |

Careful ordering tries to ensure that partial operations produce loose fragments rather than lost or corrupted data. Copy-on-write provides richer functionality, including versions, and simpler recovery because the old version remains intact until the new version is committed.

:::remark Question: Why does copy-on-write simplify recovery?
Copy-on-write does not overwrite the old structure in place. It writes new blocks and links them to unchanged old blocks. If a crash happens before the final commit pointer is updated, the old version is still valid. If the final pointer is updated, the new version is valid.
:::

## 29. File-System Summary
The major ideas connect memory management, file systems, and sharing:

- `mmap()` maps a file or anonymous segment into memory.
- The buffer cache stores kernel resources, including disk blocks and name translations.
- Dirty buffer-cache blocks contain modifications that are not yet on disk.
- File-system operations involve multiple distinct updates to blocks on disk.
- Those updates need all-or-nothing semantics because crashes can occur in the middle of a sequence.
- Traditional file systems combine careful ordering with recovery on boot.
- Copy-on-write provides versions and simpler recovery, often with little performance impact because sequential writes to modern storage are relatively cheap.

## Exam Review
You should be able to answer the following without looking back:

1. **Memory-mapped files turn file access into virtual-memory access.** A page fault on a file-backed region loads file contents into memory and updates the page table.
2. **`mmap(0, 10000, PROT_READ|PROT_WRITE, MAP_FILE|MAP_SHARED, fd, 0)` asks the OS to choose an address, maps 10,000 bytes, allows reads and writes, and shares changes through the file.**
3. **The buffer cache stores kernel resources such as disk blocks, inodes, directory blocks, free maps, and name translations.**
4. **During `open()`, directory blocks and inodes are read and cached; during `read()`, the inode index finds data blocks; during `write()`, data and metadata can become dirty.**
5. **Dirty blocks are modified in memory but not yet on disk.** Evicting them requires writeback and a transient state.
6. **LRU works reasonably for buffer cache but fails on one-time sequential scans.** "Use Once" policies can discard streaming blocks quickly.
7. **Read-ahead prefetching helps sequential access but can hurt other applications if it fetches too much.**
8. **Delayed writes improve performance and layout, but create a crash window.**
9. **Availability is the ability to accept and process requests; durability is data survival despite faults; reliability means the system performs required functions correctly over time.**
10. **Replication only helps when failures are independent.**
11. **RAID 1 mirrors data, RAID 5 uses XOR parity to survive one disk failure, and RAID 6 or Reed-Solomon erasure coding tolerates more failures.**
12. **Geographic replication improves durability and read availability, but write availability and consistency become harder.**
13. **RAID is not enough for file-system reliability because it can preserve inconsistent state.**
14. **The central reliability question is: How do we guarantee consistency regardless of when crash occurs?**
15. **Careful ordering plus recovery and copy-on-write are two major ways to achieve transaction-like all-or-nothing file-system updates.**
