# Lec24 - File System 5: Storage and File Systems in Modern Computer Systems

## Learning Objectives
After this note, you should be able to explain five modern storage and file-system papers as complete design stories rather than isolated techniques. The key skill is to identify the workload pressure, the central abstraction, the mechanism that makes the abstraction work, and the one idea each paper is most worth remembering.

The five papers are:

| Topic | Paper | Core system idea |
|---|---|---|
| I/O devices and backup storage | FAST'08 Dedup | Remove repeated data globally and make deduplication fast enough for large backup streams. |
| End-to-end I/O management | SOSP'13 IOFlow | Add a software-defined storage control plane for end-to-end storage SLAs. |
| Modern distributed file systems | SOSP'03 GFS | Build a file system around large files, appends, frequent failures, and high throughput. |
| RAID and erasure coding | OSDI'16 EC-Cache | Use erasure coding inside a cluster cache to balance load and reduce latency. |
| File systems for distributed applications | SIGCOMM'01 Chord | Use consistent hashing and finger tables for scalable peer-to-peer lookup. |

:::remark Question: What is the right way to read a paper-focused systems lecture?
Read each paper as an answer to one pressure point. Dedup answers storage cost and disk bottlenecks in backup systems. IOFlow answers lack of end-to-end control in virtualized storage stacks. GFS answers large-scale file storage under constant failures. EC-Cache answers memory-cache imbalance and tail latency. Chord answers decentralized object lookup without a central directory. The mechanism matters, but the design pressure explains why that mechanism is shaped the way it is.
:::

## 1. FAST'08 Dedup: Avoiding the Disk Bottleneck in Backup Storage
**Most Important Core: Deduplication is not just compression. It is global, cross-file redundancy elimination, and the hard systems problem is making global duplicate lookup fast without keeping an enormous index in RAM.**

The key definition is:

**Deduplication is global compression that removes the redundant segments globally (across many files).**

Local compression tools such as `gzip` and `winzip` encode redundant strings in a small window inside one file. Deduplication uses a much larger logical window across many files or many backup versions. That is why local compression may reach about `2-3x`, while deduplication can reach about `10-50x` on highly redundant backup workloads.

![Deduplication versus local compression](./lec24_materials/dedup_local_vs_global_compression.png)

The reason backup data is so dedup-friendly is that full and incremental backups repeatedly contain the same file segments. In the illustrated backup stream, segments such as `A`, `B`, `C`, `D`, `E`, `F`, `G`, and `H` appear across the first full backup, incremental backups, and a later full backup. Deduplicated storage keeps the unique variable segments, compresses those unique segments, and represents repeated segments by references rather than storing their bytes again.

![Backup data example for deduplication](./lec24_materials/dedup_backup_example.png)

### 1.1 Fingerprinting and the Index Bottleneck
The basic deduplication pipeline is:

1. Divide data streams into variable or fixed-size segments.
2. Compute a fingerprint for each segment.
3. Look up the fingerprint in an index.
4. If the fingerprint already exists, treat the segment as a duplicate and store only a reference.
5. If the fingerprint is new, pack the segment into a container, optionally apply local compression, and write it to disk.

![Deduplication fingerprinting process](./lec24_materials/dedup_fingerprinting_index_process.png)

The simple design creates a huge index. For `80 TB` of data with `8 KB` segments and `20 B` fingerprints, the index is:

$$
\frac{80\text{ TB}}{8\text{ KB}} \times 20\text{ B} \approx 200\text{ GB}.
$$

A `200 GB` fingerprint index is too large to keep cheaply in memory, and disk lookups for every segment would turn deduplication into a disk bottleneck.

:::remark Question: Why is the fingerprint index the central bottleneck?
Deduplication must answer a global question for every incoming segment: have these bytes appeared anywhere before? That question becomes an index lookup. If each lookup touches disk randomly, the system is limited by disk seek and I/O latency rather than backup-stream bandwidth. The paper's techniques are mostly about avoiding unnecessary random index reads and making the remaining reads locality-friendly.
:::

### 1.2 Three Techniques for High-Speed Deduplication
The system combines three techniques.

| Technique | Goal | Mechanism | What to remember |
|---|---|---|---|
| Summary vector | Use minimal RAM to test for new data. | Keep a Bloom-filter-like summary of stored segment fingerprints in RAM. | If the summary says **no**, the segment is definitely new, so the system avoids a disk-index lookup. |
| Stream-informed segment layout | Capture duplicate locality on disk. | Store segments from the same stream in the same containers; store metadata in those containers too. | Future duplicates are likely near each other because backup streams have structure. |
| Locality Preserved Caching (LPC) | Maintain duplicate locality in cache. | Cache `<fingerprint, containerID>` pairs; on a miss, use the disk index to find the container and load that container's metadata. | Cache replacement operates at the container-metadata level rather than isolated fingerprints. |

![Deduplication summary vector and LPC pipeline](./lec24_materials/dedup_summary_vector_lpc_pipeline.png)

The complete pipeline is:

1. A fingerprint first checks the index cache.
2. If it hits, the segment is a duplicate.
3. If it misses, the summary vector is checked.
4. If the summary vector says `No`, the segment is new.
5. If the summary vector says `Maybe`, the disk index is consulted.
6. Disk-index lookup identifies a container, whose metadata is loaded into the cache.
7. Replacement evicts older cached metadata when needed.

:::remark Question: Why is a Bloom-filter-style summary vector useful even if it can say "maybe" incorrectly?
The useful property is that a negative answer is reliable: if the summary vector says the segment has not been stored, the system can skip the expensive disk index lookup. A false positive only causes extra work by sending a new segment down the slower "maybe" path. That is acceptable because it preserves correctness while reducing many disk accesses.
:::

### 1.3 Real-World Compression Results
Real datacenter traces show that deduplication can create a large gap between logical capacity and physical capacity. In the Datacenter B example, logical data grows to many terabytes while physical capacity grows much more slowly, and the cumulative compression ratio rises over time.

![Real-world deduplication compression at Datacenter B](./lec24_materials/dedup_real_world_compression_datacenter_b.png)

The final lesson is that deduplication became a de facto standard for highly redundant backup data because it reduces cost, power, space, and often improves effective performance. The engineering challenge is not recognizing redundancy; it is recognizing redundancy fast enough.

## 2. SOSP'13 IOFlow: Software-Defined Storage Control
**Most Important Core: IOFlow brings the SDN separation of control plane and data plane into storage, so end-to-end storage SLAs can be expressed once and enforced across the deep I/O path.**

Enterprise datacenters run general-purpose applications across many VMs. Storage is virtualized, resources are shared, and I/O travels through many independently configured layers: application, guest OS, file system, malware scanner, hypervisor, I/O manager, drivers, network, storage server, file system, deduplication, caching, scheduling, and device drivers.

The desired properties are predictable application behavior and performance. A system should support end-to-end SLAs such as:

- guaranteed storage bandwidth `B`;
- guaranteed high IOPS and priority;
- per-application control over decisions along the I/O path.

The problem is that such SLAs are hard to provide when every layer acts independently.

### 2.1 IOFlow Architecture
IOFlow **decouples the data plane (enforcement) from the control plane (policy logic)**.

![IOFlow architecture](./lec24_materials/ioflow_architecture_control_data_plane.png)

The data plane contains programmable queues placed along the client-side and server-side storage stack. The control plane contains a centralized controller that installs rules through the IOFlow API.

The main contributions are:

- a defined and built storage control plane;
- controllable queues in the data plane;
- an interface between control and data plane, called the IOFlow API;
- centralized control applications that demonstrate the power of the architecture.

### 2.2 Storage Flows and the IOFlow API
A key abstraction is the storage flow:

**Storage "Flow" refers to all IO requests to which an SLA applies.**

A flow is specified as:

$$
\langle \{VMs\}, \{File\ Operations\}, \{Files\}, \{Shares\} \rangle \rightarrow SLA.
$$

Examples include:

- `<{VM 1-100}, write, *, \\share\db-log> -> high priority`;
- `<{VM 1-100}, *, *, \\share\db-data> -> min 100,000 IOPS`;
- `<VM 1, *, *, \\share\dataset> -> bypass malware scanner`.

The IOFlow API programs data-plane queues through three functions:

1. **Classification**: `[IO Header -> Queue]`.
2. **Queue servicing**: `[Queue -> <token rate, priority, queue size>]`.
3. **Routing**: `[Queue -> Next-hop]`.

The difficulty is that storage traffic often lacks a common I/O header across layers. A VM might identify a file as `\\share\dataset`, while a lower layer sees only a VHD such as `\\serverX\AB79.vhd` or a block device. IOFlow resolves flow names through the controller: a layer such as SMBc exposes the header it understands, and the controller translates the high-level SLA into queueing rules at the right layer.

![IOFlow flow-name resolution](./lec24_materials/ioflow_flow_name_resolution.png)

### 2.3 Rate Limiting Must Be Based on Cost
A simple token bucket over payload bytes is not enough. Two VMs can both issue `8 KB` requests, but `8 KB` reads and `8 KB` writes may consume very different storage resources. Rate limiting by IOPS is also insufficient: a `64 KB` read and an `8 KB` write count as one operation each but may have very different costs.

The right unit is operation cost. IOFlow uses controller-built empirical cost models based on device type and workload characteristics:

- RAM, SSD, and disk have different cost curves;
- read/write ratio matters;
- request size matters;
- large requests can be split for preemption.

![IOFlow cost-based rate limiting](./lec24_materials/ioflow_cost_based_rate_limiting.png)

:::remark Question: Why do payload bytes and IOPS both fail as rate-limiting units?
Payload bytes ignore that different operations with the same byte count may impose different device work. IOPS ignores that operations with the same count may have very different sizes and read/write behavior. Storage congestion control needs a cost model because the scarce resource is not simply bytes or operations; it is device-specific service time and interference.
:::

### 2.4 Controller-Based Max-Min Fair Sharing
For a tenant with an aggregate bandwidth SLA, static partitioning across VMs is suboptimal. If some VMs are idle, active VMs should be able to use the unused budget as long as the aggregate rate stays within the tenant's allocation.

IOFlow uses a centralized controller to implement max-min fair sharing.

![IOFlow controller-based max-min fair sharing](./lec24_materials/ioflow_controller_maxmin_fair_sharing.png)

The controller works in repeated intervals:

1. At the statistics sampling interval `s`, it collects per-VM demand information.
2. At the control interval `t`, it computes max-min allocations within a tenant and across tenants.
3. It sets per-VM token rates.
4. It chooses the best enforcement location, minimizing how often I/O is queued and distributing rate-limiting load.

:::remark Question: How does the controller enforce an aggregate SLA?
It does not simply divide the SLA evenly. It infers each VM's demand, computes fair allocations under the aggregate tenant limit, and programs token rates into the appropriate queues. This gives inter-tenant work conservation when one tenant is idle and intra-tenant work conservation when some VMs inside a tenant are idle.
:::

### 2.5 Evaluation and Lesson
The bandwidth-SLA experiment uses four tenants with different minimum storage bandwidths:

| Tenant | SLA |
|---|---|
| Red | `{VM1-30} -> Min 800 MB/s` |
| Green | `{VM31-60} -> Min 800 MB/s` |
| Yellow | `{VM61-90} -> Min 2500 MB/s` |
| Blue | `{VM91-120} -> Min 1500 MB/s` |

The Red tenant is aggressive and generates more requests per second. The results show that the controller detects Red's behavior, configures `120` queues, enforces the tenants' SLAs, and provides both intra-tenant and inter-tenant work conservation.

![IOFlow bandwidth SLA results](./lec24_materials/ioflow_bandwidth_sla_results.png)

The overheads are reasonable: data-plane overhead is small even at `40 Gbps` RDMA, and control-plane CPU overhead is reported as less than `0.3%` at the controller.

The lesson is that centralized control in software-defined storage simplifies algorithms because the controller can focus on SLA enforcement instead of solving every decision through decentralized congestion signaling.

## 3. SOSP'03 GFS: The Google File System
**Most Important Core: GFS succeeds by rejecting generic file-system assumptions and designing directly for Google's workload: huge files, frequent failures, append-heavy access, and high sustained throughput.**

GFS is motivated by several workload facts:

- Node failures happen frequently.
- Files are huge, often multi-GB.
- Most files are modified by appending at the end.
- Random writes and overwrites are practically nonexistent.
- High sustained bandwidth matters more than low latency.
- Many clients may concurrently append to one file, such as producer-consumer queues or many-way merge jobs.

GFS is not POSIX-compliant, but it supports common file-system operations such as `create`, `delete`, `open`, `close`, `read`, and `write`. It also adds:

- `snapshot`, which creates a low-cost copy of a file or directory tree;
- `record append`, which allows multiple clients to append concurrently to the same file, with at least the first append guaranteed to be atomic.

:::remark Question: Why is it reasonable for GFS not to be POSIX-compliant?
A system can gain major simplifications and performance wins if its target workload does not need full POSIX semantics. GFS prioritizes append-heavy, large-file, throughput-oriented batch workloads. For those workloads, a specialized interface such as record append is more valuable than efficient arbitrary small overwrites.
:::

### 3.1 Architecture: Separate Control Flow and Data Flow
The most important architectural point is:

**Data flow is decoupled from control flow.**

Clients contact the master for metadata operations, but clients read and write file data directly from chunkservers.

![GFS architecture](./lec24_materials/gfs_architecture.png)

In the figure:

- the application uses a GFS client;
- the client asks the GFS master using `(file name, chunk index)`;
- the master replies with `(chunk handle, chunk locations)`;
- the client sends `(chunk handle, byte range)` directly to chunkservers;
- thick arrows represent data messages, while thin arrows represent control messages.

This design keeps the master out of the heavy data path and allows expensive data flow to be scheduled based on network topology.

### 3.2 Master, Operation Log, Chunks, and Chunkservers
The master is responsible for system-wide activities such as chunk leases, storage reclamation, and load balancing. It maintains metadata including namespaces, ACLs, mappings from files to chunks, and current chunk locations. The namespace and file-to-chunk mappings are stored persistently in the operation log.

The operation log is the only persistent record of metadata. It also defines the serialized order of concurrent operations. The master recovers by replaying the log and checkpoints it periodically to reduce startup time.

Files are divided into fixed-size chunks, each with an immutable, globally unique `64-bit` chunk handle. By default, each chunk is replicated three times across chunkservers. Chunkservers store chunks on local disks as Linux files.

![GFS chunks and chunkservers](./lec24_materials/gfs_chunks_and_chunkservers.png)

Per-chunk metadata stored in the master is less than `64 bytes` and includes:

- current replica locations;
- reference count, useful for copy-on-write;
- version number, useful for detecting stale replicas.

### 3.3 Chunk Size: 64 MB
GFS uses `64 MB` chunks, much larger than ordinary file systems. This choice has both costs and benefits.

| Aspect | Effect |
|---|---|
| Disadvantage | Internal fragmentation can waste space. |
| Disadvantage | Small files may consist of only a few chunks, so many clients can concentrate traffic on those chunks. Higher replication can mitigate this. |
| Advantage | Clients interact with the master less often because many reads/writes stay within one chunk. |
| Advantage | Persistent TCP connections to chunkservers reduce network overhead. |
| Advantage | Master metadata becomes small enough to keep entirely in memory. |

:::remark Question: Why is a single master acceptable rather than an obvious bottleneck?
The master has global knowledge, which greatly simplifies placement, leases, and metadata management. It avoids becoming the data bottleneck because clients do not read or write file data through it. The master only tells clients which chunkservers to contact, and later operations on the same chunk can proceed without contacting the master again.
:::

### 3.4 Write Flow and Primary Lease
When a client modifies a chunk, the master grants a chunk lease to one replica. That replica becomes the primary, and the others are secondaries. The primary chooses the serialization order for modifications, and secondaries apply the same order.

![GFS write flow steps 1 to 4](./lec24_materials/gfs_write_flow_steps_1_4.png)

The first part of the flow is:

1. The client asks the master for all chunkservers that hold the chunk, including secondaries.
2. The master grants a new lease, increases the chunk version number, asks all replicas to do the same, and replies to the client.
3. The client pushes data to all replicas; it does not have to push data to the primary first.
4. After data is acknowledged, the client sends the write request to the primary. The primary assigns the serialization order and applies the modification.

![GFS write flow steps 5 to 7](./lec24_materials/gfs_write_flow_steps_5_7.png)

The second part is:

5. The primary forwards the write request and serialization order to secondaries.
6. Secondaries apply the modification in that order and reply to the primary.
7. The primary replies to the client with success or error.

If the primary succeeds but any secondary fails, the replicas are inconsistent, so an error is returned to the client. The client can retry from the data-push step through the final reply step. If a write straddles a chunk boundary, GFS splits it into multiple write operations.

:::remark Question: Why does the client send data to all replicas before asking the primary to order the write?
This separates data movement from control ordering. Large data transfer can be pipelined across replicas without waiting for the primary to serialize the operation. Once all replicas have the bytes, the primary only needs to impose the order and tell replicas how to apply the already-received data.
:::

### 3.5 GFS Legacy
The broader conclusion is the same as IOFlow: decouple the data plane from the control plane.

- Control plane: centralized single master.
- Data plane: distributed chunkservers.

This pattern influenced later systems. In the Google ecosystem, GFS relates to BigTable and MapReduce. In the Hadoop ecosystem, the corresponding systems are HDFS, HBase, Hadoop, and later Spark.

## 4. OSDI'16 EC-Cache: Erasure Coding for Cluster Caching
**Most Important Core: EC-Cache uses erasure coding for read performance and load balancing in an in-memory cache, not primarily for fault tolerance. The surprising idea is that coding can be a latency and load-balancing tool.**

Data-intensive clusters rely on distributed, in-memory caching because memory reads are much faster than disk or SSD reads. However, clusters often suffer imbalance due to:

- skew in object popularity;
- background network imbalance;
- failures and unavailabilities.

The adverse effects are load imbalance and high read latency. A single in-memory copy is often insufficient.

Selective replication is the common approach: cache more replicas for more popular objects. This improves read performance but uses memory in integer replication units. A popular object may need `2x`, `3x`, or more copies.

EC-Cache aims for better read performance and load balance at lower or more finely controlled memory overhead.

![EC-Cache positioning](./lec24_materials/ec_cache_positioning.png)

### 4.1 Erasure Coding Primer
Erasure coding takes `k` data units and creates `r` parity units. The key property is:

**Any k of the (k+r) units are sufficient to decode the original k data units.**

![Erasure coding primer](./lec24_materials/erasure_coding_primer.png)

For example, with `k = 5` and `r = 4`, the object is represented by `5` data units and `4` parity units. Any `5` out of the `9` total units can reconstruct the original data.

### 4.2 EC-Cache Write and Read Path
On writes, an object is split into `k` data units, encoded to create `r` parity units, and the `k+r` units are cached on distinct servers chosen uniformly at random.

On reads, EC-Cache reads from `k + Δ` units chosen uniformly at random, uses the first `k` units that arrive, decodes the data units, and combines them to return the object.

![EC-Cache read path](./lec24_materials/ec_cache_read_path.png)

In the illustrated read example, `k = 2`, `r = 1`, and `Δ = 1`, so the client reads `k + Δ = 3` units. If one unit is slow, the first two arriving units are enough to decode and combine object `X`.

:::remark Question: Why does EC-Cache read from `k + Δ` units rather than exactly `k` units?
Reading exactly `k` units creates a straggler problem: the request waits for the slowest of the chosen `k` units. Reading `k + Δ` units creates a small amount of extra bandwidth overhead, but the system can ignore the slowest responses and use the first `k` that arrive. The result is much better tail latency; the evaluation shows that `Δ = 1` is often enough.
:::

### 4.3 Why Erasure Coding Helps a Cache
Erasure coding helps EC-Cache in four ways.

1. **Finer control over memory overhead.** Selective replication provides only integer control, while erasure coding provides fractional control. With `k = 10`, overhead can be controlled in increments of `0.1`.
2. **Object splitting helps load balancing.** Smaller-granularity reads spread load more smoothly. Under a simplified model:

$$
\frac{\operatorname{Var}(L_{EC\text{-}Cache})}{\operatorname{Var}(L_{Selective\ Replication})} = \frac{1}{k}.
$$

3. **Object splitting reduces median latency but can hurt tail latency.** Parallel reads reduce median latency, but waiting for all required units creates a straggler effect if there are no additional reads.
4. **The “any k out of (k+r)” property reduces tail latency.** Read from `k + Δ` units and use the first `k` that arrive. `Δ = 1` is often sufficient.

![EC-Cache memory overhead and load-balance formula](./lec24_materials/ec_cache_memory_load_balance_formula.png)

### 4.4 Design Differences from Storage Erasure Coding
Erasure coding in storage systems is usually used for space-efficient fault tolerance. EC-Cache uses it to reduce read latency and balance load.

| Design issue | Storage systems | EC-Cache |
|---|---|---|
| Purpose | Space-efficient fault tolerance. | Read latency reduction and load balancing. |
| Code choice | Often optimized for reconstruction resource usage. Some codes do not provide the “any k out of k+r” property. | Needs the “any k out of k+r” property because it helps load balance and latency. |
| Encoding scope | May encode across objects or within objects. | Needs to encode within objects to spread load across both data and parity units. |
| Fault tolerance | Encoding choices affect fault tolerance. | Fault tolerance is handled by underlying storage; the cache focuses on read performance. |

Implementation uses EC-Cache on top of Alluxio. Backend caching servers are unaware of erasure coding; the EC-Cache client library handles read/write logic. The system uses Reed-Solomon codes and Intel ISA-L acceleration.

### 4.5 Evaluation Results
The evaluation uses Amazon EC2, `25` backend caching servers, `30` client servers, Zipf-distributed object popularity, `k = 10`, and `Δ = 1`, which creates `10%` bandwidth overhead.

Load-balancing results show the percent imbalance metric:

$$
\lambda = \frac{L_{max} - L_{avg}}{L_{avg}} \times 100.
$$

Selective replication has `λ_SR = 43.45%`, while EC-Cache has `λ_EC = 13.14%`, which is more than a `3x` reduction.

![EC-Cache load-balancing result](./lec24_materials/ec_cache_load_balancing_result.png)

Read latency also improves. In one result, the median latency improves by `2.64x`, and the `99th` and `99.9th` percentiles improve by about `1.75x`.

![EC-Cache read latency result](./lec24_materials/ec_cache_read_latency_result.png)

For larger objects, the improvement becomes stronger: for `100 MB` objects, median latency improves by `5.5x`, and tail latency improves by `3.85x`. Additional reads are crucial for tail latency; without additional reads (`Δ = 0`), EC-Cache has significant tail-latency degradation.

![EC-Cache additional reads and tail latency](./lec24_materials/ec_cache_additional_reads_tail_latency.png)

The summary result is:

- load balancing: more than `3x` improvement;
- median latency: more than `5x` improvement;
- tail latency: more than `3x` improvement.

## 5. SIGCOMM'01 Chord: Scalable Peer-to-Peer Lookup
**Most Important Core: Chord turns decentralized lookup into a structured routing problem: consistent hashing assigns keys to successor nodes, and finger tables make lookup take `O(log N)` messages with `O(log N)` state per node.**

The problem is simple to state: how can a client find data in a distributed file-sharing system? If a publisher at node `N1` stores key `"LetItBe"` with value `MP3 data`, and a client at `N5` asks `Lookup("LetItBe")`, the system must find the node responsible for that key.

![Chord lookup problem](./lec24_materials/chord_lookup_problem.png)

### 5.1 Why Not Centralized or Flooding?
A centralized directory, as in Napster, maps keys to locations using a central database. It has fast lookup but requires `O(M)` state at the central server and creates a single point of failure.

A naive distributed solution, as in flooding systems such as Gnutella, sends lookup messages widely. It avoids a central server but can require `O(N)` messages per lookup in the worst case.

Chord uses routed messages. It wants to:

- define a useful key-nearness metric;
- keep hop count small;
- keep routing tables the right size;
- stay robust despite rapid membership changes.

### 5.2 Chord Properties and Identifiers
Chord provides a peer-to-peer hash lookup service:

$$
Lookup(key) \rightarrow IP\ address.
$$

Chord does not store the data itself. It only maps a key to the node responsible for that key.

The stated properties are:

- Efficient: `O(Log N)` messages per lookup.
- Scalable: `O(Log N)` state per node.
- Robust: survives massive changes in membership.
- Assumption: no malicious participants.

Chord uses an `m`-bit identifier space for both keys and nodes:

- key identifier = `SHA-1(key)`;
- node identifier = `SHA-1(IP address)`;
- both are uniformly distributed.

### 5.3 Consistent Hashing and Successors
Chord arranges node IDs and key IDs on a circular identifier space. The key rule is:

**A key is stored at its successor: node with next higher ID.**

![Chord consistent hashing successor rule](./lec24_materials/chord_consistent_hashing_successor.png)

In the example, key `"LetItBe"` hashes to `K60`. The next higher node ID on the ring is `N90`, so `K60` is stored at `N90`.

:::remark Question: How do we map key IDs to node IDs in Chord?
Hash both keys and nodes into the same circular identifier space. Then assign each key to the first node encountered clockwise after the key's ID. This node is the key's successor. The rule is simple, deterministic, and changes only locally when nodes join or leave.
:::

### 5.4 Basic Lookup and Finger Tables
If every node knows every other node, routing tables are `O(N)` and lookup is `O(1)`. If every node knows only its immediate successor, routing state is small, but lookup can take `O(N)` hops around the ring.

Finger tables are the compromise. Every node keeps `m` finger entries, and distances increase exponentially. The key rule is:

$$
\text{finger}_i(n) = successor(n + 2^i).
$$

![Chord finger table successor rule](./lec24_materials/chord_finger_table_successor_rule.png)

With these fingers, each hop can move substantially closer to the target key. Lookup takes `O(log N)` hops.

![Chord lookup in logarithmic hops](./lec24_materials/chord_lookup_log_hops.png)

:::remark Question: Why do exponentially spaced fingers give logarithmic lookup?
A node can forward a query to the known finger that most closely precedes the target ID. That usually cuts a large fraction of the remaining identifier distance. Repeatedly shrinking the remaining distance gives logarithmic hop count, analogous to binary search on a circular key space.
:::

### 5.5 Joining the Ring
Joining the ring has three conceptual steps:

1. Initialize all fingers of the new node.
2. Update fingers of existing nodes.
3. Transfer keys from the successor to the new node.

A less aggressive lazy mechanism initializes only the successor finger, periodically verifies the immediate successor and predecessor, and periodically refreshes finger-table entries.

In the example, new node `N36` joins. It asks an existing node to look up its finger targets such as `37`, `38`, `40`, ..., `100`, `164`. Existing nodes update their finger entries, and the successor `N40` transfers keys in the range `21..36` to `N36`.

![Chord join transfers keys](./lec24_materials/chord_join_transfer_keys.png)

Chord's evaluation confirms the theoretical result: lookup cost grows as `O(log N)`. The paper is remembered as pioneering peer-to-peer work that bridges theory and practice. Later distributed hash tables influenced key-value stores such as Amazon Dynamo and decentralized applications such as blockchain systems.

## 6. Cross-Paper Synthesis
These five papers share a design pattern: modern storage systems win by choosing the right control point for the bottleneck.

| Paper | Bottleneck or pressure | Control point | Core lesson |
|---|---|---|---|
| Dedup | Disk bottleneck from huge global duplicate index. | Summary vector, stream layout, LPC. | Global compression needs locality-aware indexing. |
| IOFlow | No end-to-end SLA enforcement across a deep storage stack. | Centralized controller plus programmable queues. | Storage needs a control plane, not only faster devices. |
| GFS | Huge files, appends, failures, high throughput. | Single master for metadata; chunkservers for data. | Specialize the file system to workload assumptions. |
| EC-Cache | Cache load imbalance and tail latency. | Erasure-coded object units plus additional reads. | Coding can improve latency, not just durability. |
| Chord | Decentralized lookup without central bottleneck. | Consistent hashing plus finger tables. | Structured routing gives scalability with small state. |

:::remark Question: Can these papers be compared to classic file-system techniques?
Yes. Dedup extends compression and indexing to global backup streams. IOFlow generalizes the separation between policy and mechanism into a storage control plane. GFS revisits metadata/data separation at cluster scale. EC-Cache reinterprets erasure coding from reliability into performance. Chord turns directory lookup into a scalable distributed naming problem. Each paper takes an older systems idea and moves it to a larger scale or a different bottleneck.
:::

## 7. What to Remember Most
If you remember only one thing from each paper, remember these:

1. **Dedup**: Global deduplication is powerful because backup streams repeat data across files and time; the hard part is avoiding random disk lookups in a massive fingerprint index.
2. **IOFlow**: End-to-end storage SLAs need a storage control plane that can program queues across the I/O path.
3. **GFS**: A single metadata master can work if the data path is distributed and the workload is large, append-heavy, and throughput-oriented.
4. **EC-Cache**: Erasure coding can be used as a cache performance tool by splitting objects, spreading load, and reading extra coded units to avoid stragglers.
5. **Chord**: Consistent hashing plus finger tables gives decentralized lookup with `O(log N)` messages and `O(log N)` state.

## Exam Review
You should be able to explain the following points without looking back:

1. **Deduplication is global compression across many files**, while local compression works inside a small window within one file.
2. The dedup index can be enormous: `80 TB / 8 KB * 20 B ≈ 200 GB`.
3. Summary vectors avoid many disk index lookups; stream-informed layout and LPC preserve duplicate locality.
4. IOFlow's central idea is to separate storage data-plane enforcement from control-plane policy logic.
5. A storage flow has the form `<{VMs}, {File Operations}, {Files}, {Shares}> -> SLA`.
6. Rate limiting storage by bytes or IOPS is insufficient; cost-based rate limiting is needed.
7. Controller-based max-min fair sharing gives work conservation inside and across tenants.
8. GFS is designed for frequent failures, huge files, appends, and high sustained bandwidth.
9. GFS uses a single master for metadata and distributed chunkservers for data.
10. GFS write ordering uses a primary replica lease; the primary serializes modifications and secondaries follow the same order.
11. Erasure coding creates `r` parity units from `k` data units, and any `k` of `k+r` units can decode the data.
12. EC-Cache uses erasure coding for load balancing and latency, not primarily for fault tolerance.
13. Reading `k+Δ` units and using the first `k` reduces tail latency; `Δ=1` is often enough.
14. Chord maps keys and nodes into the same circular ID space and stores each key at its successor.
15. Chord finger tables use `successor(n+2^i)` to achieve `O(log N)` lookup hops.
