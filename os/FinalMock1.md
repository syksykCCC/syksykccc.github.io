# 期末考试模拟试题 FinalMock1

## 试卷说明

- 题型：单项选择题 50 题。
- 覆盖范围：Lec1 到 Lec24。Lec1-Lec13 约占较少比例，Lec14-Lec24 占主要比例。
- 每题后均用折叠框给出答案与解析。解析按简答题思路展开基本概念、实现细节、discussion 权衡、具体 API 与补充论文核心思想。

## 一、选择题

### 选择题 1：操作系统的角色

下列哪一项最准确地概括了操作系统在课程中的三种核心角色？

A. 操作系统主要是用户界面，负责窗口、菜单和命令行交互。  
B. 操作系统是所有系统软件的总称，包括编译器、数据库和浏览器。  
C. 操作系统位于应用与硬件之间，既提供抽象和公共服务，也通过保护机制协调共享资源。  
D. 操作系统的主要目标是让应用直接访问所有硬件，以获得最高性能。

:::tip 答案与解析
**答案：C**

课程中 OS 的心智模型是 **Referee + Illusionist + Glue**。Referee 负责保护、隔离、公平共享；Illusionist 把物理资源虚拟化成进程、地址空间、文件等抽象；Glue 提供文件系统、IPC、网络等公共服务。OS 不等于 UI，也不等于任意系统软件；它的关键在于受控硬件访问、资源管理和保护边界。
:::

### 选择题 2：Thread、Address Space、Process 与 Dual Mode

关于四个基础 OS 概念，下列说法正确的是：

A. Thread 拥有独立地址空间，因此同一进程的不同线程默认不能共享 heap。  
B. Process 通常包含地址空间、一个或多个线程，以及打开文件等 OS 管理状态。  
C. Dual mode 只是软件约定，用户程序只要愿意就能直接执行特权指令。  
D. Address space 指真实物理 DRAM 中连续的一段空间。

:::tip 答案与解析
**答案：B**

Thread 是可调度的执行上下文，包含 PC、寄存器、栈等状态；Address space 是进程可见的虚拟地址集合；Process 是受保护的执行环境，封装地址空间、线程和 OS 状态；Dual mode 由硬件强制用户态/内核态分离，限制特权操作和地址转换元数据访问。
:::

### 选择题 3：`pthread_create` 与 `fork`/`exec`

下列关于线程与进程 API 的说法正确的是：

A. `pthread_create` 创建的线程默认拥有完全独立的全局变量和 heap。  
B. `exec` 会复制当前进程，并让父子进程从同一位置继续执行。  
C. `fork` 创建子进程，`exec` 替换当前进程映像，`wait` 让父进程回收子进程状态。  
D. `pthread_join` 的语义是立即杀死目标线程并释放其栈。

:::tip 答案与解析
**答案：C**

同一进程内的线程共享地址空间、heap、全局变量和打开文件，但每个线程有私有寄存器和栈。`fork()` 复制当前进程，父子返回值不同；`exec()` 用新程序替换当前进程映像，成功后通常不回到旧代码；`wait()` 等待并回收子进程。`pthread_join` 是等待目标线程结束并取得返回值，不是杀死线程。
:::

### 选择题 4：文件描述符与 open file description

进程执行 `fd = open("x", O_RDONLY)`，随后 `read(fd, ..., 100)`。接着 `fork()`，若子进程先 `read(fd, ..., 50)`，父进程之后再 `read(fd, ..., 50)`，下列说法正确的是：

A. 父子进程的 fd 指向不同 open file description，因此父进程仍从 offset 100 读。  
B. 父子进程共享同一个 open file description，因此父进程会从 offset 150 继续读。  
C. `fork()` 会自动关闭父进程中的 fd，避免共享 offset。  
D. `read` 不会改变任何内核状态，offset 只保存在用户缓冲区中。

:::tip 答案与解析
**答案：B**

`open` 返回进程 fd 表中的整数项，该项指向内核 open file description。`fork` 会复制 fd 表，父子表项别名到同一个 open file description，因此 offset 共享。`read/write` 推进的是 open file description 中的 offset，而不是某个 fd 私有的 offset。
:::

### 选择题 5：Pipe、Socket 与建连

关于 POSIX pipe 与 TCP socket，下列说法正确的是：

A. pipe 的最后一个写端关闭后，读端最终会读到 EOF。  
B. pipe 的最后一个读端关闭后，写端继续写入一定会静默成功。  
C. `accept()` 返回的仍是原监听 socket，因此服务器不能同时保留监听能力。  
D. TCP 连接只由目的 IP 和目的端口两个字段标识。

:::tip 答案与解析
**答案：A**

Pipe 是内核中的单向有界队列。最后一个写端关闭后，读端可读到 EOF；最后一个读端关闭后，写端会触发 `SIGPIPE`，或在信号被处理/忽略时让 `write` 返回 `EPIPE`。TCP 服务器用 `socket -> bind -> listen -> accept`，`accept` 返回新的连接 socket，监听 socket 继续负责后续连接。TCP 连接通常由五元组标识。
:::

### 选择题 6：有界缓冲区信号量顺序

生产者-消费者有界缓冲区中，生产者的正确信号量模板通常是：

A. `P(mutex) -> P(emptySlots) -> Enqueue -> V(fullSlots) -> V(mutex)`  
B. `P(emptySlots) -> P(mutex) -> Enqueue -> V(mutex) -> V(fullSlots)`  
C. `P(fullSlots) -> P(mutex) -> Enqueue -> V(mutex) -> V(emptySlots)`  
D. `P(mutex) -> Enqueue -> P(emptySlots) -> V(fullSlots) -> V(mutex)`

:::tip 答案与解析
**答案：B**

生产者必须先确认有空槽 `P(emptySlots)`，再进入保护队列元数据的临界区 `P(mutex)`。如果先拿 `mutex` 再等待资源计数，线程可能持锁阻塞，使真正能改变条件的消费者无法进入队列临界区，导致停滞或死锁。消费者对称地使用 `P(fullSlots) -> P(mutex) -> Dequeue -> V(mutex) -> V(emptySlots)`。
:::

### 选择题 7：Mesa 管程与条件变量

在 Mesa 语义的管程中，为什么 `cond_wait` 外通常要用 `while` 而不是 `if`？

A. 因为 `signal` 会立即把锁转交给被唤醒线程，所以必须循环等待。  
B. 因为被唤醒线程重新获得锁时，条件可能已被其他线程改变。  
C. 因为条件变量会保存历史信号，`while` 用来清空计数。  
D. 因为 `cond_wait` 不会释放管程锁。

:::tip 答案与解析
**答案：B**

Mesa 语义下，`signal` 只是把等待线程移回 ready queue，发信号线程继续运行。等待线程真正重新获得锁时，谓词可能已经不成立，所以必须用 `while (condition_not_true) wait(...)` 重新检查。`cond_wait` 的关键语义是原子释放锁并睡眠；条件变量本身不保存历史信号，这也区别于信号量。
:::

### 选择题 8：读者/写者管程

写者优先的读者/写者管程中，读者入口常在 `(AW + WW) > 0` 时等待。这个设计的主要效果是：

A. 保证读者永不饥饿。  
B. 允许写者与任意数量读者同时访问数据库。  
C. 阻止新读者持续插队，从而改善写者进展，但可能让读者饥饿。  
D. 让条件变量等价于计数信号量。

:::tip 答案与解析
**答案：C**

`AR/WR/AW/WW` 分别表示活跃读者、等待读者、活跃写者、等待写者数量。写者优先策略在存在等待写者时阻止新读者进入，避免写者被读者流淹没；代价是写请求连续到达时，读者可能等待无上界。单条件变量常需要 `broadcast`，双条件变量可更定向唤醒。
:::

### 选择题 9：调度策略与目标

下列调度策略与目标的匹配最准确的是：

A. RR 天然保证所有硬实时 deadline，只要时间片足够小。  
B. SRTF 在已知未来 CPU burst 时有利于平均完成时间，但可能导致长作业饥饿。  
C. CFS 通过绝对 deadline 排序，因此比 EDF 更适合实时系统。  
D. 严格优先级调度不会发生饥饿，因为高优先级任务总能先运行。

:::tip 答案与解析
**答案：B**

SRTF 选择剩余工作量最短的任务，若未来 burst 可知，能优化平均完成时间，但短任务持续到达会让长任务饥饿。RR 改善响应性和等待公平，但不能直接保证 deadline。EDF 按绝对截止期调度，并可用 $\sum C_i/D_i \le 1$ 做可调度性判断。CFS 追踪虚拟运行时间，目标是比例公平。
:::

### 选择题 10：死锁、检测与 Banker

下列说法中错误的是：

A. 死锁的四个必要条件包括互斥、持有并等待、不可抢占和环形等待。  
B. 多实例资源分配图中出现环，不一定已经死锁。  
C. Banker 算法只在试探分配后仍存在安全序列时批准请求。  
D. 只要系统处于 unsafe state，就已经存在无法恢复的死锁环。

:::tip 答案与解析
**答案：D**

Unsafe state 不是 deadlocked state。Unsafe 表示系统尚未死锁，但可能演化到无论如何都无法满足所有最大需求的状态；deadlocked state 则已经有线程集合无法推进。Banker 是避免策略，事前检查安全态；死锁检测是事后识别当前是否已有无法完成的等待集合。
:::

### 选择题 11：现代调度论文与公平性

下列论文思想配对正确的是：

A. DRF 通过均衡每个用户的 dominant share 处理多资源公平。  
B. Tiresias 只按 wall-clock waiting time 度量深度学习作业年龄，忽略 GPU 数量。  
C. FairRide 同时无条件满足 strategy-proofness、isolation guarantee 和 Pareto efficiency。  
D. ZygOS 的核心结论是尾延迟问题完全不受排队结构影响。

:::tip 答案与解析
**答案：A**

DRF 把用户占比最高的资源称为 dominant resource，并均衡 dominant share。Tiresias 使用 `#GPUs * executed time` 的 2D attained service，更适合多 GPU 作业。FairRide 展示了策略无关、隔离保证与 Pareto 效率之间的权衡，会牺牲一部分 Pareto efficiency。ZygOS 强调低开销 dataplane、work stealing 和尾延迟下的排队结构影响。
:::

### 选择题 12：Base-and-Bound、Segmentation 与 Paging

关于内存虚拟化机制，下列说法正确的是：

A. Base-and-bound 可以支持任意稀疏地址空间且不会有碎片问题。  
B. Segmentation 使用固定大小页，因此不会发生 external fragmentation。  
C. Paging 使用固定大小页框，虚拟地址和物理地址中的页内 offset 保持不变。  
D. Paging 要求每个进程的虚拟连续页面在物理内存中也连续。

:::tip 答案与解析
**答案：C**

Base-and-bound 简单，但扩展性差，难以支持复杂共享和稀疏增长。Segmentation 以可变长逻辑段为单位，容易产生 external fragmentation。Paging 用固定大小页和页框映射，缓解 external fragmentation，但可能有 internal fragmentation；转换规则是 `VA=(VPN, offset)`，`PA=(PPN, offset)`。
:::

### 选择题 13：分页地址转换

假设页大小为 4 KB，虚拟地址 `0x12345` 的 VPN 对应 PTE 映射到物理页号 `0x9A`。若访问合法，则物理地址是：

A. `0x9A12345`  
B. `0x123459A`  
C. `0x9A345`  
D. `0x129A45`

:::tip 答案与解析
**答案：C**

4 KB 页大小意味着 offset 为低 12 位。`0x12345` 的 offset 是 `0x345`，VPN 是 `0x12`。PTE 把 VPN 映射到 PPN `0x9A`，所以物理地址为 `(0x9A << 12) | 0x345 = 0x9A345`。分页转换中页内偏移原样复制。
:::

### 选择题 14：多级/倒排页表与 TLB

关于多级页表、倒排页表和 TLB，下列说法正确的是：

A. 多级页表的主要优势是减少稀疏地址空间中未使用区域的页表内存。  
B. 多级页表消除了每次地址转换中的所有额外内存访问，因此不再需要 TLB。  
C. 用户进程可以直接修改页表以加速地址转换。  
D. TLB 缓存文件数据块，而不是地址转换结果。

:::tip 答案与解析
**答案：A**

多级页表按需分配页表页，适合稀疏地址空间，也支持页级或子树级共享；代价是一次 TLB miss 后可能要多次内存访问完成 page-table walk。倒排页表则从物理页框反查 `<process, VPN>`，节省空间但查找更复杂，常要哈希。TLB 很关键，它缓存 VPN 到 PPN 及权限等翻译结果。页表是保护边界的一部分，用户进程不能任意修改。
:::

### 选择题 15：Cache 与写策略

关于缓存和写策略，下列说法正确的是：

A. Write-through 会把每次写都立即传播到下层，因此不需要考虑下层写流量。  
B. Write-back 可合并同一块的多次写，但需要 dirty bit，替换脏块时可能先写回。  
C. 直接映射 cache 没有 conflict miss。  
D. AMAT 只取决于 hit time，与 miss rate 无关。

:::tip 答案与解析
**答案：B**

Write-through 简单，但写流量可能很高。Write-back 把修改留在缓存中并标记 dirty，重复写同一块可减少下层访问；但替换脏块时要写回，复杂度更高。AMAT 常写作 `HitTime + MissRate * MissPenalty`。直接映射 cache 更容易发生 conflict miss。
:::

### 选择题 16：Page Fault 处理流程

一次可恢复的 demand paging page fault 发生后，OS 的合理处理顺序是：

A. 直接终止进程，因为所有 invalid PTE 都表示非法访问。  
B. 验证访问合法性，定位 backing store，获得页框，必要时写回 victim，读入缺失页，更新 PTE/TLB，并重启指令。  
C. 先把整个可执行文件读入内存，再重启机器。  
D. 把 fault 当作异步中断，忽略 faulting instruction。

:::tip 答案与解析
**答案：B**

Page fault 是同步 trap。Invalid PTE 可能表示非法访问，也可能表示合法页面尚未驻留。若可恢复，OS 会通过 backing-store metadata 定位磁盘位置，获得 free frame 或选择 victim，脏 victim 先写回，再读入缺失页，更新页表并处理 TLB consistency，最后重启原指令。Protection fault 与 demand-paging fault 的结果不同。
:::

### 选择题 17：缺页率与性能

讲义示例中，内存命中时间约 `200 ns`，page fault 代价约 `8,000,000 ns`。若缺页率 `p=1/1000`，最合理的判断是：

A. 平均访问时间约 `208 ns`，性能几乎不变。  
B. 平均访问时间约 `8,200 ns`，相比 `200 ns` 慢约 41 倍。  
C. 平均访问时间小于 `200 ns`，因为 demand paging 提高局部性。  
D. 只要 TLB 命中，page fault 代价可以忽略。

:::tip 答案与解析
**答案：B**

按 `EAT = 200ns + p * 8,000,000ns`，当 `p=0.001` 时，额外代价是 `8,000ns`，总 EAT 约 `8,200ns`。这说明很小的 page-fault rate 也可能造成巨大 slowdown。若希望 slowdown 小于 10%，示例中需要 `p < 2.5 * 10^-6`。
:::

### 选择题 18：页面替换策略

关于 FIFO、MIN 与 LRU，下列说法正确的是：

A. MIN 使用过去访问历史，因此比 LRU 更容易实现。  
B. FIFO 满足 stack property，所以增加页框数一定不会增加 fault。  
C. LRU 替换最长时间未使用的页面，MIN 替换未来最晚再使用的页面。  
D. Bélády anomaly 说明所有替换策略在增加页框时都可能增加 fault。

:::tip 答案与解析
**答案：C**

MIN 需要知道未来引用，理论最优但不可在线实现。LRU 用过去的 recency 近似 MIN，并满足 stack property，因此不会出现 Bélády anomaly。FIFO 替换最早进入内存的页面，不满足 stack property，可能出现增加页框反而 fault 更多的现象。
:::

### 选择题 19：Clock 与 Second-Chance

Clock 页面替换算法中，clock hand 扫到一个页面时，若 `use bit = 1`，通常会：

A. 立即淘汰该页面。  
B. 清零 use bit，并给它第二次机会，然后继续扫描。  
C. 把页面写入 TLB，并终止算法。  
D. 说明该页面一定是 dirty page，必须立刻写回。

:::tip 答案与解析
**答案：B**

Clock 用环形列表和 use bit 近似 LRU。`use=1` 表示近期被引用，算法清零并跳过；`use=0` 才是可替换候选。N-th chance Clock 要求页面经历多轮未使用后再淘汰。Dirty page 常获得额外保护，因为淘汰前需要写回，OS 可以先启动异步 pageout。Second-chance list 可用保护位制造轻量 fault 来更新 OS 元数据；真正淘汰物理页框时还要通过 coremap/reverse mapping 找到并失效所有相关 PTE。
:::

### 选择题 20：Thrashing 与 Working Set

下列关于 thrashing 与 working-set model 的说法正确的是：

A. 当所有进程 working set 总和 `D` 大于物理页框数 `m` 时，系统容易 thrash。  
B. Thrashing 表示 CPU 利用率极高且几乎没有 page fault。  
C. Swap out 一个进程一定会降低系统吞吐，因此不能作为缓解手段。  
D. Working set 是进程启动以来访问过的全部页面集合。

:::tip 答案与解析
**答案：A**

Working set 是最近窗口 `Delta` 内活跃使用的页面集合。如果所有进程的 working set 总需求超过可用页框，系统可能频繁换页，磁盘 paging 主导执行，CPU 有效进展很少。Page-fault frequency allocation 可动态调节页框；在全局 thrashing 时，暂停或换出部分进程反而可能提升整体性能。
:::

### 选择题 21：FaRM

关于 FaRM，下列说法最准确的是：

A. FaRM 的核心是把远程内存当作传统磁盘 swap 使用，对应用完全隐藏分布式结构。  
B. FaRM 使用 RDMA、共享地址空间、locality-aware placement、lock-free reads 和 transactions 实现高速分布式内存计算。  
C. FaRM 主要解决 LLM KV cache 的连续内存碎片问题。  
D. FaRM 的目标是用 RAID parity 提升磁盘可用性。

:::tip 答案与解析
**答案：B**

FaRM 使用 RDMA read/write 让机器高效读写远端内存，并提供分布式共享地址空间。共享地址空间让编程更像直接访问对象，但还需要 locality-aware placement、事务和 lock-free reads 来处理并发、局部性和一致性。它不是透明 swap，也不是 LLM serving 或磁盘 RAID 系统。
:::

### 选择题 22：vLLM 与 PagedAttention

PagedAttention 的核心贡献是：

A. 用固定大小 KV blocks、block table、按需分配、共享和 copy-on-write 虚拟化 LLM KV cache。  
B. 用 EDF 调度所有 GPU kernel，从而保证每个请求的硬 deadline。  
C. 把 KV cache 全部放入 CPU 磁盘 swap，避免使用 GPU memory。  
D. 用 RAID 5 parity 保护模型参数。

:::tip 答案与解析
**答案：A**

vLLM/PagedAttention 把 KV cache 管理变成 OS 风格的分页问题：KV blocks 像 pages，block table 像 page table，按需分配减少碎片，prefix sharing 和 copy-on-write 支持 sampling/beam search，preemption 后可用 recomputation recovery。它的核心不是一般 GPU 优化，而是 KV cache memory virtualization。
:::

### 选择题 23：Infiniswap

关于 Infiniswap，下列说法正确的是：

A. 它要求应用重写为 remoteable data structures，完全放弃内核 swap 路径。  
B. 它通过 swap-like block device、RDMA、slabs 和 power of two choices 实现透明 remote paging。  
C. 它主要通过 primary lease 序列化文件写入。  
D. 它只适用于本地 DRAM，不涉及网络。

:::tip 答案与解析
**答案：B**

Infiniswap 是 OS-level remote paging over RDMA。它把远程空闲内存暴露成类似 swap 的 block device，使用 daemon 管理远程内存，按 slab 扩展，并用 power of two choices 做远端选择和负载均衡。它更透明，但应用语义少于 AIFM，因此在 prefetch 和对象粒度控制上受限。
:::

### 选择题 24：AIFM

AIFM 批评传统 far-memory 系统的核心理由是：

A. OS 只能看到 page，缺少应用对象语义，容易造成 read/write amplification 和 prefetch 困难。  
B. 所有远程内存系统都必须使用 spinning disk，因此延迟不可接受。  
C. 应用级运行时无法在用户态调度，因此不能隐藏远程访问延迟。  
D. 只要使用 RDMA，就不需要考虑对象布局和缓存。

:::tip 答案与解析
**答案：A**

AIFM 是 application-integrated far memory。它认为纯 OS page 粒度存在 semantic gap：OS 不知道应用对象结构，可能搬运不需要的数据，也难以准确预取。AIFM 用 remoteable data structures、userspace runtime、pauseless evacuator 和 remote agent 把对象移动与调度放到更懂应用语义的位置，代价是透明性下降。
:::

### 选择题 25：PipeSwitch 与 TGS

下列配对正确的是：

A. PipeSwitch：通过流水化模型传输与执行、unified memory management、active-standby worker switching 实现深度学习任务快速上下文切换。  
B. TGS：通过把所有 GPU 内存静态隔离，禁止 opportunistic jobs 使用空闲资源。  
C. PipeSwitch：主要用于文件系统 journaling。  
D. TGS：只管理 GPU compute，不处理 GPU memory oversubscription。

:::tip 答案与解析
**答案：A**

PipeSwitch 面向深度学习应用上下文切换，核心是把 model transmission 和 execution 重叠，并用 active-standby worker switching 降低切换时间。TGS 面向容器云 GPU 共享，用 adaptive rate control 管 compute，用 CUDA unified memory 处理 GPU memory，让 production jobs 受保护，同时利用空闲 capacity 运行 opportunistic jobs。
:::

### 选择题 26：现代内存论文的横向权衡

关于 Lec18 几篇论文的共同教训，下列说法正确的是：

A. 应用语义越多，通常越容易做精确 prefetch、sharing 或 recomputation，但系统透明性和采用成本会下降/上升。  
B. 完全透明的 OS-level 机制总是比 application-integrated 机制性能更好。  
C. 所有论文都使用同一种“远程内存”抽象，因此可以互换实现。  
D. Copy-on-write 只在传统 `fork()` 中有意义，不会出现在 LLM serving 或文件系统之外。

:::tip 答案与解析
**答案：A**

这些论文反复映射到经典 OS 内存思想：paging、virtualization、sharing、copy-on-write、replacement、preemption、fault isolation。Infiniswap 更透明但语义少；AIFM 和 vLLM 更懂对象/KV block，因此能更好地共享、预取或重算，但需要运行时或 API 集成。不同“远程/虚拟内存”系统不能混为一谈。
:::

### 选择题 27：I/O 系统与设备驱动

面对大量不同设备，OS 标准化接口的典型方式是：

A. 让应用直接操作每个设备的私有寄存器。  
B. 通过 controller、device driver 和通用系统调用接口，把 `open/read/write/ioctl` 翻译成设备特定操作。  
C. 禁止设备使用 DMA，只允许 CPU 逐字节搬运。  
D. 要求所有设备都模拟成完全相同的磁盘。

:::tip 答案与解析
**答案：B**

应用和上层内核子系统使用通用接口，例如 `open`、`read`、`write`、`seek`、`ioctl` 或 socket。设备驱动在内核中与具体 controller 交互，把这些操作翻译成寄存器读写、队列提交、DMA 命令和中断处理。驱动常分 top half 和 bottom half：top half 位于系统调用路径上并可能让线程睡眠，bottom half 处理中断完成、记录状态并唤醒等待者。Memory-mapped I/O 可把设备寄存器映射到物理地址空间，但仍由保护机制控制访问。
:::

### 选择题 28：Programmed I/O、DMA、中断与轮询

下列说法正确的是：

A. Programmed I/O 让 controller 直接搬运整块数据，CPU 完全不参与。  
B. DMA 让 controller 在设备和内存之间搬运 block，CPU 主要负责设置传输和处理完成事件。  
C. 中断在所有情况下都比轮询便宜。  
D. 轮询不会消耗 CPU，因此适合设备长期空闲的场景。

:::tip 答案与解析
**答案：B**

Programmed I/O 由 CPU 通过 I/O 指令或 memory-mapped register 逐字节/逐字传输，简单但 CPU 成本与数据大小成正比。DMA 让 controller 直接搬运数据块。完成事件可通过中断或轮询发现：中断适合不可预测事件但有开销，轮询适合很快完成的高性能设备路径，但空闲时浪费 CPU。
:::

### 选择题 29：设备接口与时序语义

关于设备接口和 I/O 时序，下列说法正确的是：

A. Block devices 通常按块访问，network devices 通常有独立 socket 接口。  
B. Character devices 必须支持随机访问任意 block。  
C. Non-blocking I/O 与 asynchronous I/O 完全相同，都表示调用线程一直睡眠到完成。  
D. Blocking I/O 一定不会让线程进入等待队列。

:::tip 答案与解析
**答案：A**

块设备面向 block 读写，可支持文件系统或 raw I/O；字符设备更像字节流；网络设备与 block/character 差异大，常通过 socket interface 暴露。Blocking I/O 会等待完成，可能睡眠；non-blocking I/O 若不能立即完成会快速返回；asynchronous I/O 是先提交请求，之后通过通知或轮询完成状态。
:::

### 选择题 30：HDD 延迟模型

关于机械磁盘性能，下列说法正确的是：

A. 随机读和同 track 顺序读通常性能相同，因为二者传输同样字节数。  
B. 磁盘延迟可分解为 queueing、controller、seek、rotation 和 transfer 等部分。  
C. 7200 RPM 磁盘一圈约 1 ms，平均旋转延迟约 0.5 ms。  
D. Track skewing 会故意让顺序读取每换一条 track 都等待一整圈。

:::tip 答案与解析
**答案：B**

HDD 随机访问常被 seek 和 rotational delay 主导；顺序访问可摊掉这些成本，因此快很多。7200 RPM 一圈约 8 ms，平均旋转延迟约 4 ms。Track skewing 让相邻 track 的 sector 编号偏移，使磁头移动后能接上顺序读取，避免损失一整圈。
:::

### 选择题 31：SSD、FTL 与 Copy-on-Write

关于 SSD，下列说法正确的是：

A. SSD 没有 seek 和旋转延迟，但写入复杂，因为 flash 可写空 page，却要按更大 erase block 擦除。  
B. SSD 可以原地覆盖任意 4 KB page，因此不需要映射层。  
C. FTL 的作用是把所有逻辑页固定绑定到永不变化的物理页。  
D. Wear leveling 会把所有写入集中到同一块，以提升局部性。

:::tip 答案与解析
**答案：A**

SSD 读快且没有机械定位延迟，但写入要面对 erase-before-write。Flash Translation Layer 使用间接层，把新版本写到 free page，更新 logical-to-physical mapping，旧页后续由 garbage collection 回收。这是 copy-on-write 思路，也支持 wear leveling，把写入分散到不同物理块。
:::

### 选择题 32：排队论计算

某磁盘请求到达率 `lambda = 10/s`，平均服务时间 `Tser = 20 ms`。按 M/M/1，利用率与平均排队时间分别约为：

A. `u = 0.02`，`Tq = 0.5 ms`  
B. `u = 0.2`，`Tq = 5 ms`  
C. `u = 2`，`Tq = 5 ms`  
D. `u = 0.2`，`Tq = 25 ms`

:::tip 答案与解析
**答案：B**

利用率 `u = lambda * Tser = 10 * 0.02 = 0.2`。M/M/1 中 `Tq = Tser * u/(1-u) = 20ms * 0.2/0.8 = 5ms`，response time 约为 `25ms`。Little's law 给出 `Lq = lambda * Tq = 10 * 0.005 = 0.05`。
:::

### 选择题 33：I/O 性能优化

关于 I/O 性能优化，下列说法正确的是：

A. 只要平均利用率低，就不可能出现高尾延迟。  
B. 队列只会伤害性能，从不可能帮助吞吐或局部性。  
C. 优化可包括提升组件速度、增加并行性、重叠 I/O 与计算、批处理/重排序，以及队列过长时 admission control。  
D. 当利用率接近 1 时，排队延迟会自然下降。

:::tip 答案与解析
**答案：C**

I/O response time 包括软件路径、排队、controller 和设备服务时间。突发性会让平均利用率不高的系统仍有高延迟；当 `u` 接近 1，`u/(1-u)` 项会让排队时间急剧增长。队列可用于合并、重排和提升局部性，但过长会伤害 latency，因此需要 admission control。
:::

### 选择题 34：磁盘调度

关于 FIFO、SSTF、SCAN 与 C-SCAN，下列说法正确的是：

A. FIFO 总能最小化 seek distance。  
B. SSTF 优先服务最近磁道请求，可减少 seek，但可能让远处请求饥饿。  
C. SCAN 完全随机选择请求，因此公平性最差。  
D. C-SCAN 每次都选择最短剩余处理时间，主要用于 CPU 调度。

:::tip 答案与解析
**答案：B**

FIFO 按到达顺序，公平但可能 seek 很长。SSTF 选择最近请求，局部性好，但远处请求可能长时间等不到。SCAN 像电梯一样沿方向扫描，能缓解饥饿。C-SCAN 只朝一个方向服务，回绕后继续，可让不同磁盘区域得到更均匀等待时间。
:::

### 选择题 35：文件系统抽象与 `open`

关于文件系统，下列说法正确的是：

A. 文件系统把块设备接口转换成 files、directories、naming、protection 和 reliability 等抽象。  
B. `open()` 没有必要，因为每次 `read()` 都应从根目录重新解析完整路径。  
C. 用户看到的 byte stream 与磁盘 block 完全一致，不需要转换。  
D. partial-block write 永远不需要读旧 block。

:::tip 答案与解析
**答案：A**

文件系统把底层 block interface 转换为文件、目录、命名、保护和可靠性。`open()` 做 pathname 到 file number/inode 的解析，并建立内存状态；后续 `read/write` 通过 fd 和 in-memory inode 操作。无缓存解析 `/my/book/count` 这类路径会反复读目录 metadata/data 和目标 inode；打开后记住 file number，避免每次 I/O 都重新做完整 name resolution。字节级读写要翻译成 block 操作，小范围写入常需要 read-modify-write。
:::

### 选择题 36：文件大小分布

课程中关于文件大小的两个经验观察是：

A. 多数文件很大，且多数字节也在小文件中。  
B. 多数文件很小，但多数字节位于大文件中。  
C. 文件大小分布对文件系统设计没有影响。  
D. 只要优化大文件吞吐，小文件 metadata 操作可以忽略。

:::tip 答案与解析
**答案：B**

多数文件是小文件，意味着创建、打开、目录查找和 metadata 操作必须便宜；多数字节在大文件中，意味着顺序吞吐、局部性和大文件索引也必须高效。好的文件系统要同时照顾小文件低开销和大文件高吞吐，这正是 inode、FFS、extent 等设计反复权衡的背景。
:::

### 选择题 37：FAT

关于 FAT 文件系统，下列说法正确的是：

A. FAT 把文件块链保存在 File Allocation Table 中，随机访问第 `k` 个块通常要沿链前进。  
B. FAT 的目录天然是 B+Tree，因此大目录查找非常快。  
C. FAT 的主要优势是每个文件都拥有复杂多级索引树。  
D. FAT 不需要 free-space 信息，因为磁盘块永远不会被复用。

:::tip 答案与解析
**答案：A**

FAT 使用 File Allocation Table 表示文件块链。顺序遍历简单，但随机访问第 `k` 个块需要沿链走，效率低。FAT 目录通常是 name-to-file-number 的线性列表，大目录查找慢。它的优势是简单，代价是随机访问、大目录和局部性管理较弱。
:::

### 选择题 38：Unix inode

关于 Unix inode，下列说法正确的是：

A. inode 只保存文件名，不保存权限和块指针。  
B. 目录项把名字映射到 inode number，因此 hard link 很自然。  
C. indirect pointer 只服务小文件，大文件必须连续存放。  
D. inode 设计无法表达文件 metadata。

:::tip 答案与解析
**答案：B**

Unix inode 保存文件属性、权限、大小和块指针。目录是特殊文件，目录项把 name 映射到 inode number；多个目录项可指向同一 inode，这就是 hard link。Direct、single-indirect、double-indirect、triple-indirect 形成非对称树：小文件便宜，大文件也可扩展。
:::

### 选择题 39：Berkeley FFS

FFS 相比早期简单 Unix 文件系统的重要改进包括：

A. 完全取消 block allocation，所有文件按字节散落存储。  
B. 使用 block group、bitmap allocation、连续放置、保留空闲空间和旋转延迟处理来改善局部性。  
C. 禁止 read-ahead，因为顺序访问一定很慢。  
D. 把所有目录改成单个全局线性表。

:::tip 答案与解析
**答案：B**

FFS 通过 block group 尽量把相关 inode 和数据放近，通过 bitmap 管理空闲空间，保留一定空闲比例以避免碎片化，并利用当时磁盘几何做旋转延迟优化。它改善顺序吞吐和局部性，但也有块级分配导致小文件空间浪费等代价。
:::

### 选择题 40：Hard Link、Symbolic Link 与路径遍历

下列说法正确的是：

A. Hard link 是把名字映射到同一个文件对象；symbolic link 保存另一个路径名，可能悬空。  
B. Symbolic link 必须与目标位于同一文件系统，且不能跨目录。  
C. Hard link 和 symbolic link 都会复制文件数据。  
D. 路径遍历只需要检查最终文件权限，不需要检查中间目录权限。

:::tip 答案与解析
**答案：A**

Hard link 让多个名字映射到同一 inode/file number，共享同一文件对象。Symbolic link 保存路径字符串，解析时再跟随，因此可跨越 hard link 通常受限的边界，但目标删除后会悬空。路径遍历会逐级读取目录 inode 和目录数据，也要检查中间目录权限。
:::

### 选择题 41：NTFS

关于 NTFS，下列说法正确的是：

A. NTFS 围绕 MFT 组织文件系统，小文件数据可 resident 在 MFT record 中，大文件常用 extents 描述。  
B. NTFS 不支持 hard links。  
C. NTFS 只能表示完全连续的文件，无法处理碎片化。  
D. NTFS 把所有文件元数据放在 FAT 链表中。

:::tip 答案与解析
**答案：A**

NTFS 围绕 Master File Table 组织。小数据可以 resident 在 MFT record 中，避免额外数据块访问；中等文件用 extents 描述连续范围；更大或碎片化文件可用 attribute list 溢出到额外 MFT record。灵活 attribute 设计表达力强，但实现复杂。
:::

### 选择题 42：`mmap()`

`mmap(0, 10000, PROT_READ|PROT_WRITE, MAP_FILE|MAP_SHARED, fd, 0)` 的含义最接近：

A. 让 OS 选择虚拟地址，映射 `fd` 对应文件从 offset 0 开始的 10000 字节，允许读写，且修改通过文件共享。  
B. 在物理地址 0 处强制复制 10000 字节私有缓冲区。  
C. 创建一个只能执行、不能读写的匿名内存区域。  
D. 立即把整个文件系统读入该进程 heap。

:::tip 答案与解析
**答案：A**

Memory-mapped files 把文件访问变成虚拟内存访问。file-backed region 的 page fault 会从文件加载页面并更新页表。`MAP_SHARED` 表示写入映射会反映到共享文件语义中。不同进程映射同一文件时不需要使用相同虚拟地址，因为共享的是底层文件/物理页关系，而不是 VA 数值。
:::

### 选择题 43：Buffer Cache

关于 buffer cache，下列说法正确的是：

A. Buffer cache 只缓存普通文件数据，不缓存 inode、directory block 或 free map。  
B. `open()`、`read()`、`write()` 都可能受益于 buffer cache；写入会让数据或元数据变 dirty。  
C. Dirty block 驱逐时可以直接丢弃，因为磁盘上总有最新版本。  
D. LRU 对一次性顺序扫描总是最优，因此不需要 Use Once 类策略。

:::tip 答案与解析
**答案：B**

Buffer cache 可缓存 disk blocks、inodes、directory blocks、free maps、name translations 等内核资源。`open()` 中目录和 inode 可被缓存，`read()` 中数据块可命中，`write()` 会修改数据和元数据并产生 dirty blocks。Dirty block 驱逐前需要 writeback。LRU 在 streaming scan 上可能污染缓存，Use Once 可快速丢弃一次性块。
:::

### 选择题 44：Prefetching 与 Delayed Writes

关于文件系统 prefetching 和 delayed writes，下列说法正确的是：

A. Read-ahead 对任何随机访问都必然有益。  
B. Delayed writes 能改善批处理和布局，但会扩大崩溃丢失窗口。  
C. Delayed writes 的含义是每次写都同步落盘。  
D. Prefetch 越多越好，不会影响其他应用。

:::tip 答案与解析
**答案：B**

Read-ahead 对顺序访问有帮助，但预测错误或预取过多会挤占缓存并伤害其他应用。Delayed writes 可合并写入、改善布局、减少同步等待，但 dirty data/metadata 尚未落盘时存在 crash window。Buffer caching 与 demand paging 都是缓存思想，但对象、可见性和可靠性约束不同。
:::

### 选择题 45：RAID、Erasure Coding 与可靠性指标

下列说法正确的是：

A. Availability 指故障后数据仍能存活；durability 指当前是否能接受请求。  
B. RAID 5 使用 XOR parity 通常可容忍一块磁盘失败；RAID 6 或 Reed-Solomon erasure coding 可容忍更多失败。  
C. Replication 即使所有副本总是同时失败，也能显著提升 durability。  
D. RAID 可以自动保证文件系统所有多块更新的一致性。

:::tip 答案与解析
**答案：B**

Availability 是系统接受并处理请求的能力；durability 是数据在故障后存活；reliability 是一段时间内正确执行功能。RAID 1 镜像，RAID 5 用 parity 容忍单盘失败，RAID 6/erasure codes 可容忍更多。复制只有在 failure 足够独立时才有用。RAID 保护块级故障，不自动修复文件系统一致性。
:::

### 选择题 46：文件系统可靠性方法

关于 careful ordering 与 copy-on-write，下列说法正确的是：

A. 同时写 data 和 pointer 时，通常应先写 pointer，再写 data。  
B. Careful ordering 通过安全写入顺序和 recovery 清理未完成操作；copy-on-write 写新版本并最后切换指针。  
C. Copy-on-write 必须覆盖旧版本，因此崩溃恢复更困难。  
D. RAID 已经解决了所有文件系统 crash consistency 问题，因此不需要这些方法。

:::tip 答案与解析
**答案：B**

文件系统可靠性的核心问题是：无论何时崩溃，如何保证一致性。Careful ordering 通常先写 data，最后写 pointer，因为无指针的 data 可以清理，而指向无效 data 的 pointer 更危险。Copy-on-write 不覆盖旧版本，先写新版本，最后原子地让根或指针指向新结构，因此恢复时保留旧完整版本或新完整版本。
:::

### 选择题 47：Journaling 与 Transactions

关于 journaling file system，下列说法正确的是：

A. 有 commit record 的 transaction 在 recovery 时应被 replay 或保留；没有 commit 的 partial transaction 可丢弃。  
B. Journaled file system 与 log-structured file system 完全相同，所有 data 永远保持 log form。  
C. Transaction 只是连续执行几次写入，不要求 atomicity。  
D. Journaling 只能用于用户数据，不能用于 metadata。

:::tip 答案与解析
**答案：A**

Transaction 是从一个一致状态到另一个一致状态的原子读写序列。Log/Journaling 通过 durable append records 让多步更新可恢复：未 commit 的 partial transaction 丢弃；已经 commit 的 transaction 必须 replay 或保持效果。许多现代文件系统只 journal metadata，以降低开销，但这意味着用户数据和 metadata 的可靠性语义要分开理解。
:::

### 选择题 48：Two General's Paradox 与 Two-Phase Commit

关于分布式协议，下列说法正确的是：

A. Two General's Paradox 表明，在不可靠消息上无法保证双方同时行动，即使实际发送的每条消息最终都到了，也无法知道对方知道。  
B. 2PC 解决 simultaneous action，因此所有参与者能在同一物理时刻 commit。  
C. 2PC 中 coordinator 只要收到一个 `VOTE-COMMIT` 就必须 commit。  
D. Worker 已经 voted commit 后，coordinator failure 时可直接 abort，因为本地还没 commit。

:::tip 答案与解析
**答案：A**

Two General's Paradox 说明 unreliable messaging 无法创造 guaranteed simultaneous action。2PC 解决的是最终在 commit 或 abort 上达成 distributed agreement，而不是同一物理时刻行动。Coordinator 只有在 unanimous `VOTE-COMMIT` 后才 commit，否则 abort。Worker 在投 `VOTE-COMMIT` 前必须把 vote 记录到 stable storage；已经 voted commit 的 READY worker 在 coordinator failure 时必须 block，因为最终决定可能已经是 commit。
:::

### 选择题 49：Dedup 与 IOFlow

下列关于 FAST'08 Dedup 和 SOSP'13 IOFlow 的说法正确的是：

A. Deduplication 是单个文件内部的小窗口压缩，与跨文件重复无关。  
B. Summary vectors、stream-informed layout 和 LPC 都是为了缓解 dedup fingerprint index 的磁盘瓶颈。  
C. IOFlow 把 policy logic 固定写死在每个 storage device 内，因此无法集中控制。  
D. Storage rate limiting 只按 payload bytes 就足够，不需要考虑 cost。

:::tip 答案与解析
**答案：B**

Deduplication 是跨许多文件的 global compression，fingerprint index 可能巨大，导致磁盘查索引成为瓶颈。Summary vectors 避免许多 disk index lookups，stream-informed layout 和 LPC 利用 duplicate locality。IOFlow 的核心是分离 storage data-plane enforcement 与 control-plane policy logic，storage flow 可写成 `<{VMs}, {File Operations}, {Files}, {Shares}> -> SLA`，并强调 cost-based rate limiting，而非只看 bytes 或 IOPS。
:::

### 选择题 50：GFS、EC-Cache 与 Chord

下列说法正确的是：

A. GFS 使用 single master 管 metadata，chunkservers 管 data，写入由 primary replica lease 序列化 modifications。  
B. EC-Cache 使用 erasure coding 的唯一目标是长期容灾，不能改善 cache load balancing 或 tail latency。  
C. Chord 把 key 存在 predecessor，并用线性扫描保证 `O(N)` lookup，这是其主要贡献。  
D. GFS 为了严格 POSIX 语义，禁止大 chunk、append 和 relaxed consistency。

:::tip 答案与解析
**答案：A**

GFS 面向 frequent failures、huge files、appends 和 high sustained bandwidth，使用 master 管 metadata、chunkservers 管数据，64 MB chunk 降低 metadata 压力；write flow 中 primary lease 负责排序，secondaries 按同序执行。EC-Cache 把 erasure coding 用于 cache load balancing 和 tail latency，读取 `k+Delta` 个 units 后使用最先到达的 `k` 个。Chord 使用 consistent hashing，把 key 存在 successor，finger table `successor(n+2^i)` 实现 `O(log N)` lookup。
:::
