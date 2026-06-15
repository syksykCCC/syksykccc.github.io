# 期末考试模拟试题 FinalMock2

## 试卷说明

- 题型：简答题 30 题。
- 覆盖范围：主要聚焦 Lec14-Lec24，少量题目会回扣前半学期的基础抽象。
- 答题建议：每题切入点较小，重点写清楚“解决什么问题、过程是什么、优缺点是什么、不能解决什么问题”。后半学期论文只考核心方法，不考实现细枝末节。

## 一、简答题

### 简答题 1：Segmentation 与 Paging 的优缺点比较

请比较 segmentation 和 paging 在地址空间表达、碎片问题、共享支持和增长处理上的优缺点。

:::tip 答案与解析
Segmentation 按逻辑区域划分，例如 code、heap、stack，每段有 base/limit 和权限。它的优点是贴近程序结构，适合表达不同区域的权限和共享；缺点是段长可变，容易产生 external fragmentation，段增长或交换时也可能很麻烦。

Paging 把地址空间切成固定大小 page，把物理内存切成同样大小的 frame。它的优点是消除大部分 external fragmentation，物理页不需要连续，按页共享和按需分配都更容易；缺点是可能有 internal fragmentation，页表可能很大，并且每次访问都需要高效地址转换。分页下栈增长触及未映射页时，OS 可以只分配一个新页，比移动整个段更容易处理。
:::

### 简答题 2：多级页表解决什么问题，又带来什么代价？

请说明单级页表在稀疏地址空间下的问题，多级页表如何缓解，以及为什么它仍然离不开 TLB。

:::tip 答案与解析
单级页表的问题是规模随虚拟地址空间大小增长，即使大部分虚拟区域没有使用，也可能需要为所有 VPN 保留页表项。64 位地址空间下这会非常浪费。

多级页表把页表拆成树形结构，只为实际使用的区域分配下级页表页，因此适合稀疏地址空间，也方便共享某些页表子树。代价是 TLB miss 时 page-table walk 可能访问多级内存，页表页本身也要被管理，缺失时开销更高。TLB 缓存最近的 VPN 到 PPN 及权限结果，否则多级翻译会让常见路径过慢。
:::

### 简答题 3：TLB consistency 为什么重要？

当 OS 修改页表项、权限或上下文切换到另一个进程时，为什么必须考虑 TLB consistency？常见处理方法是什么？

:::tip 答案与解析
TLB 缓存的是旧的地址转换和权限结果。如果页表已经改变，但 TLB 里仍保留 stale entry，CPU 可能继续使用旧映射，导致访问错误物理页、绕过权限变化，或在 copy-on-write、page replacement 后读写不该访问的页面。

常见方法包括：在上下文切换时 flush 相关 TLB entries，或使用地址空间标识符 ASID 区分不同进程的 TLB 项；在修改某个 PTE 后，对该虚拟页做定向 invalidation。多核系统还要考虑其他 CPU 上的 stale TLB，可能需要 TLB shootdown。
:::

### 简答题 4：Page fault 的处理过程

请按步骤说明一次可恢复的 demand-paging page fault 从发生到原指令重启的过程。

:::tip 答案与解析
首先，硬件在地址转换时发现 PTE 无效或页面不驻留，产生同步 trap 进入 OS。OS 检查该访问是否合法：如果是越权访问，通常终止进程；如果是合法但页面尚未驻留，则继续处理。

接着，OS 根据 backing-store metadata 找到缺失页面在 executable、mapped file 或 swap 中的位置。然后获取 free frame；若没有空闲页框，需要选择 victim，若 victim 是 dirty page，则先写回 backing store。之后 OS 把缺失页面读入页框，更新 PTE、权限位、dirty/use 等状态，并处理 TLB invalidation。最后让 faulting thread 回到 ready/running 状态，重启原来的指令。
:::

### 简答题 5：为什么说 demand paging 是一种 cache？

请解释 demand paging 与普通硬件 cache 的相似点和不同点，并说明为什么 demand paging 中 write-back 比 write-through 更合理。

:::tip 答案与解析
Demand paging 把 DRAM 看作 disk/backing store 的 cache：虚拟页是被缓存对象，驻留页在内存中，非驻留页在 backing store 中；page fault 类似 cache miss，page replacement 类似 eviction。

不同点是 page fault 成本极高，通常涉及磁盘或远程存储 I/O；替换策略由 OS 软件参与；page cache 近似 fully associative，因为任意虚拟页可放入任意物理页框；miss 处理还要维护保护、进程状态和调度。

Write-back 更合理，因为每次内存写都同步写回磁盘会极慢。OS 通常只标记 dirty，等页面被替换或同步时再写回，从而合并多次写入。代价是需要 dirty bit、writeback 机制和崩溃窗口管理。
:::

### 简答题 6：FIFO、LRU、MIN 与 Clock 分别使用什么信息？

请比较 FIFO、LRU、MIN 和 Clock 的核心思想、优点和主要缺点，并说明 Bélády anomaly 与 stack property 的关系。

:::tip 答案与解析
FIFO 替换最早进入内存的页面，简单但不看访问局部性，可能出现 Bélády anomaly，即页框更多反而 fault 更多。LRU 替换最长时间未使用的页面，利用过去 recency 近似未来访问，通常适合局部性，但精确实现成本高，在循环工作集大于内存时可能表现很差。MIN 替换未来最晚使用的页面，理论最优，但需要预知未来，不能在线实现。

Clock 用 use bit 和环形扫描近似 LRU：use 为 1 时清零并给第二次机会，use 为 0 时可淘汰。它实现成本低，但只是近似。Stack property 指内存增大时驻留集合单调包含，LRU 和 MIN 满足，因此不会有 Bélády anomaly；FIFO 不满足。
:::

### 简答题 7：Working-set model 如何解释 thrashing？

请说明 working set、thrashing、page-fault frequency 三者的关系，以及系统可以如何缓解 thrashing。

:::tip 答案与解析
Working set 是进程在最近时间窗口内活跃使用的页面集合。如果所有运行进程的 working set 总需求超过物理页框数，系统会频繁把马上还要用的页面换出，导致 page fault frequency 很高，磁盘 paging 主导执行，CPU 有效利用率下降，这就是 thrashing。

缓解方法包括：根据 page-fault frequency 给高 fault 进程增加页框、给低 fault 进程回收页框；如果总内存确实不够，可以 swap out 或暂停部分进程，降低 multiprogramming level；也可以用 working-set model 判断是否有足够页框支持当前活跃集合。核心不是“继续加进程提高利用率”，而是先让剩余进程有足够内存取得进展。
:::

### 简答题 8：PagedAttention 解决了 KV cache 的什么问题？

请说明 vLLM/PagedAttention 为什么把 KV cache 管理看成 OS 内存管理问题，它的核心方法是什么，不能解决什么问题。

:::tip 答案与解析
LLM serving 中每个请求会产生 KV cache。传统连续分配容易产生碎片，且 sampling、beam search 等场景有大量共享前缀。如果把 KV cache 当作连续大块内存，会浪费 GPU memory，降低并发请求数。

PagedAttention 的核心方法是把 KV cache 切成固定大小 KV blocks，用 block table 做类似 page table 的映射，按需分配 block，并用 sharing 和 copy-on-write 支持多个输出分支共享前缀。它解决的是 KV cache memory virtualization 和碎片问题，不是直接提升模型计算本身，也不能消除 GPU 总内存容量限制；block size 仍有内部碎片和管理开销的权衡。
:::

### 简答题 9：Infiniswap 与 AIFM 的透明性/性能权衡

请比较 Infiniswap 和 AIFM 分别如何使用远程内存，以及二者在透明性、应用语义和性能上的取舍。

:::tip 答案与解析
Infiniswap 走 OS-level transparent remote paging 路线。它把远程空闲内存包装成类似 swap 的 block device，用 RDMA 访问远端内存，并通过 slab、daemon 和远端选择策略管理远程页。优点是对应用透明，能利用已有 swap 路径；缺点是 OS 只看到 page，缺少对象语义，prefetch、放置和放大问题更难优化。

AIFM 走 application-integrated far memory 路线。应用使用 remoteable data structures，userspace runtime 负责对象移动、调度和隐藏远程访问延迟。优点是掌握对象语义，可减少 page granularity 带来的 read/write amplification；缺点是需要应用集成，透明性降低。二者体现了透明性与性能/语义之间的典型系统权衡。
:::

### 简答题 10：PipeSwitch 与 TGS 分别解决 GPU 共享中的什么问题？

请分别说明 PipeSwitch 和 TGS 的核心方法，以及它们与经典 OS 调度/内存管理思想的关系。

:::tip 答案与解析
PipeSwitch 关注深度学习任务的快速上下文切换。GPU 上切换模型可能要搬运参数、分配显存、初始化任务，开销很大。PipeSwitch 的核心是 pipelined model transmission，把模型传输和执行重叠，并用 unified memory management 和 active-standby worker switching 降低切换延迟。这对应 OS 中“上下文切换 + 预取/流水化”的思想。

TGS 关注容器云中的透明 GPU 共享。它用 adaptive rate control 控制 GPU compute，让 production jobs 受保护，同时把空闲 capacity 给 opportunistic jobs；用 CUDA unified memory 处理 GPU memory oversubscription。它对应 OS 中资源隔离、比例控制和虚拟内存管理思想。
:::

### 简答题 11：Programmed I/O 与 DMA 的优缺点比较

请比较 programmed I/O 和 DMA 在数据移动路径、CPU 开销、适用场景上的区别。

:::tip 答案与解析
Programmed I/O 由 CPU 通过 I/O 指令或 memory-mapped register 逐字节/逐字搬运数据。优点是硬件和控制逻辑简单，适合少量数据或简单设备；缺点是 CPU 开销与数据量成正比，大块传输时浪费处理器时间。

DMA 让 controller 在设备和内存之间直接移动 block。CPU 只负责设置 DMA descriptor、启动传输并处理完成事件。优点是大块 I/O 更高效，CPU 可以并行做其他工作；缺点是硬件和驱动更复杂，要处理内存 pinning、cache coherence、权限和错误恢复。现代高速设备通常依赖 DMA。
:::

### 简答题 12：中断与轮询的取舍

请说明为什么系统不总是使用中断，也不总是使用轮询，并解释 device driver 中 top half 与 bottom half 的职责。

:::tip 答案与解析
中断适合不可预测、低频或需要及时响应的设备事件，因为设备完成时能主动通知 CPU。但中断有上下文切换、保存恢复状态、调度处理等开销；高频事件下中断风暴会拖慢系统。

轮询适合事件很快会到来或设备非常繁忙的场景，可以避免中断开销；缺点是设备空闲时浪费 CPU。高性能系统常混合二者，例如忙时轮询、闲时中断。

驱动 top half 在系统调用路径上，处理 `open/read/write/ioctl`，提交请求并可能让线程睡眠。bottom half 在中断或延后处理路径上，记录完成状态、清理队列、唤醒等待线程。
:::

### 简答题 13：为什么随机磁盘 I/O 远慢于顺序磁盘 I/O？

请从 HDD 延迟组成、磁盘几何结构和控制器优化角度解释随机访问与顺序访问的差异。

:::tip 答案与解析
HDD 延迟包括 queueing time、controller time、seek time、rotational delay 和 transfer time。随机访问经常需要移动磁头并等待目标 sector 转到磁头下方，因此 seek 和 rotation 占主导；顺序访问同一 track 或相邻 track 上连续 block 时，可以去掉大部分 seek/rotation 成本，主要剩 transfer time。

控制器会用 ECC、sector sparing、slip sparing、track skewing 等技术改善可靠性和顺序访问。Track skewing 让相邻 track 的 sector 编号错开，避免磁头移动时错过下一个顺序 sector。SMR 用写入灵活性换容量，也说明磁盘物理特性会影响文件系统设计。
:::

### 简答题 14：SSD 为什么需要 FTL 和 copy-on-write？

请说明 SSD read/write 的基本特性，为什么不能简单原地重写 4 KB page，以及 FTL 解决了什么问题。

:::tip 答案与解析
SSD 没有 seek 和 rotational delay，读通常很快。但 flash 的写入规则是：可以向空 page 写入，却通常只能以更大的 erase block 为单位擦除。若一个 4 KB page 改变就擦除整个大 block，会造成巨大写放大，并影响同 block 中其他有效 page。

FTL 提供逻辑页到物理页的间接映射。写入新版本时，SSD 把数据写到空闲物理页，更新 mapping，让旧页失效，之后通过 garbage collection 回收。这是 copy-on-write 思想。FTL 还支持 wear leveling，把写入分散到不同物理块。它隐藏了 flash 细节，但 OS 和文件系统仍需理解 SSD 写行为对性能的影响。
:::

### 简答题 15：为什么 I/O 高利用率可能危险？

请用排队论直觉说明利用率、突发性、响应时间之间的关系，以及 admission control 能解决什么问题。

:::tip 答案与解析
利用率 `u = lambda * Tser`。在 M/M/1 模型中，平均排队时间包含 `u/(1-u)` 项，因此当利用率接近 1 时，排队延迟会急剧上升。即使平均利用率不高，如果请求到达有突发性，短时间内也可能形成长队列，造成高尾延迟。

队列有两面性：它会增加等待时间，但也能给系统合并、批处理、重排请求的机会。Admission control 的作用是在队列过长或系统接近饱和时限制新请求进入，避免所有请求一起排队变慢。它不能让设备本身变快，但能保护响应时间和稳定性。
:::

### 简答题 16：FIFO、SSTF、SCAN、C-SCAN 的磁盘调度取舍

请比较四种磁盘调度策略在公平性、局部性和饥饿风险上的差异。

:::tip 答案与解析
FIFO 按请求到达顺序服务，公平且简单，但可能造成长 seek，局部性差。SSTF 总选择当前磁头最近的请求，能减少 seek distance，提高局部性；缺点是远处请求可能长期得不到服务，存在饥饿风险。

SCAN 像电梯一样沿一个方向移动并服务请求，到边界后反向，兼顾局部性和饥饿控制。C-SCAN 只朝一个方向服务，到端点后快速回到起点再继续，等待时间在不同磁盘区域间更均匀。选择策略取决于工作负载、延迟目标和公平性要求。
:::

### 简答题 17：`open()` 为什么重要？

请说明文件系统为什么需要 `open()`，以及 file descriptor、open file description、inode/file number 在文件访问路径中的作用。

:::tip 答案与解析
`open()` 把 pathname resolution 从每次 `read/write` 中分离出来。它会从目录树中解析名字，检查权限，找到 file number/inode，并建立进程内 fd 表项和内核中的打开文件状态。这样后续 I/O 可以通过 fd 直接找到对应文件对象，不必每次从根目录重新遍历路径。

File descriptor 是进程 fd 表中的整数索引；open file description 保存打开模式、offset 等打开实例状态；inode 或 file number 标识持久文件对象及其 metadata 和块索引。目录项把名字映射到 file number，打开后记住 file number 而不是 file name，可以避免 rename 等名称变化影响已打开文件的访问语义。
:::

### 简答题 18：FAT 解决了什么问题，局限是什么？

请说明 FAT 如何表示文件块布局，为什么它简单，以及它在随机访问、大目录和局部性上的局限。

:::tip 答案与解析
FAT 用 File Allocation Table 保存每个文件的块链。目录项给出文件起始块，之后沿 FAT 表中的 next 指针找到后续块。这个设计简单，顺序遍历容易，free-space 和文件延长也比较直观。

局限是随机访问第 `k` 个块时通常要沿链走到第 `k` 个块，效率低。FAT 目录常是线性 name-to-file-number entry 列表，大目录查找慢。文件块可能散落在磁盘上，局部性差，顺序 I/O 性能会受影响。它适合简单文件系统，但不适合高性能、大目录和复杂布局需求。
:::

### 简答题 19：Unix inode 的直接/间接指针为什么适合不同大小文件？

请说明 inode 中 direct、single-indirect、double-indirect、triple-indirect 指针的作用，以及这种非对称树结构的优缺点。

:::tip 答案与解析
Unix inode 把文件 metadata 和块指针放在文件对象中。Direct pointers 直接指向数据块，小文件只需少量 metadata 和少量 I/O，访问便宜。文件变大后，single-indirect 指向一个指针块，double-indirect 和 triple-indirect 继续扩展寻址范围。

优点是小文件高效，大文件也能扩展，不要求文件物理连续。目录项只保存 name 到 inode number 的映射，因此 hard link 很自然。缺点是访问很大的偏移可能需要多次间接块读取，随机访问成本比 direct block 高；metadata 结构也比简单链表复杂。
:::

### 简答题 20：FFS 的 block group 和保留空闲空间解决什么问题？

请说明 Berkeley FFS 如何改善早期 Unix 文件系统的局部性，并指出这些优化的代价。

:::tip 答案与解析
FFS 用 block group 把相关 inode、目录和数据块尽量放在同一局部区域，减少 seek。它使用 bitmap allocation，更容易找到连续或接近连续的空闲块；保留一定比例空闲空间，让 allocator 有选择余地，避免磁盘接近满时碎片严重。FFS 还结合 read-ahead、旋转延迟等机制提升顺序访问。

代价是实现更复杂，需要维护更多布局策略。保留空闲空间意味着可用容量减少。块级分配对极小文件可能浪费空间。早期依赖具体磁盘几何的优化在现代设备上也未必完全适用，但“围绕设备特性优化布局”的思想仍然重要。
:::

### 简答题 21：Hard link 与 symbolic link 的区别

请比较 hard link 和 symbolic link 在文件对象、跨文件系统、悬空链接、路径遍历权限检查上的差异。

:::tip 答案与解析
Hard link 是多个目录项指向同一个 inode/file number，多个名字共享同一文件对象和数据。它通常不能跨文件系统，因为 inode number 只在同一文件系统内有意义。只要还有 hard link，文件对象就仍可存在。

Symbolic link 是一个保存路径字符串的特殊文件，解析时再跟随该路径。它可以跨文件系统，也可以指向目录或不存在的目标，因此可能悬空。路径遍历时，系统不仅检查最终文件权限，也要检查中间目录的搜索/执行权限；跟随 symbolic link 会引入额外路径解析和安全边界问题。
:::

### 简答题 22：NTFS 的 MFT、resident data 与 extents 的权衡

请说明 NTFS 如何围绕 MFT 组织文件，resident data 和 extents 分别解决什么问题，灵活 attribute 设计有什么代价。

:::tip 答案与解析
NTFS 围绕 Master File Table 组织，每个文件都有 MFT record。小文件数据可以 resident 在 MFT record 内，这样读取小文件时不需要额外数据块访问，metadata 和 data 局部性好。

较大文件用 extents 描述连续块范围，适合基本连续的文件，metadata 比逐块指针更紧凑。超大或高度碎片化文件可以通过 attribute list 溢出到额外 MFT record。优点是表达灵活，能处理小文件、大文件和碎片化文件；缺点是实现复杂，metadata 解析路径更长，极端碎片化时也会增加管理开销。
:::

### 简答题 23：`mmap()` 与普通 `read/write` 的区别

请说明 memory-mapped file 如何用 paging 实现，`MAP_SHARED` 的含义是什么，以及它和普通 `read/write` 在使用方式上的区别。

:::tip 答案与解析
`mmap()` 把文件的一段内容映射到进程虚拟地址空间。最初页面可不驻留；访问映射区域时发生 page fault，OS 从文件读取对应页面，更新页表。之后程序用普通 load/store 访问文件内容，而不是显式调用 `read/write`。

`MAP_SHARED` 表示多个进程映射同一文件时可通过文件共享修改，写入映射页会影响底层文件语义。不同进程不需要映射到同一虚拟地址。与 `read/write` 相比，`mmap` 适合随机访问、共享和把文件当内存数据结构使用；但它也带来 page fault、同步落盘时机、可见性和错误处理等复杂性。
:::

### 简答题 24：Buffer cache、prefetching 与 delayed writes 的优缺点

请说明 buffer cache 缓存什么，为什么 LRU 在顺序扫描时可能失败，以及 prefetching 和 delayed writes 的主要取舍。

:::tip 答案与解析
Buffer cache 缓存 disk blocks、inode、directory blocks、free maps、name translations 等内核资源。重复 `open/read/write` 可命中缓存，减少磁盘访问。LRU 通常利用时间局部性，但一次性顺序扫描会把有价值的热点块挤出缓存；因此系统可用 Use Once 等策略快速丢弃 streaming blocks。

Prefetching/read-ahead 对顺序访问有帮助，但预测错误或预取过多会浪费带宽和缓存。Delayed writes 能合并写入、改善布局、减少同步等待，但会制造崩溃窗口：dirty data 或 dirty metadata 尚未落盘时，系统崩溃可能导致数据丢失或不一致。
:::

### 简答题 25：RAID、Erasure Coding 与可靠性指标

请区分 availability、durability、reliability，并说明 RAID 1、RAID 5、RAID 6/erasure coding 各自能解决什么问题，不能解决什么问题。

:::tip 答案与解析
Availability 是系统当前能接受并处理请求的能力；durability 是数据在故障后仍然存活；reliability 是一段时间内系统正确执行功能的概率。三者相关但不等价。

RAID 1 镜像数据，读可从任一副本读取，能容忍单盘失败但写要更新副本。RAID 5 使用 XOR parity，通常容忍一块磁盘失败，并节省空间。RAID 6 或 Reed-Solomon erasure coding 能容忍更多失败，适合更大磁盘和更高故障风险。

这些方法解决块级丢失或磁盘故障问题，但不能保证文件系统 crash consistency。如果崩溃前已经把不一致 metadata 写到多个副本，RAID 可能只是可靠地保存坏状态。
:::

### 简答题 26：Careful ordering 与 Copy-on-Write 的可靠性思路

请比较 careful ordering 和 copy-on-write 如何保证文件系统多块更新在崩溃后可恢复。

:::tip 答案与解析
Careful ordering 通过规定安全写入顺序来限制崩溃后的坏状态。例如同时写 data 和 pointer 时，通常先写 data，最后写 pointer。没有 pointer 指向的新 data 可以被 recovery 清理；但 pointer 指向未初始化 data 更危险。它的代价是需要严格排序和 recovery 工具，`fsck` 可能要扫描大量 metadata。

Copy-on-write 不覆盖旧版本，而是先写新版本的数据和 metadata，最后原子切换根指针或上层 pointer。崩溃后要么仍看到旧完整版本，要么看到新完整版本，恢复更简单。代价是写放大、空间管理和垃圾回收更复杂。
:::

### 简答题 27：Journaling 文件系统的恢复规则

请说明 journaling 创建文件这类多步操作时，log、commit record、replay/discard 分别起什么作用，以及为什么很多系统只 journal metadata。

:::tip 答案与解析
Journaling 把多步更新先写入 durable log。事务中的记录描述需要修改的 metadata 或 data；commit record 表示这些记录形成一个完整事务。崩溃恢复时，没有 commit 的 partial transaction 可以丢弃，因为它没有承诺生效；有 commit 的 transaction 必须 replay 或保证其效果保留。

许多文件系统只 journal metadata，因为 metadata 决定文件系统结构一致性，例如目录项、inode、free map。只 journal metadata 开销更低，但用户数据本身可能有不同的持久性语义；例如文件大小和目录结构一致，并不意味着应用刚写入的所有数据都已安全落盘。
:::

### 简答题 28：Two-Phase Commit 解决什么，不能解决什么？

请说明 2PC 的正常流程、worker 为什么要记录 vote，以及 coordinator failure 时为什么 READY worker 可能 blocking。

:::tip 答案与解析
2PC 解决的是分布式参与者最终在 commit 或 abort 上达成一致，而不是保证 simultaneous action。第一阶段 coordinator 询问所有 workers 是否能提交；worker 若能提交，必须把 `VOTE-COMMIT` 记录到 stable storage，再回复。第二阶段 coordinator 只有收到 unanimous `VOTE-COMMIT` 才决定 commit，否则 abort，并把决定通知所有 workers。

Worker 记录 vote 是因为投 commit 后就承诺自己可以完成事务，崩溃恢复后不能随意改变主意。若 worker 已进入 READY 状态，而 coordinator failure，它不能直接 abort，因为最终决定可能已经是 commit，并且其他 worker 可能已经收到 commit。因此 2PC 简洁有效，但代价是 blocking。
:::

### 简答题 29：Dedup 与 IOFlow 的核心方法

请分别说明 FAST'08 Dedup 和 SOSP'13 IOFlow 解决的具体问题，以及它们的核心方法。

:::tip 答案与解析
Dedup 解决备份系统中的重复数据存储和 fingerprint index 磁盘瓶颈。Deduplication 是跨许多文件的 global compression，不只是单文件局部压缩。核心方法包括 fingerprinting 识别重复块，用 summary vectors 减少不必要的磁盘 index lookup，用 stream-informed layout 和 LPC 保留重复局部性。

IOFlow 解决多租户存储中缺少集中策略控制的问题。它把 storage data-plane enforcement 和 control-plane policy logic 分离，用 storage flow 描述 `<{VMs}, {File Operations}, {Files}, {Shares}> -> SLA`，并用 cost-based rate limiting 和 controller-based max-min fair sharing 实现更合理的隔离和共享。它不是简单按 bytes 或 IOPS 限速。
:::

### 简答题 30：GFS、EC-Cache 与 Chord 的核心方法

请分别用简洁语言说明 GFS、EC-Cache 和 Chord 各自解决的核心问题与核心方法，不需要写具体实验细节。

:::tip 答案与解析
GFS 面向 frequent failures、huge files、appends 和 high sustained bandwidth。核心方法是 single master 管 metadata，chunkservers 管 data，用大 chunk 减少 metadata 压力，并用 primary lease 对写入 modifications 排序，让 replicas 按同一顺序执行。它牺牲部分 POSIX 语义来适配大规模分布式工作负载。

EC-Cache 把 erasure coding 用于 cluster cache，不主要是长期容灾，而是 load balancing 和 tail latency。它把对象编码成 `k+r` 个 units，读时可请求 `k+Delta` 个并使用最先到达的 `k` 个，减少慢节点对尾延迟的影响。

Chord 解决 P2P 环境中的 scalable lookup。它把 nodes 和 keys 映射到同一 circular ID space，key 放在 successor 上；finger table 使用指数间隔指针，使 lookup 在理想情况下达到 `O(log N)` hops。
:::
