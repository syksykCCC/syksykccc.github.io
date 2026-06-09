# Lec18 - Memory 5: Memory Management in Modern Computer Systems

## Learning Objectives
After this lecture, you should be able to explain how classic operating-system memory ideas reappear in modern distributed systems, LLM serving systems, remote-memory systems, and GPU-sharing systems. You should also be able to summarize the core problem, design, mechanism, evaluation result, and OS connection of each paper.

## 1. The Big Picture
Modern memory management is no longer limited to page tables inside one machine. The same ideas reappear at several new boundaries:
- A cluster can expose remote DRAM as a programmable memory abstraction.
- A serving engine can virtualize an LLM's KV cache like an application-level page cache.
- A server can treat remote idle memory as a swap tier.
- A runtime can move objects to far memory while preserving application semantics.
- A GPU system can swap model state or move GPU memory pages between device memory and host memory.

This lecture studies six papers:

| Theme | Paper | Main memory-management idea |
|---|---|---|
| Memory abstraction | FaRM, NSDI 2014 | Use RDMA and transactions to build fast distributed shared memory. |
| Memory abstraction | vLLM / PagedAttention, SOSP 2023 | Page and virtualize attention KV cache with KV blocks. |
| Remote demand paging | Infiniswap, NSDI 2017 | Use RDMA to page memory to remote machines transparently. |
| Remote far memory | AIFM, OSDI 2020 | Integrate far memory into application data structures and a userspace runtime. |
| GPU/host memory switching | PipeSwitch, OSDI 2020 | Pipeline deep-learning model context switching on GPUs. |
| Transparent GPU sharing | TGS, NSDI 2023 | Share GPU compute and memory transparently in container clouds. |

:::remark Question: What connects these papers to classic memory management?
They all revisit the same OS questions under new hardware and workload constraints: what is the addressable object, where is it physically stored, when should it move, who observes access patterns, how expensive is a fault, and how much transparency should the system provide?
:::

## 2. FaRM: Fast Remote Memory
FaRM starts from a hardware trend: DRAM became large enough that a small cluster can hold tens of TBs of memory, and datacenter networks became fast enough to make remote memory access attractive. RDMA networks provide high throughput, microsecond-level latency, and one crucial property: the NIC can access memory directly without involving the remote kernel or remote CPU.

![FaRM RDMA overview](./lec18_materials/farm_rdma_overview.png)

**Remote direct memory access** means a machine can read or write another machine's memory through the NIC. FaRM uses RDMA reads to directly fetch remote data and RDMA writes into remote buffers for messaging. Compared with TCP, the RDMA path has far lower latency and many more requests per microsecond per server, especially for small transfers.

### 2.1 The Programming Problem
The central question is: how should we program a modern cluster that has TBs of DRAM, hundreds of CPU cores, and an RDMA network?

A traditional model separates storage servers from clients that execute application logic. That makes remote access explicit and often leaves server CPUs underused, because RDMA can serve data without remote CPU involvement. FaRM instead prefers a symmetric model: every machine stores data and executes computation.

The desired programming model has three goals:
- keep data in memory;
- access data using RDMA;
- colocate data and computation whenever locality matters.

### 2.2 Shared Address Space
FaRM offers a shared address-space abstraction over distributed objects. Objects can be read, written, allocated, and freed through a common abstraction even though they are physically placed across machines.

![FaRM shared address space](./lec18_materials/farm_shared_address_space.png)

This shared address space is intended to be transparent with respect to:
- location;
- concurrency;
- failures.

The abstraction is strong: FaRM aims for **serializability**, so concurrent updates behave as if transactions executed in some serial order.

:::remark Question: Why is shared address space useful but not sufficient by itself?
A shared address space makes remote data easier to name and access, but performance still depends on locality. If computation repeatedly touches remote objects one by one, the program can pay many RDMA round trips. FaRM therefore also emphasizes placing related objects together and shipping computation to the data when that is better.
:::

### 2.3 Locality and Transactions
FaRM applies locality awareness by colocating data that is accessed together. If object `1` is often accessed with objects `2`, `4`, `6`, and `7`, it is better to place those objects near each other or move computation to the machine that stores the target data. This turns a cluster into something closer to a collection of optimized single-server transactions rather than a set of remote object lookups.

For updates, FaRM uses transactions:

![FaRM transaction flow](./lec18_materials/farm_transaction_flow.png)

The transaction flow is:
1. During execution, the application buffers writes and reads objects through RDMA.
2. At commit time, it locks the objects it intends to update.
3. It validates that the objects it read have not changed in a conflicting way.
4. It applies updates and unlocks the objects.

This is an OS-style memory abstraction with distributed-systems guarantees: the system tries to make remote memory fast while preserving a coherent transactional model.

### 2.4 Example: TAO
TAO is Facebook's in-memory graph store. The workload is read dominated, with about 99.8% reads and 10 operation types. In the FaRM implementation:
- nodes and edges are FaRM objects;
- lookups use lock-free reads;
- updates use transactions.

The reported result is substantial: about **6 Mops/s/server**, roughly a **10x improvement**, and about **42 microseconds average latency**, a **40-50x improvement**. The important lesson is that the abstraction is not merely elegant; with RDMA and locality, it can enable new data-serving designs.

### 2.5 FaRM Takeaway
FaRM is best understood as a distributed-memory platform:
- Data stays in memory.
- RDMA makes remote memory access cheap enough to be a systems primitive.
- A shared-memory abstraction improves programmability.
- Transactions and lock-free reads provide concurrency control.
- Locality remains essential, because "remote memory is fast" does not mean "remote memory is free."

## 3. vLLM and PagedAttention: Paging the KV Cache
vLLM studies memory management for LLM serving. LLMs power chat, programming, content creation, business operations, and developer tools, but serving them is slow and expensive. A single A100 GPU can serve fewer than one request per second for a moderate 13B-parameter model and input. Production-scale services therefore need many GPUs.

### 3.1 Why LLM Serving Is Slow
LLM inference is autoregressive. Given an input such as:

```text
Artificial Intelligence is
```

the model generates one output token at a time:

```text
the -> future -> of -> ...
```

The next output token depends on previous output tokens. This sequential dependency makes it hard to fully utilize GPU parallelism. Batching multiple requests together helps, because the GPU can process several requests in parallel. However, the batch size is limited by inefficient memory management for the **KV Cache**.

### 3.2 KV Cache and Fragmentation
The attention KV cache stores key/value vector representations for tokens that have already been processed. It grows as the request generates more tokens and shrinks when the request finishes. It is huge:
- each token may require about **1 MB** of KV cache;
- one full request can require **several GBs**.

Previous systems often pre-allocate contiguous KV cache space up to each request's maximum possible length. That convention is convenient for static deep-learning shapes, but generation has unknown output length.

![vLLM KV cache fragmentation](./lec18_materials/vllm_kv_cache_fragmentation.png)

The result is fragmentation:
- **Internal fragmentation**: a request reserves slots for future tokens it may never generate.
- **External fragmentation**: different requests have non-uniform maximum lengths, leaving holes between allocations.

Only **20-40%** of KV cache space may store actual token states in previous systems. The memory waste reduces batch size, which reduces serving throughput.

:::remark Question: Why is KV cache management an OS memory-management problem?
The KV cache has the same structure as virtual memory pressure: variable-length logical objects must be placed in limited physical memory, contiguous allocation causes fragmentation, and sharing/reclamation decisions affect throughput. vLLM's key move is to bring paging and virtual addressing ideas into the application-level attention runtime.
:::

### 3.3 PagedAttention
The key idea is **Application-level memory paging and virtualization for attention KV Cache**.

PagedAttention splits KV cache space into fixed-size **KV blocks**. A KV block is a fixed-size contiguous chunk of memory that stores KV token states from left to right. Instead of requiring one contiguous allocation for the whole request, each request has logical KV blocks mapped through a block table to physical KV blocks.

![vLLM virtualized KV cache](./lec18_materials/vllm_virtualized_kv_cache.png)

For example, the prompt:

```text
Alan Turing is a computer scientist
```

can be represented as logical KV block 0 containing `Alan Turing is a` and logical KV block 1 containing `computer scientist`. The block table maps logical block 0 to one physical KV block and logical block 1 to another physical KV block. The physical blocks do not need to be contiguous.

During attention:
1. the GPU kernel fetches non-contiguous KV blocks using the block table;
2. it applies the attention operation on the fly.

This indirection introduces about **10-15% slowdown in GPU kernel latency**, but the memory efficiency gain allows much larger batches and higher overall throughput.

### 3.4 On-Demand Allocation and Block Size
PagedAttention allocates physical KV blocks on demand. If a request appends a token and the current logical block has free space, the token fills the next slot. If the logical block is full, the system allocates a new physical KV block and records it in the block table.

This reduces fragmentation:
- there is **no external fragmentation**, because physical KV blocks can be placed anywhere;
- internal fragmentation is limited to the last block of a sequence;
- the number of wasted tokens per sequence is less than the block size.

The block size tradeoff mirrors OS page size:
- too small: low spatial locality and more metadata/kernel-like overhead;
- too large: larger internal fragmentation;
- the lecture example reports that block size **16** works generally well in practice.

### 3.5 Sharing and Copy-on-Write
Paging also enables sharing. In parallel sampling, multiple outputs share the same prompt. For example, the prompt:

```text
The future of cloud computing is likely to be characterized by several key trends
```

may branch into multiple completions. The prompt KV blocks can be shared across samples, except for the last partially filled block. When one sample diverges and appends different tokens, PagedAttention uses copy-on-write.

![vLLM KV block sharing and copy-on-write](./lec18_materials/vllm_kv_block_sharing_cow.png)

Beam search is a more complex version of the same idea. Several beams share a prefix, then fork into different continuations. This is similar to a process tree with fork and kill: common prefixes are shared, and diverging branches get private blocks.

The measured memory saving is meaningful:
- with parallel decoding samples 2, 4, and 6, memory saving is about 16.2%, 25.7%, and 30.5%;
- with beam widths 2, 4, and 6, memory saving is about 44.3%, 61.0%, and 66.3%.

### 3.6 Preemption and Recovery
When KV block memory is exhausted, a new request may be unable to allocate a physical block. vLLM can preempt some requests so others run first.

![vLLM preemption and recovery](./lec18_materials/vllm_preemption_recovery.png)

There are two recovery strategies:
- **Swapping**: move the request's KV cache to CPU memory and later swap it back to GPU memory.
- **Recomputation**: delete the KV cache and recompute it from tokens when the request resumes.

Because every generation step needs all previous tokens, preemption and recovery operate at the whole-request level. The paper's strategy is to use recomputation when possible with an FCFS policy. Recomputation can be surprisingly fast because the KV cache for all previous tokens can be rebuilt in parallel.

### 3.7 vLLM Takeaway
vLLM maps OS virtual memory ideas directly to LLM serving:
- OS pages correspond to KV blocks.
- Page tables correspond to block tables.
- Shared pages correspond to shared KV blocks across samples or beams.
- Copy-on-write supports efficient branching.
- Preemption and recovery provide a memory-pressure response.

The results are the payoff: PagedAttention improves memory efficiency by **2.5x-5x** and improves serving throughput by up to **4x**.

## 4. Infiniswap: Remote Paging over RDMA
Infiniswap focuses on memory disaggregation. Many memory-intensive applications, such as databases, key-value stores, graph processing, and in-memory analytics, suffer badly when their working set does not fit in memory. At the same time, datacenter clusters often allocate more memory than they use.

The motivation is a mismatch:
- applications need more memory to avoid performance collapse;
- the cluster contains idle memory on other machines;
- the system should exploit that idle memory without changing applications or hardware.

![Infiniswap disaggregating free memory](./lec18_materials/infiniswap_disaggregate_free_memory.png)

### 4.1 Challenges
The design objectives are:
- minimize deployment overhead;
- require **no hardware design**;
- require **no application modification**;
- tolerate failures such as network disconnection and machine crash;
- manage remote memory at scale.

Compared with older memory-disaggregation work, Infiniswap aims to satisfy all of these simultaneously.

:::remark Question: Why not just use a remote key-value store for swapped pages?
A remote key-value service can store data remotely, but it usually requires application changes or introduces server-side CPU involvement. Infiniswap wants a swap-like interface that existing applications can use transparently while exploiting one-sided RDMA for low overhead.
:::

### 4.2 System Overview
Infiniswap inserts itself below applications through the operating system's virtual memory path.

![Infiniswap system overview](./lec18_materials/infiniswap_system_overview.png)

The components are:
- **Infiniswap Block Device**: appears as swap space to the OS and routes swap requests.
- **Local disk**: asynchronously backs up swapped-out data, so remote memory failure can be tolerated.
- **Infiniswap Daemon**: exposes a local memory region as a remote-memory service.
- **RDMA**: performs one-sided remote reads and writes, bypassing the remote CPU.

The flow is:
1. The OS decides to swap out a page.
2. The Infiniswap block device receives the swap request.
3. The request is routed to remote memory managed by an Infiniswap daemon.
4. Data is written to remote memory with RDMA.
5. A local disk backup is created asynchronously to tolerate failures.

This is demand paging where the backing store is not only local disk, but a pool of remote DRAM.

### 4.3 Scaling Remote Memory: From Pages to Slabs
A naive remote-page mapping would track every local page to a remote page. For 1GB, 4KB pages imply 256K entries and potentially 256K RTTs to manage mappings. That is too fine-grained for scalable cluster management.

![Infiniswap memory slab management](./lec18_materials/infiniswap_memory_slab.png)

Infiniswap uses memory slabs as the management unit. A slab groups many pages and is assigned to a remote machine. This reduces metadata and mapping overhead while still allowing the OS to swap at page granularity locally.

### 4.4 Choosing Remote Machines
The system must answer two questions:
- Which remote machine should store a new remote slab?
- Which remote mapping should be evicted when capacity is needed?

A central controller could balance memory utilization, but it creates a scalability and availability bottleneck. Infiniswap instead uses a decentralized approach based on the **power of two choices**.

![Infiniswap power of two choices](./lec18_materials/infiniswap_power_of_two_choices.png)

The idea is simple:
1. Sample two candidate remote machines.
2. Compare their available remote-memory capacity.
3. Place the slab on the better of the two.

This randomized load-balancing strategy is much cheaper than global coordination, yet it substantially improves balance compared with a single random choice.

### 4.5 Evaluation and Limitations
The evaluation uses a 32-node cluster with a 56Gbps InfiniBand NIC and applications such as VoltDB, Memcached, PowerGraph, and GraphX.

The results emphasize two outcomes:
- Application performance improves by **2-16x** when 50% of the working set is in memory and the rest is backed by Infiniswap rather than disk.
- Cluster memory utilization improves from **40.8% to 60%**, a **1.47x** improvement, in an experiment with 90 containers.

The limitations are also important:
- fault tolerance has a tradeoff because local disk backup can become the bottleneck;
- multiple remote replicas improve failure tolerance but reduce space efficiency;
- performance isolation among applications remains a challenge.

### 4.6 Infiniswap Takeaway
**Infiniswap: remote paging over RDMA** is a practical memory-disaggregation system. It keeps the application and hardware unchanged, relies on the OS swap interface, uses RDMA to make remote memory fast, and uses decentralized slab placement to scale.

Its OS connection is direct: it is demand paging with a new backing tier between DRAM and disk.

## 5. AIFM: Application-Integrated Far Memory
AIFM studies the same broad problem as Infiniswap but takes the opposite transparency tradeoff. Infiniswap preserves the OS paging interface; AIFM argues that OS paging wastes performance because it lacks application semantics and pays high kernel overhead.

### 5.1 Why Existing Far-Memory Systems Waste Performance
In-memory applications such as data analytics, web caching, databases, and graph processing are limited by a server's physical memory boundary. They cannot overcommit memory cheaply, so operators often overprovision memory for peak usage.

Far memory proposes to use idle remote memory over a fast network. But existing OS-paging systems perform poorly. In one data-analytics example with only 25% of the working set in local memory, the state of the art wastes about 70% of possible performance.

The reasons are:
- **Semantic gap**: the OS sees pages, not application objects. Page granularity causes read/write amplification and makes prefetching difficult.
- **High kernel overheads**: page faults are expensive, and in-kernel network I/O can burn CPU cycles through busy polling.

:::remark Question: Why does page granularity cause amplification?
If an application needs a small object inside a page, OS paging may fetch the whole page. If the application later touches related objects on different pages, the OS may miss the pattern. The application knows the data structure and traversal order, but the OS only sees page faults after they happen.
:::

### 5.2 AIFM Design
AIFM's key idea is to **swap memory using a userspace runtime**.

![AIFM design overview](./lec18_materials/aifm_design_overview.png)

The design maps each challenge to a component:

| Challenge | AIFM solution |
|---|---|
| Semantic gap, amplification, hard prefetching | Remoteable data structure library |
| Kernel overheads, page faults, busy polling | Userspace runtime |
| Impact of memory reclamation and pausing app threads | Pauseless evacuator |
| Network bandwidth lower than DRAM bandwidth | Remote agent |

### 5.3 Remoteable Data Structures and Userspace Runtime
The remoteable data structure library exposes application semantics. Instead of using ordinary `std::unordered_map`, `std::array`, and `std::list`, the program can use structures such as `RemHashTable`, `RemArray`, and `RemList`.

![AIFM remoteable code example](./lec18_materials/aifm_remoteable_code_example.png)

The code example illustrates the shift:
- the loop over a remote list can prefetch list data;
- accesses through the hash table can cache hot objects;
- large array reads can use a "do not cache" option to avoid polluting local memory.

The userspace runtime manages object movement without kernel page faults. If one user-level thread waits for a remote object, the runtime can yield to another user-level thread. This hides latency while keeping scheduling and network activity in user space.

### 5.4 Pauseless Evacuator and Remote Agent
The pauseless evacuator moves cold or reclaimable objects from local memory to far memory without stopping application threads for long periods. It addresses the problem that memory reclamation itself can otherwise create pauses.

The remote agent addresses the fact that network bandwidth is lower than DRAM bandwidth. Instead of always bringing objects back to local memory, AIFM can perform light operations near the remote object. For example, copying object `1` can be done by sending a small request to the remote agent, which performs the copy near far memory.

### 5.5 Evaluation and Takeaway
AIFM implements six data structures: Array, List, Hashtable, Vector, Stack, and Queue. The runtime is built on Shenango and uses a TCP far-memory backend.

![AIFM NYC Taxi performance](./lec18_materials/aifm_nyc_taxi_performance.png)

The results show:
- AIFM hides far-memory latency with moderate compute.
- In NYC Taxi analysis, AIFM achieves near-ideal performance with small local memory.
- A synthetic web frontend sees up to **13x end-to-end speedup**.
- Data-structure microbenchmarks see up to **61x speedup**.

The key lesson is the transparency/performance tradeoff. AIFM gives up some transparency because applications use AIFM data structures, but it gains application semantics and avoids the worst costs of OS paging.

## 6. PipeSwitch: Fast Pipelined Context Switching for Deep Learning Applications
PipeSwitch studies GPU memory management for deep-learning workloads. Training wants high throughput; inference wants low latency. Many systems therefore put them in separate GPU clusters, but utilization becomes low. Ideally, training and inference should share a GPU cluster.

The obstacle is context switching. Switching from an old model to a new model can require moving model parameters, allocating GPU memory, initializing tasks, and cleaning old tasks. Existing solutions have drawbacks:
- NVIDIA MPS suffers from contention overhead.
- Salus requires all models to be preloaded into GPU memory.
- A context switch can take about **6 seconds** in the motivating example.

PipeSwitch's goal is to enable GPU-efficient multiplexing of multiple deep-learning applications with fine-grained time sharing and **millisecond-scale context switching latencies**.

### 6.1 Architecture and Execution
PipeSwitch uses a controller, an active worker, standby workers, and a memory daemon.

![PipeSwitch architecture](./lec18_materials/pipeswitch_architecture.png)

When a new task arrives:
1. The system stops the current task and prepares for the next task.
2. The next task executes with pipelined model transmission.
3. The previous task's environment is cleaned.

The main overhead sources are:
- model transmission;
- memory allocation;
- task initialization;
- task cleaning.

### 6.2 Pipelined Model Transmission
Deep-learning models are layered. A sequential switch first transmits all layers over PCIe and only then executes them on the GPU. That wastes time because PCIe transfer and GPU computation do not overlap.

![PipeSwitch pipelined transmission](./lec18_materials/pipeswitch_pipelined_transmission.png)

PipeSwitch pipelines the process:
1. transmit layer 0;
2. while the GPU executes layer 0, transmit layer 1;
3. while the GPU executes layer 1, transmit layer 2;
4. continue overlapping transmission and execution.

The difficult part is choosing how to group layers. Too many small groups cause many PCIe calls and synchronization overhead; too few large groups reduce overlap. Finding the optimal grouping can take exponential time, so PipeSwitch uses heuristics for pruning.

### 6.3 Unified Memory Management
PipeSwitch also reduces memory allocation overhead through unified memory management.

![PipeSwitch unified memory management](./lec18_materials/pipeswitch_unified_memory_management.png)

A memory daemon manages model parameters and GPU memory. Workers access memory through pointers and offsets, so GPU memory can be allocated and reused more systematically instead of being repeatedly rebuilt for each task.

### 6.4 Active-Standby Worker Switching
Task initialization and cleaning are handled with active-standby worker switching.

![PipeSwitch active-standby worker switching](./lec18_materials/pipeswitch_active_standby_switching.png)

The process is:
1. A standby worker performs the first part of initialization before the new task starts, such as launching the process and creating the CUDA context.
2. When the switch point arrives, the system performs the second part, such as allocating GPU memory.
3. The new task starts execution while old-task cleanup is decoupled from the critical path.

This resembles OS context-switch optimization: prepare state off the critical path and minimize work at the actual switch point.

### 6.5 Evaluation and Takeaway
PipeSwitch is evaluated on AWS EC2 with NVIDIA Tesla V100 and T4 GPUs, CUDA 10.1, PyTorch 1.3.0, and models including ResNet-152, Inception-v3, and BERT-base.

The evaluation asks:
- Can PipeSwitch satisfy SLOs?
- Can PipeSwitch provide high utilization?
- How well do the design choices work?

The reported conclusions are:
- PipeSwitch achieves low context switching latency.
- PipeSwitch achieves near **100% utilization**.

PipeSwitch's core memory-management idea is that GPU model state is a context. To share GPUs well, that context must be moved, allocated, initialized, and cleaned like OS process state, but with model-layer structure and PCIe/GPU overlap.

## 7. TGS: Transparent GPU Sharing in Container Clouds
TGS studies deep-learning training jobs in container clouds. Training jobs are important datacenter workloads, but production GPU utilization is low: the lecture notes cite Microsoft average GPU utilization of **52%** and Alibaba median utilization no more than **10%**. The root cause is static assignment: each GPU is assigned to a single container.

### 7.1 Existing GPU Sharing Solutions
The general idea is to classify jobs into two groups:
- **Production jobs** should run without performance degradation.
- **Opportunistic jobs** use spare GPU resources.

Existing solutions fail to provide all desired properties:
- AntMan modifies TensorFlow or PyTorch and lacks transparency.
- NVIDIA MPS is transparent but has low utilization, weak fault isolation, and no GPU memory oversubscription.
- NVIDIA MIG provides hardware partitioning, but cannot arbitrarily partition a GPU, cannot dynamically change GPU resources, is available only on some GPUs, and does not support GPU sharing for multi-GPU instances.

![TGS solution comparison](./lec18_materials/tgs_solution_comparison.png)

TGS aims to provide four properties together:
- transparency;
- high utilization;
- performance isolation;
- fault isolation.

### 7.2 Architecture
TGS is placed below containers and above the host OS/hardware. It contains:
- a rate monitor;
- a rate controller;
- unified memory support.

![TGS architecture](./lec18_materials/tgs_architecture.png)

The point is to remain transparent to TensorFlow, PyTorch, Docker, and Kubernetes-style deployments while still controlling GPU compute and memory sharing.

### 7.3 Sharing GPU Compute: Adaptive Rate Control
A strawman compute-sharing solution is priority scheduling: control opportunistic jobs based on GPU kernel queues. The problem is that queue state does not accurately reflect remaining GPU resources, so utilization remains low.

![TGS adaptive rate control](./lec18_materials/tgs_adaptive_rate_control.png)

TGS uses adaptive rate control:
1. Production jobs submit kernels at rate `\alpha_{in}`.
2. The monitor observes production-job behavior and reports it.
3. TGS lets production jobs out at `\alpha_{out} = \alpha_{in}` to protect them.
4. Opportunistic jobs submit at rate `\beta_{in}`, but TGS controls their output so `\beta_{out} \le \beta_{in}` and uses only remaining GPU capacity.

The system therefore protects production jobs while feeding spare capacity to opportunistic jobs.

### 7.4 Sharing GPU Memory: Transparent Unified Memory
GPU memory sharing has two problems:
- total GPU memory consumption can exceed GPU memory capacity and cause OOM, which is weak fault isolation;
- some jobs claim all GPU memory, which lowers utilization.

At the OS layer, TGS cannot directly ask a deep-learning framework to release unused GPU memory or rewrite framework pointers from GPU memory to host memory.

![TGS transparent unified memory](./lec18_materials/tgs_transparent_unified_memory.png)

The key idea is to leverage CUDA unified memory to transparently unify GPU memory and host memory:
- physical GPU memory is allocated when jobs first access it, improving utilization;
- when GPU memory is oversubscribed, TGS changes virtual-memory mappings so GPU memory of opportunistic jobs is evicted to host memory, protecting production jobs.

This is demand paging between GPU memory and host memory, but packaged as transparent GPU sharing for containers.

### 7.5 Evaluation and Takeaway
TGS is implemented in about 3000 lines of C++ and Python and integrates with Docker and Kubernetes. It is evaluated on NVIDIA A100 and V100 GPUs with traces from Microsoft Philly and models including ResNet, ShuffleNet, MobileNet, GCN, BERT, GPT-2, and DLRM.

The reported results are:
- In a mixed workload stream with 50 production jobs and 50 opportunistic jobs, opportunistic jobs see **52% JCT reduction** compared with exclusive access.
- Production jobs see **21% JCT reduction** compared with uncontrolled co-execution.
- TGS provides transparency without sacrificing performance compared with AntMan.
- Under GPU memory oversubscription, TGS improves throughput by up to **15x** compared with MPS.

The key lesson is that GPU sharing is also memory management: the system needs virtual memory, oversubscription, eviction, fault isolation, and adaptive scheduling.

## 8. Cross-Paper Comparison
The six papers form a spectrum from transparent OS-level mechanisms to application-integrated mechanisms.

| Paper | Main abstraction | What moves? | Who manages it? | Transparency tradeoff |
|---|---|---|---|---|
| FaRM | Distributed shared address space | Objects and transactions over RDMA | Distributed runtime | Application uses FaRM abstractions. |
| vLLM | Virtual KV cache | KV blocks | LLM serving engine | Transparent to model semantics, internal to serving system. |
| Infiniswap | Swap block device | Pages/slabs to remote DRAM | OS block device + daemon | Transparent to applications. |
| AIFM | Remoteable data structures | Objects to far memory | Userspace runtime | Requires application/library changes. |
| PipeSwitch | GPU task context | Model layers/state | GPU scheduler/runtime | Transparent to workload after integration. |
| TGS | Shared GPU with unified memory | GPU pages to host memory | OS-layer sharing system | Transparent to containers/frameworks. |

The most important design axis is **who knows the semantics**:
- OS-level systems are more transparent but often know less about access patterns.
- Application-level systems know more and can prefetch/share/recompute better, but require runtime or API integration.

:::remark Discussion: What have we learned from these papers?
Classic memory management ideas are portable. Paging, virtualization, sharing, copy-on-write, preemption, replacement, and fault isolation keep reappearing, but the "page" may now be a KV block, a remote slab, an application object, a model layer, or a GPU unified-memory mapping.
:::

:::remark Discussion: Which papers are easier to like, and why?
vLLM is especially elegant because the OS analogy is almost exact: KV blocks behave like pages, block tables behave like page tables, and copy-on-write naturally supports sampling and beam search. Infiniswap is attractive for the opposite reason: it preserves application transparency and uses the existing swap path. AIFM is compelling when performance matters more than full transparency.
:::

:::remark Discussion: Which papers might be criticized?
FaRM and AIFM require applications to use special abstractions, which may limit adoption. Infiniswap depends on remote-memory network behavior and has fault-tolerance tradeoffs. PipeSwitch and TGS target GPU workloads whose hardware/software stacks change quickly, so portability and long-term maintenance are real concerns.
:::

:::remark Discussion: Can we compare them to classic memory-management techniques?
Yes. vLLM is closest to paging and page tables. Infiniswap is closest to swap-backed demand paging. AIFM resembles object-level virtual memory. PipeSwitch resembles process context switching with staged state transfer. TGS resembles virtual memory plus scheduling for GPU containers. FaRM resembles distributed shared memory with transactional consistency.
:::

:::remark Discussion: Can we come up with new ideas?
A useful design direction is hybrid transparency: keep an OS-level fallback for compatibility, but let applications optionally expose semantic hints. For example, an LLM serving engine might expose KV-block lifetime and sharing hints to a GPU memory manager, or a far-memory runtime might let the OS know which objects are prefetchable, recomputable, or latency critical.
:::

## Exam Review

### Paper One-Liners
- **FaRM**: RDMA plus shared address space plus transactions for fast distributed in-memory computing.
- **vLLM/PagedAttention**: application-level paging and virtualization for LLM KV cache.
- **Infiniswap**: transparent remote paging over RDMA through a swap-like block device.
- **AIFM**: far memory integrated into application data structures and a userspace runtime.
- **PipeSwitch**: pipelined GPU context switching for fine-grained sharing of DL applications.
- **TGS**: transparent GPU sharing in container clouds with adaptive rate control and unified memory.

### Mechanism Checklist
- FaRM uses RDMA reads/writes, locality-aware placement, lock-free reads, and transactions.
- vLLM uses fixed-size KV blocks, block tables, on-demand allocation, sharing, copy-on-write, and recomputation-based recovery.
- Infiniswap uses an Infiniswap block device, local disk backup, an Infiniswap daemon, RDMA, slabs, and power of two choices.
- AIFM uses remoteable data structures, a userspace runtime, a pauseless evacuator, and a remote agent.
- PipeSwitch uses pipelined model transmission, unified memory management, and active-standby worker switching.
- TGS uses rate monitor/control and CUDA unified memory to share GPU compute and memory transparently.

### Numbers Worth Remembering
- FaRM on TAO: about **6 Mops/s/server**, about **42 microseconds average latency**.
- vLLM: KV cache utilization in prior systems can be only **20-40%**; PagedAttention improves memory efficiency by **2.5x-5x** and throughput by up to **4x**.
- Infiniswap: application performance improves by **2-16x**; cluster memory utilization improves from **40.8% to 60%**.
- AIFM: up to **13x end-to-end speedup** and **61x** data-structure microbenchmark speedup.
- PipeSwitch: targets **millisecond-scale** context switches and near **100% GPU utilization**.
- TGS: opportunistic-job JCT reduces by **52%**, production-job JCT reduces by **21%**, and oversubscription throughput improves by up to **15x** over MPS.

### Common Exam Questions
- Explain why PagedAttention reduces fragmentation compared with contiguous KV cache allocation.
- Compare Infiniswap and AIFM: which is more transparent, and which has more semantic information?
- Explain why PipeSwitch can overlap model transmission and execution.
- Explain how TGS protects production jobs while using spare GPU capacity for opportunistic jobs.
- Pick one paper and map its design to classic OS concepts such as paging, page tables, copy-on-write, swapping, preemption, or scheduling.

### Common Pitfalls
- Do not treat all "remote memory" papers as the same. Infiniswap is OS-level remote paging; AIFM is application-integrated object movement; FaRM is distributed shared memory.
- Do not describe vLLM as only a GPU optimization. Its core contribution is memory virtualization for KV cache.
- Do not forget the transparency/performance tradeoff: the systems that know more application semantics often require more integration.
- Do not ignore fault isolation in GPU sharing. Memory oversubscription without isolation can turn one job's memory behavior into another job's failure.
