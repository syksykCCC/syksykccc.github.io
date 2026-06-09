# Lec20 - File System 1: I/O Performance and File System Design

## Learning Objectives
After this lecture, you should be able to reason about I/O performance using latency, throughput, utilization, burstiness, and queueing delay. You should also be able to explain the main disk-scheduling policies, describe how a file system transforms a block device into files and directories, and trace the path from a user-visible pathname to an inode and data blocks.

## 1. From Raw I/O to Performance
I/O devices are controlled through buses, controllers, interrupts or polling, blocking or asynchronous timing interfaces, and storage-specific mechanisms such as disk seeks or SSD flash translation. File systems sit above these raw mechanisms, but they cannot ignore them. The same file API may hide hardware details from applications, while the file-system design must still optimize for the underlying device's latency, bandwidth, reliability, and access patterns.

The starting performance model is:

![I/O performance pipeline](./lec20_materials/io_performance_pipeline.png)

An I/O request often passes through a user thread, OS software paths, a queue, a hardware controller, and the I/O device. The total response time is therefore affected by:
- software overhead in the OS path, which can be loosely modeled as queueing;
- controller overhead;
- device service time, such as disk seek, rotation, transfer, or SSD controller work.

The response-time curve rises sharply as throughput approaches the device's total bandwidth. This is the core warning: high utilization is not automatically good if it creates large queueing delays.

:::remark Question: Why can high utilization be dangerous for I/O?
A device can be busy almost all the time while requests wait for a long time in front of it. As utilization approaches 100%, even small bursts have little spare service capacity to drain the queue, so latency can grow dramatically or even become unbounded in the idealized model.
:::

## 2. Basic Performance Concepts
Two definitions anchor the rest of the lecture:

- **Response Time or Latency: Time to perform an operation**.
- **Bandwidth or Throughput: Rate at which operations are performed**.

Throughput can be measured in different units depending on the system:
- operations: `op/s`;
- files or storage: `MB/s`;
- networks: `Mb/s`;
- arithmetic: `GFLOP/s`.

Latency and throughput are related but not identical. A system may have high aggregate throughput but still give individual requests high latency if those requests sit in a queue.

## 3. Deterministic Queues, Saturation, and Bursts
Start with a simple deterministic world. Requests arrive at regular intervals, each request takes a fixed service time, and there is plenty of time between arrivals.

![Deterministic queue model](./lec20_materials/deterministic_queue_model.png)

The variables are:
- `T_A`: interarrival time;
- `T_S`: service time;
- `T_Q`: queueing delay;
- `lambda = 1/T_A`: arrival rate, in operations per second;
- `mu = 1/T_S`: service rate, in operations per second;
- `U = lambda / mu = T_S / T_A`, where `lambda < mu`: utilization.

In this deterministic setting, if arrivals are spaced far enough apart, the queue has time to empty between requests.

The ideal throughput picture looks linear only until saturation:

![Ideal linear queue](./lec20_materials/ideal_linear_queue.png)

Offered load increases from 0 toward 1. Delivered throughput increases linearly until the server saturates. After saturation, delivered throughput cannot exceed service capacity, and the queue is no longer able to stay empty.

:::remark Question: What does the queue wait time look like?
In the ideal linear picture, queue wait time stays small while the server has spare capacity, then grows without bound as offered load approaches saturation. The important lesson is not that real systems literally become infinite, but that queueing delay becomes the dominant cost near full utilization.
:::

Real arrivals are often bursty rather than evenly spaced.

![Bursty queue model](./lec20_materials/bursty_queue_model.png)

A bursty workload can have the same average arrival rate as a smooth workload, but many requests arrive close together. Those requests must queue until the server drains them. As a result, almost all requests in the burst can experience large queueing delays even when the average utilization is low.

:::remark Question: Why can a low-average-utilization device still have high latency?
Average utilization hides time structure. If ten requests arrive together and then nothing arrives for a while, the average rate may be low, but the later requests in the burst still wait for the earlier ones to finish. Queueing delay depends on arrival pattern, not only average rate.
:::

## 4. Modeling Burstiness with Random Distributions
One elegant mathematical starting point is the **exponential distribution**:

$$
f(x) = \lambda e^{-\lambda x}
$$

For a continuous random variable with mean interarrival interval `1/lambda`, the exponential distribution is **memoryless**. The likelihood of an event occurring is independent of how long we have already been waiting.

![Exponential arrivals](./lec20_materials/exponential_arrivals.png)

This distribution produces many short arrival intervals, which correspond to high instantaneous arrival rates, and a few long gaps, which correspond to low instantaneous rates. That mixture is a simple model for burstiness.

To describe a random service-time distribution, use:

$$
m = \sum p(T) \times T
$$

$$
\sigma^2 = \sum p(T)(T - m)^2 = \sum p(T)T^2 - m^2
$$

$$
C = \frac{\sigma^2}{m^2}
$$

Here `m` is the mean service time, `sigma^2` is the variance, and `C` is the **squared coefficient of variance**.

![Distribution variance](./lec20_materials/random_distribution_variance.png)

Important values of `C` are:
- deterministic service time has no variance, so `C = 0`;
- memoryless or exponential service time has `C = 1`;
- disk response times are around `C ~= 1.5`, because many seeks are shorter than the average while some are long.

## 5. Queueing Theory Results
Queueing theory applies to long-term, steady-state behavior where the arrival rate equals the departure rate. Arrivals and departures are characterized by probability distributions.

The basic one-server model has a queue followed by a server:

![Queueing theory results](./lec20_materials/queuing_theory_results.png)

The system parameters are:
- `lambda`: mean number of arriving customers per second, also `lambda = 1/T_A`;
- `T_ser`: mean time to service a customer;
- `C`: squared coefficient of variance, `sigma^2/m^2`;
- `mu`: service rate, `mu = 1/T_ser`;
- `u`: server utilization, where `0 <= u <= 1`, and `u = lambda / mu = lambda * T_ser`.

The quantities we want to compute are:
- `T_q`: time spent in the queue;
- `L_q`: average length of the queue.

By Little's law:

$$
L_q = \lambda T_q
$$

For one server with a Poisson arrival process:

| Queue model | Service-time assumption | Queueing delay |
|---|---|---|
| **M/M/1 queue** | memoryless service time, `C = 1` | $T_q = T_{ser} \times \frac{u}{1-u}$ |
| **M/G/1 queue** | general service-time distribution | $T_q = T_{ser} \times \frac{1}{2}(1+C) \times \frac{u}{1-u}$ |

The factor `u/(1-u)` is the danger zone. When utilization `u` approaches 1, the denominator approaches 0, and queueing delay grows toward infinity in this simplified model.

:::remark Question: What about queueing time?
Queueing time is not an incidental detail; it is often the dominant term in response time. Queueing theory gives a way to estimate it from arrival rate, service time, utilization, and service-time variability. The model is simplified, but it captures the central fact that burstiness and high utilization amplify latency.
:::

## 6. Queueing Theory Example
Consider a disk workload with these usage statistics:
- the user requests `10 x 8KB` disk I/Os per second;
- requests and service times are exponentially distributed, so `C = 1.0`;
- average service time is `20 ms`, including controller time, seek, rotation, and transfer.

![Queueing theory example](./lec20_materials/queuing_theory_example.png)

The questions are:
- How utilized is the disk, meaning what is the server utilization?
- What is the average time spent in the queue?
- What is the number of requests in the queue?
- What is the average response time for a disk request?

The arrival rate and service time are:

$$
\lambda = 10/s
$$

$$
T_{ser} = 20\text{ ms} = 0.02\text{ s}
$$

The utilization is:

$$
u = \lambda T_{ser} = 10/s \times 0.02s = 0.2
$$

Because `C = 1`, use the M/M/1 result:

$$
T_q = T_{ser} \times \frac{u}{1-u}
$$

Substitute values:

$$
T_q = 20\text{ ms} \times \frac{0.2}{1-0.2}
     = 20\text{ ms} \times 0.25
     = 5\text{ ms}
$$

By Little's law:

$$
L_q = \lambda T_q = 10/s \times 0.005s = 0.05
$$

Average response time is service time plus queueing time:

$$
T_{sys} = T_q + T_{ser} = 5\text{ ms} + 20\text{ ms} = 25\text{ ms}
$$

:::remark Question: Why is the queue length only 0.05 if requests can still queue?
`L_q = 0.05` is a long-term average, not a statement that there is always a fractional request in the queue. Most of the time the queue may be empty; occasionally one or more requests wait. Averaging over time gives 0.05 waiting requests.
:::

## 7. Optimizing I/O Performance
The basic question is: how can I/O performance be improved?

![I/O performance optimization](./lec20_materials/io_performance_optimization.png)

The main approaches are:
- **Speed**: make components faster.
- **Parallelism**: use more decoupled systems, such as multiple independent buses or controllers.
- **Overlap**: do other useful work while waiting for I/O.
- **Optimize the bottleneck**: increase the service rate of the limiting component.
- **Use queues intentionally**: queues can absorb bursts and smooth the flow, and they can be used to reorder or batch work.
- **Admission control with finite queues**: limiting queue length can limit delay, but it may introduce unfairness or livelock if poorly designed.

Disk performance is highest when there are big sequential reads, or when there is enough queued work that requests can be piggybacked through reordering and batching. It is often acceptable to be inefficient when the device is mostly idle, because there is little competition and latency stays low.

Bursts are both a threat and an opportunity:
- threat: bursts can increase latency;
- opportunity: bursts create enough work to enable piggybacking, request reordering, and batching, such as one context switch handling multiple requests.

Other techniques include reducing overhead through user-level drivers, such as avoiding context switches, and reducing the impact of I/O delays by doing other useful work in the meantime.

:::remark Question: Why can queues both hurt and help performance?
Queues hurt because waiting increases latency. They help because once several requests are visible at the same time, the system can choose a better order, batch work, or exploit parallelism. A queue with no policy is just delay; a queue with a good policy can turn burstiness into scheduling information.
:::

## 8. Disk Scheduling
A disk can do only one request at a time. The scheduling question is: **What order do you choose to do queued requests?**

The example request queue contains requests written as `(cylinder, sector)`:

```text
(2,2), (5,2), (7,2), (3,10), (2,1), (2,3)
```

The disk head is near cylinder 2, and the scheduler must decide which request to serve next.

![Disk scheduling: FIFO and SSTF](./lec20_materials/disk_scheduling_fifo_sstf.png)

### 8.1 FIFO and SSTF
**FIFO Order** serves requests in arrival order. It is fair among requesters, but the arrival order may jump to random places on the disk, causing very long seeks.

**SSTF: Shortest Seek Time First** chooses the request closest on the disk. It is good at reducing seeks, but it can lead to starvation if requests near the current head position keep arriving. Also, modern scheduling cannot consider only seek distance; rotational delay may be as large as seek time, so it should be included in the cost calculation.

### 8.2 SCAN
**SCAN** implements an elevator algorithm: take the closest request in the current direction of travel.

![Disk scheduling: SCAN](./lec20_materials/disk_scheduling_scan.png)

SCAN has no starvation in the same way SSTF can starve far-away requests, but it keeps some of SSTF's locality benefit by serving nearby requests along the sweep.

### 8.3 C-SCAN
**C-SCAN: Circular-Scan** moves in only one direction.

![Disk scheduling: C-SCAN](./lec20_materials/disk_scheduling_cscan.png)

C-SCAN skips requests on the way back. It is fairer than SCAN because it is less biased toward requests near the middle of the disk; each region waits for the next pass in the same direction.

:::remark Question: Which disk scheduling policy should be used?
There is no universally best policy. FIFO is simple and fair by arrival order but may waste seek time. SSTF improves locality but can starve distant requests. SCAN and C-SCAN trade a little local optimality for more predictable progress and fairness. The best policy depends on whether the system prioritizes fairness, latency, throughput, or implementation simplicity.
:::

## 9. Network I/O Has the Same Performance Shape
Network I/O moves packets rather than disk blocks, but the same principles apply: latency, throughput, queues, batching, overhead, and offload still matter.

Network I/O is especially important in modern cloud systems:
- applications and systems are networked and distributed;
- storage is often accessed through network I/O;
- a common modern design is to organize storage devices as a storage pool and access that pool from compute nodes through the datacenter network.

Approaches to improving network I/O include:
- better abstractions for distributed applications, such as coflow;
- optimizing the TCP/IP stack in the kernel;
- kernel bypass through a user-space network stack;
- offloading work to the NIC, such as RDMA, SmartNICs, and DPUs.

## 10. From Storage to File Systems
The I/O stack can be viewed as layers:

![I/O and storage layers](./lec20_materials/io_storage_layers.png)

At the top are application services, streams, file descriptors, syscalls such as `open()`, `read()`, `write()`, and `close()`, and open file descriptions. At the bottom are I/O drivers, commands and data transfers, disks, flash, controllers, and DMA. The file system is the layer in between: it manages files, directories, and indexes.

The transition from storage to file systems changes the unit of thinking:

![From storage to file systems](./lec20_materials/storage_to_file_systems.png)

The user and syscall layer deal with an I/O API and variable-size buffers at memory addresses. The file system translates those requests into logical blocks, typically around 4 KB. Hardware devices then translate those blocks differently:
- HDDs access sector(s) using a physical index, often 512 B or 4 KB.
- SSDs use a Flash Translation Layer, physical blocks, and erasure pages; the OS-level block is not the same as the internal erase unit.

The key definition is: **File System: Layer of OS that transforms block interface of disks (or other block devices) into Files, Directories, etc.**

A classic OS design takes a limited hardware interface, essentially an array of blocks, and provides a more convenient interface with:
- **Naming**: find a file by name, not by block number.
- **Organization**: place file names in directories and map files to blocks.
- **Protection**: enforce access restrictions.
- **Reliability**: keep files intact despite crashes, hardware failures, and other problems.

## 11. User View vs. System View of a File
From the user's perspective, a file is a durable data structure. It stores data across program runs and power cycles.

From the system-call interface perspective, a file is a **collection of bytes**, especially in UNIX. The OS does not care what kind of data structure the application wants to store on disk.

Inside the OS, a file is a **collection of blocks**. A block is a logical transfer unit, while a sector is a physical transfer unit. The block size is at least the sector size; in UNIX, a common block size is 4 KB.

### 11.1 Translating Byte Requests to Blocks
The question is: what happens if the user says, **\"give me bytes 2-12\"**?

![Translation from user to system view](./lec20_materials/user_to_system_block_translation.png)

The file system fetches the block corresponding to those bytes and returns only the correct portion of that block.

The related question is: what about writing bytes 2-12? The file system fetches the block, modifies the relevant portion, and writes out the whole block.

:::remark Question: Why must a small byte-range write read and rewrite a whole block?
Actual disk I/O happens in blocks. If the user writes only bytes 2-12, the file system cannot overwrite just those bytes on disk without preserving the rest of the block. It therefore reads the old block, changes the requested byte range in memory, and writes the modified block back.
:::

## 12. Disk Management and On-Disk Metadata
The basic entities on a disk are:
- **File**: a user-visible group of blocks arranged sequentially in logical space.
- **Directory**: a user-visible index mapping names to files.

The disk is accessed as a linear array of sectors. There are two ways to identify a sector:
- **Physical position**: a sector is described as `[cylinder, surface, sector]`. This is no longer the normal interface, and it forces the OS or BIOS to deal with bad sectors and physical disk geometry.
- **Logical Block Addressing (LBA)**: every sector has an integer address. The controller translates from logical address to physical position and shields the OS from the disk's internal structure.

The file system needs to track:
- which blocks contain data for which files, so it knows where to read a file from;
- which files are in a directory, so it can find a file's blocks given its name;
- which disk blocks are free, so it knows where to put newly written data.

All of this metadata must be maintained **somewhere on disk**.

On-disk data structures differ from in-memory data structures:
- The disk is accessed one block at a time, so reading or writing a single word is inefficient.
- Updating a small field usually means reading and writing the full block that contains it.
- Sequential access patterns are preferred.
- Durability matters: ideally, the file system is in a meaningful state after shutdown, but crashes can interrupt updates.

## 13. Critical Factors in File System Design
Several design factors dominate file-system behavior:
- **(Hard) Disk Performance**: maximize sequential access and minimize seeks.
- **Open before Read/Write**: opening a file allows the system to perform protection checks and locate the actual file resources in advance.
- **Size is determined as files are used**: files can start small and grow, so the file system must make room as writes expand a file.
- **Organized into directories**: the file system needs an on-disk data structure for names and directories.
- **Careful block allocation and freeing**: allocation decisions should keep access efficient and maintain a correct free-space map.

:::remark Question: Why does `open()` exist instead of doing all work inside each `read()` or `write()`?
`open()` lets the OS resolve the pathname, check permissions, find the file's metadata, create an open file description, and remember state such as the current file offset. Then later `read()` and `write()` calls can use a file descriptor and avoid repeating full name resolution each time.
:::

## 14. Components of a File System
A file system has four central components:
- **directory**;
- **index structure**;
- **storage blocks**;
- **free space map**.

![File system components](./lec20_materials/file_system_components.png)

The flow is:
1. A user provides a file path.
2. The directory structure maps the path to a **file number**, also called an **inumber**.
3. The file number locates a file header structure, commonly called an **inode**.
4. The inode or index structure locates the file's data blocks.

One file-system block may contain multiple sectors. For example, if a sector is 512 B and a block is 4 KB, then one block contains eight sectors.

The relationship between open files and file numbers matters:

![Open file description remembers inumber](./lec20_materials/open_file_description_inumber.png)

If a process executes `open("foo.txt")` and receives file descriptor `3`, then `read(3, buf, 100)` reads from the open file description associated with descriptor `3`. The open file description is better described as remembering the **inumber (file number)** of the file, not its name. It may also remember the current position, which becomes `100` after a successful 100-byte read.

![Name resolution components](./lec20_materials/name_resolution_components.png)

**Open performs Name Resolution**: it translates a path name into a file number. **Read and Write operate on the file number**: they use the file number as an index to locate the blocks.

:::remark Question: Why remember the file number rather than the file name after opening?
The file number is the stable internal identifier used to locate file metadata and blocks. A name is only a directory entry; names can be changed, linked, or removed. Once a file is open, the kernel should continue referring to the underlying file object rather than repeatedly depending on the textual path.
:::

## 15. Directories and Name Resolution
Directories are specialized files. Their contents are a list of pairs:

```text
<file name, file number>
```

System calls that access directories include:
- `open`, `creat`, and `readdir`, which traverse the structure;
- `mkdir` and `rmdir`, which add or remove directory entries;
- `link` and `unlink`, which add or remove name-to-file relationships.

A directory is a file containing `<file_name : file_number>` mappings. The file number may refer to an ordinary file or to another directory. Each mapping is called a **directory entry**. The OS stores the mapping in a format it interprets.

Processes are not allowed to read raw directory bytes with ordinary `read()`. Instead, `readdir()` iterates over the map without revealing the raw bytes.

:::remark Question: Why should the OS not let processes read or write raw directory bytes?
Directories are file-system metadata. If a process could freely overwrite raw directory bytes, it could create malformed entries, break name resolution, bypass protection, leak deleted names, or corrupt the file system. `readdir()` exposes the logical directory entries while preserving the OS's control over the on-disk format and consistency rules.
:::

### 15.1 Resolving `/my/book/count`
The question is: how many disk accesses are needed to resolve `/my/book/count`?

![Directory structure resolution](./lec20_materials/directory_structure_resolution.png)

Ignoring caching, the sequence is:
1. Read the file header for root, which is at a fixed position on disk.
2. Read the first data block for root, which contains a table of file-name/index pairs, and search for `my`.
3. Read the file header for `my`.
4. Read the first data block for `my`, and search for `book`.
5. Read the file header for `book`.
6. Read the first data block for `book`, and search for `count`.
7. Read the file header for `count`.

So this path resolution takes seven disk accesses in the simplified no-cache picture. Directories are usually small, so linear search may be acceptable for simple directories.

The **current working directory** is a per-address-space pointer to a directory used for resolving file names. It lets a user specify relative filenames instead of absolute paths. For example, if `CWD = "/my/book"`, then the relative name `"count"` can resolve to `/my/book/count`.

## 16. In-Memory File System Structures
The file system also keeps in-memory structures to avoid repeating expensive disk lookups.

![In-memory file system structures](./lec20_materials/in_memory_file_structures.png)

The open path is:
1. `open()` finds the inode on disk from a pathname by traversing directories.
2. The OS creates or finds an in-memory inode in the system-wide open-file structures.
3. The per-process file descriptor table maps a small integer file descriptor to an open-file entry.
4. `read(fd)` and `write(fd)` use the file handle to find the in-memory inode and then locate the data blocks.

There should be one in-memory inode entry for a file no matter how many instances of the file are open. This avoids duplicating metadata and gives the kernel a shared place to coordinate information about the same underlying file.

:::remark Question: What is the difference between a file descriptor and an inode?
A file descriptor is a per-process small integer handle, such as `3`. An inode is the file-system metadata object that identifies the underlying file and points to its data blocks. The descriptor is how a process names an open file; the inode is how the file system locates and manages the actual file.
:::

## 17. Characteristics of Files
A study published in FAST 2007, **A Five-Year Study of File-System Metadata**, examined annual snapshots of file-system metadata from over 60,000 Windows PC file systems in a large corporation.

![File metadata study](./lec20_materials/file_metadata_study.png)

Two observations matter for file-system design.

### 17.1 Observation 1: Most Files Are Small
The file-count histogram shows that the number of files is concentrated in small size ranges. The peak is around small KB-scale files, with many files in bins such as a few KB to tens of KB, and relatively few very large files.

![Most files are small](./lec20_materials/most_files_are_small.png)

This means file systems must make small-file operations efficient. Metadata lookup, directory traversal, inode access, and small block allocation are not rare corner cases; they are common operations.

### 17.2 Observation 2: Most Bytes Are in Large Files
The byte-weighted histogram tells a different story. Although there are fewer large files, most used space is contained in large files, with large peaks in MB-scale and GB-scale file-size ranges.

![Most bytes are in large files](./lec20_materials/most_bytes_large_files.png)

This means file systems must also optimize large-file throughput. Efficient sequential allocation, extent-like layouts, readahead, write batching, and low fragmentation matter because large files dominate storage capacity and bulk transfer.

:::remark Question: How can both observations be true at the same time?
File count and byte count measure different things. A directory tree can contain millions of tiny configuration, metadata, or source files, so most files are small. But a few videos, virtual-machine images, databases, archives, or datasets can consume most bytes. Good file systems must therefore optimize both small-file metadata operations and large-file streaming.
:::

## 18. Summary: What a File System Optimizes
File systems are designed to optimize performance and reliability relative to the performance characteristics of the underlying device. Bursts and high utilization introduce queueing delays, so the storage stack must manage queues carefully.

For queueing latency, M/M/1 and M/G/1 are the simplest models to analyze:

$$
T_q = T_{ser} \times \frac{1}{2}(1+C) \times \frac{u}{1-u}
$$

As utilization approaches 100%, latency grows toward infinity in the simplified model.

A file system:
- transforms blocks into files and directories;
- optimizes for access and usage patterns;
- maximizes sequential access while allowing efficient random access;
- represents files and directories through file headers called **inodes**;
- performs naming by translating user-visible names to actual system resources;
- stores directory structures as linked or tree-like structures inside files.

## Exam Review
**Response Time or Latency** is the time to perform an operation. **Bandwidth or Throughput** is the rate at which operations are performed. I/O response time includes software path cost, queueing delay, controller time, and device service time.

Utilization is:

$$
u = \lambda / \mu = \lambda T_{ser}
$$

where `lambda` is arrival rate, `mu = 1/T_ser` is service rate, and `T_ser` is average service time.

The squared coefficient of variance is:

$$
C = \sigma^2 / m^2
$$

Deterministic service has `C = 0`, exponential or memoryless service has `C = 1`, and disk response times are around `C ~= 1.5`.

For M/M/1:

$$
T_q = T_{ser} \times \frac{u}{1-u}
$$

For M/G/1:

$$
T_q = T_{ser} \times \frac{1}{2}(1+C) \times \frac{u}{1-u}
$$

By Little's law:

$$
L_q = \lambda T_q
$$

In the disk example, `lambda = 10/s`, `T_ser = 20 ms`, and `u = 0.2`. The queueing time is `5 ms`, queue length is `0.05`, and response time is `25 ms`.

I/O performance can be improved by making components faster, adding parallelism, overlapping I/O with useful work, optimizing bottlenecks, batching or reordering queued requests, and controlling admission when queues would otherwise grow too long.

Disk scheduling policies trade fairness and locality. FIFO is fair by arrival order but may cause long seeks. SSTF reduces seek distance but can starve distant requests. SCAN sweeps like an elevator and avoids starvation. C-SCAN moves in one direction and is fairer across disk regions.

**File System** is **a layer of OS that transforms the block interface of disks or other block devices into files, directories, and related abstractions**. It provides naming, organization, protection, and reliability.

The user sees a file as durable data; the syscall interface sees a byte stream; the OS internally manages blocks. Small byte-range reads and writes must be translated to block operations, often requiring read-modify-write for partial-block writes.

The core file-system components are directory, index structure, storage blocks, and free space map. `open()` performs name resolution from pathname to file number; `read()` and `write()` operate on the file number or in-memory inode through a file descriptor.

Directories are specialized files containing `<file name, file number>` entries. Resolving `/my/book/count` without caching reads root metadata and data, then `my` metadata and data, then `book` metadata and data, then `count` metadata: seven disk accesses in the simplified model.

Most files are small, but most bytes are in large files. A good file system must handle small-file metadata operations efficiently while also preserving high throughput and locality for large files.
