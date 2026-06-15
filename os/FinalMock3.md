# 期末考试模拟试题 FinalMock3

## 试卷说明

- 题型：大题 5 题，每题 20 分，共 100 分。
- 覆盖比例：期中前内容 1 题，期中后内容 4 题。
- 题目风格：每题围绕一个具体系统故事线展开，包含代码填空、状态追踪、计算、画图/构造和简短分析。
- 答题建议：客观计算题请写出关键中间步骤；设计题请说明不变量、触发条件或失败模式。

## 大题一：Mini Shell 与并发日志上传服务（20 分）

你正在实现一个教学版日志处理 shell。用户输入如下命令：

```sh
producer | filter | uploader > out.log
```

语义如下：`producer` 的标准输出连接到第一个 pipe；`filter` 从第一个 pipe 读、向第二个 pipe 写；`uploader` 从第二个 pipe 读，并把标准输出重定向到 `out.log`。shell 父进程需要创建两个 pipe、fork 三个子进程、设置重定向、关闭不需要的 fd，并等待三个子进程退出。

假设：

- `pipe(p01)` 之后，`p01[0]=3`、`p01[1]=4`。
- `pipe(p12)` 之后，`p12[0]=5`、`p12[1]=6`。
- `open("out.log", O_WRONLY|O_CREAT|O_TRUNC, 0644)` 在 `uploader` 子进程中返回 `7`。
- 标准输入/输出/错误分别是 `0/1/2`。

### Part A：代码填空（6 分）

补全下面 shell 子进程中的关键代码。每个空 1 分。

```c
int p01[2], p12[2];
pipe(p01);
pipe(p12);

pid_t a = fork();
if (a == 0) {
    // producer: stdout -> p01 write end
    dup2(____(1)____, STDOUT_FILENO);
    close(p01[0]);
    close(p01[1]);
    close(p12[0]);
    close(p12[1]);
    execlp("producer", "producer", NULL);
    _exit(127);
}

pid_t b = fork();
if (b == 0) {
    // filter: stdin <- p01 read end, stdout -> p12 write end
    dup2(____(2)____, STDIN_FILENO);
    dup2(____(3)____, STDOUT_FILENO);
    close(p01[0]);
    close(p01[1]);
    close(p12[0]);
    close(p12[1]);
    execlp("filter", "filter", NULL);
    _exit(127);
}

pid_t c = fork();
if (c == 0) {
    int fd = open("out.log", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    // uploader: stdin <- p12 read end, stdout -> out.log
    dup2(____(4)____, STDIN_FILENO);
    dup2(____(5)____, STDOUT_FILENO);
    close(fd);
    close(p01[0]);
    close(p01[1]);
    close(p12[0]);
    close(p12[1]);
    execlp("uploader", "uploader", NULL);
    _exit(127);
}

// parent
close(____(6)____);
close(p01[1]);
close(p12[0]);
close(p12[1]);
```

### Part B：fd 与 open file description 追踪（4 分）

1. `producer` 完成 `dup2(p01[1], 1)` 后，fd `1` 和 fd `4` 的关系是什么？（1 分）
2. `filter` 中 `dup2(p01[0], 0)` 和 `dup2(p12[1], 1)` 后，为什么仍然要关闭原始 `p01[0]` 与 `p12[1]`？（1 分）
3. 若父进程忘记关闭 `p12[1]`，`uploader` 在什么情况下可能一直读不到 EOF？（1 分）
4. `exec` 成功后，未设置 close-on-exec 的 fd 会怎样？这对 shell 重定向为什么有用？（1 分）

### Part C：并发上传服务的资源上限（5 分）

现在 `uploader` 不直接上传，而是把每行日志发送给本机上传服务。服务端可选三种模型：

- 每连接一进程：每个连接额外消耗约 `24 MB` 内存。
- 每连接一线程：每个线程栈保留 `2 MB` 虚拟空间，平均实际占用 `512 KB` 物理内存。
- 固定线程池：`32` 个 worker，每个实际占用 `512 KB`，请求放入有界队列。

服务器除连接处理外还需要 `256 MB` 常驻内存，机器可用物理内存为 `1 GB`。暂不考虑文件缓存。

1. 若使用每连接一进程，最多大约支持多少个同时活跃连接？（1 分）
2. 若使用每连接一线程，并按实际物理占用估算，最多大约支持多少个同时活跃连接？（1 分）
3. 固定线程池至少从哪两个方面改善“无界建线程”的风险？（2 分）
4. 如果每个连接中有大量共享状态更新，进程模型和线程模型在隔离性/同步成本上有什么差异？（1 分）

### Part D：有界请求队列同步（5 分）

上传服务使用大小为 `N=128` 的有界队列连接网络接收线程和 `32` 个 worker。补全信号量方案，并回答正确性问题。

```c
sem_t empty = ____(7)____;
sem_t full  = ____(8)____;
sem_t mutex = ____(9)____;

void enqueue_request(req_t r) {
    P(____(10)____);
    P(mutex);
    enqueue(r);
    V(mutex);
    V(____(11)____);
}

req_t dequeue_request(void) {
    P(full);
    P(mutex);
    req_t r = dequeue();
    V(mutex);
    V(empty);
    return r;
}
```

1. 填写 `(7)` 到 `(11)`。（3 分）
2. 如果 `enqueue_request` 先 `P(mutex)` 再 `P(empty)`，给出一种导致系统停滞的场景。（1 分）
3. 若队列满时网络线程阻塞，这属于 busy-wait 还是 blocking wait？为什么？（1 分）

:::tip 答案与解析
### Part A

1. `(1) = p01[1]`
2. `(2) = p01[0]`
3. `(3) = p12[1]`
4. `(4) = p12[0]`
5. `(5) = fd`
6. `(6) = p01[0]`

父进程还必须关闭 `p01[1]`、`p12[0]`、`p12[1]`，题目中后三个已经给出。每个子进程完成 `dup2` 后也要关闭原始 pipe fd，保留标准 fd 即可。

### Part B

1. fd `1` 和 fd `4` 都指向同一个 pipe 写端 open file description；关闭其中一个只减少一个引用，不会立刻销毁底层 pipe 写端。
2. 因为 `dup2` 已经把标准 fd 指向对应端点，原始 fd 继续打开只会增加引用，可能干扰 EOF/SIGPIPE，并造成 fd 泄漏。
3. 如果 `filter` 已退出且真正的数据写端都关闭，但父进程仍持有 `p12[1]`，内核仍认为存在写者；`uploader` 在读空 pipe 时会阻塞，而不是得到 EOF。
4. `exec` 替换程序映像，但默认保留未设置 close-on-exec 的 fd。shell 正是利用这一点，在 `exec` 前把 `0/1/2` 重定向好，让新程序无需知道 shell 的 pipe/open 细节。

### Part C

1. 可用于连接的物理内存约 `1024 MB - 256 MB = 768 MB`，每进程 `24 MB`，最多约 `768/24 = 32` 个连接。
2. 每线程实际占用约 `0.5 MB`，最多约 `768/0.5 = 1536` 个连接。实际系统还会受调度、fd、内核缓冲和栈增长限制。
3. 线程池限制并发执行数量，避免线程/栈/调度开销无界增长；有界队列还能施加 backpressure，使过载时阻塞、丢弃或限流，而不是把资源耗尽。
4. 进程模型隔离强，一个连接崩溃或写坏地址不易破坏其他连接，但共享状态更新需要 IPC 或共享内存，成本更高；线程模型共享方便，但必须用锁、条件变量或事务保护共享状态，竞态风险更高。

### Part D

1. `empty = 128`，`full = 0`，`mutex = 1`，`(10)=empty`，`(11)=full`。
2. 若队列已满，网络线程先拿到 `mutex`，再阻塞在 `P(empty)`；worker 想 dequeue 来释放空槽，却拿不到 `mutex`，于是没有线程能改变 `empty`，系统停滞。
3. 这是 blocking wait。线程在信号量等待队列中睡眠，让出 CPU；busy-wait 则会不断循环检查条件，浪费 CPU。
:::

## 大题二：插件沙箱的地址转换器（20 分）

某浏览器允许第三方插件运行在沙箱中。每个插件进程看到一个 16 位虚拟地址空间。系统准备从 base-and-bound 逐步演进到 segmentation，再到 two-level paging。页大小为 `256 B`，因此虚拟地址低 `8` 位为页内 offset。

### Part A：Base-and-Bound 与 Segmentation（4 分）

1. 插件 P 的 base-and-bound 寄存器为 `base=0x4000`，`bound=0x1800`。虚拟地址 `0x17F0` 和 `0x1808` 分别是否合法？若合法，物理地址是多少？（2 分）
2. 改用 segmentation 后，虚拟地址最高 2 位为段号，低 14 位为段内 offset。段表如下：  

| 段号 | base | limit | 权限 |
| --- | --- | --- | --- |
| 0 code | `0x1000` | `0x1200` | R-X |
| 1 heap | `0x5000` | `0x2000` | RW- |
| 2 stack | `0x9000` | `0x0800` | RW- |
| 3 shared | `0xA000` | `0x0400` | R-- |

对虚拟地址 `0x4120` 执行写操作是否合法？说明段号、offset 和原因。（2 分）

### Part B：Two-Level Paging 地址转换（6 分）

16 位虚拟地址拆成：

```text
| 4-bit L1 index | 4-bit L2 index | 8-bit offset |
```

给定某进程的 L1 表中：

- `L1[0x3]` 指向二级页表 `PT3`。
- `L1[0x7]` 无效。

`PT3` 中：

| L2 index | PPN | valid | permission |
| --- | --- | --- | --- |
| `0x4` | `0x2A` | 1 | R/W |
| `0x5` | `0x31` | 1 | R-- |
| `0x6` | disk block `D17` | 0 | R/W |

1. 对虚拟地址 `0x3456` 执行读操作，写出 L1 index、L2 index、offset 和物理地址。（2 分）
2. 对虚拟地址 `0x3560` 执行写操作，会发生什么？（1 分）
3. 对虚拟地址 `0x3670` 执行读操作，`valid=0` 一定表示非法地址吗？此处 OS 应如何判断？（2 分）
4. 对虚拟地址 `0x7123` 执行读操作，会在哪一级失败？（1 分）

### Part C：TLB、ASID 与一致性（5 分）

TLB 初始为空，容量足够大，采用精确匹配 `(ASID, VPN)`。进程 A 的 ASID 为 `1`，进程 B 的 ASID 为 `2`。访问序列如下：

```text
A: 0x3456
A: 0x34AA
B: 0x3456
A: 0x3560
A: 0x3456
```

1. 若所有 PTE 均有效且权限允许，按页大小 `256 B` 计算每次访问的 VPN，并标出 TLB hit/miss。（2 分）
2. 为什么 TLB 项必须包含 ASID，或在上下文切换时被 flush？（1 分）
3. 若 OS 将 A 的 VPN `0x34` 从 PPN `0x2A` 改映射到 PPN `0x40`，但忘记失效旧 TLB 项，会发生什么错误？（1 分）
4. TLB miss 和 page fault 的本质区别是什么？（1 分）

### Part D：从多级页表到倒排页表（5 分）

浏览器现在要支持 64 位地址空间，但多数插件只使用很小一部分地址。

1. 为什么单级页表在稀疏 64 位地址空间中不可接受？（1 分）
2. 多级页表如何降低页表内存开销？它带来的主要性能代价是什么？（2 分）
3. 倒排页表把元数据按什么对象组织？为什么查找通常需要哈希？（1 分）
4. 如果两个进程共享同一个只读代码页，它们的 PTE 权限是否必须完全相同？为什么？（1 分）

:::tip 答案与解析
### Part A

1. Base-and-bound 合法条件是 `v < bound`。`0x17F0 < 0x1800`，合法，物理地址为 `0x4000 + 0x17F0 = 0x57F0`。`0x1808 >= 0x1800`，越界，触发 protection fault/trap。
2. `0x4120` 的最高 2 位为 `01`，段号为 1；offset 为 `0x0120`。段 1 是 heap，limit `0x2000`，权限 RW-，写操作合法；物理地址为 `0x5000 + 0x0120 = 0x5120`。

### Part B

1. `0x3456` 拆为 L1=`0x3`，L2=`0x4`，offset=`0x56`。`PT3[0x4]` 映射到 PPN `0x2A`，物理地址为 `0x2A56`。
2. `0x3560` 拆为 L1=`0x3`，L2=`0x5`，offset=`0x60`。该 PTE 有效但权限 R--，写操作触发 protection fault，通常不可由 demand paging 修复。
3. 不一定。`valid=0` 可能表示非法地址，也可能表示合法但 non-resident。此处 PTE 记录 disk block `D17` 和权限 R/W，OS 应检查该虚拟页是否属于合法区域；若合法，就从 backing store `D17` 调页。
4. `0x7123` 的 L1 index 是 `0x7`，L1 无效，在一级页表查找时失败。

### Part C

1. 页大小 `256 B`，VPN 是高 8 位。序列 VPN 为：A:`0x34` miss；A:`0x34` hit；B:`0x34` miss，因为 ASID 不同；A:`0x35` miss；A:`0x34` hit。
2. 不同进程可使用相同 VPN 映射到不同物理页。若 TLB 不区分 ASID，B 可能错误使用 A 的翻译。没有 ASID 时，上下文切换必须 flush 或选择性失效相关 TLB 项。
3. A 后续访问 VPN `0x34` 仍可能命中旧 TLB，访问 PPN `0x2A`，造成 stale translation，破坏隔离、共享或 copy-on-write 语义。
4. TLB miss 只是硬件翻译缓存未命中，可能通过 page-table walk 解决；page fault 是页表翻译失败或权限失败导致的同步 trap，需要 OS 判断非法、调页、COW 或终止。

### Part D

1. 64 位虚拟页号空间巨大，单级页表需要为未使用虚拟页也保留 PTE，内存开销不可接受。
2. 多级页表只为实际使用的地址范围分配下级页表页，适合稀疏空间；代价是 TLB miss 后 page-table walk 可能访问多级内存，页表页本身也要管理。
3. 倒排页表按物理页框组织，每个物理页框记录它当前映射的是哪个 `<进程, VPN>`。由于给定虚拟地址时要从 `<进程, VPN>` 找物理页框，所以通常需要哈希加速。
4. 不必。两个 PTE 可以指向同一物理页，但权限不同，例如一个进程只读执行，另一个只读不可执行。共享物理页不等于共享完全相同的访问权限。
:::

## 大题三：手机 OS 的内存回收器（20 分）

某手机 OS 只有很少的空闲内存。系统把 demand paging 看作一个缓存问题：DRAM 是 backing store 的 cache，页面大小固定。你需要为内存回收器选择页面替换策略，并在内存压力下决定是否暂停后台应用。

### Part A：FIFO 与 LRU 模拟（5 分）

页面引用串为：

```text
A B C A B D A D B C B
```

物理页框数为 `3`，初始为空。

1. 用 FIFO 计算 page fault 次数。（2 分）
2. 用 LRU 计算 page fault 次数。（2 分）
3. 在这个引用串上，LRU 为什么会明显优于 FIFO？用一句话说明。（1 分）

### Part B：构造与识别 Bélády Anomaly（4 分）

考虑引用串：

```text
A B C D A B E A B C D E
```

1. 说明 FIFO 在 `3` 个页框和 `4` 个页框下的 fault 次数分别是多少。（2 分）
2. 这个现象叫什么？它说明“增加内存”这个直觉在哪类策略上会失败？（1 分）
3. LRU 为什么不会出现这个现象？请用 stack property 的语言回答。（1 分）

### Part C：Clock 与脏页处理（5 分）

当前有 4 个页框，clock hand 指向 F0：

| Frame | Page | use | dirty |
| --- | --- | --- | --- |
| F0 | P | 1 | 0 |
| F1 | Q | 1 | 1 |
| F2 | R | 0 | 1 |
| F3 | S | 0 | 0 |

采用普通 Clock：扫描到 `use=1` 的页时清零并跳过，扫描到 `use=0` 的页时选择为 victim。

1. 下一次替换会选择哪个页面？扫描过程中哪些 use bit 会被修改？（2 分）
2. 若系统更偏好淘汰 clean page，为什么可能跳过 `R` 而选择 `S`？这样做的收益是什么？（1 分）
3. 如果硬件没有 modified bit，OS 可以怎样用 page protection 模拟 dirty tracking？（1 分）
4. 淘汰共享物理页框时，为什么需要 reverse mapping/coremap？（1 分）

### Part D：Working Set 与暂停后台应用（4 分）

系统有 `m=9` 个物理页框。最近窗口 `Delta` 内三个进程的 working set 为：

- 前台地图 App：`{M1, M2, M3, M4}`
- 音乐 App：`{U1, U2}`
- 后台相册索引：`{P1, P2, P3, P4, P5}`

1. 计算总需求 `D`，并判断是否可能 thrashing。（1 分）
2. 若暂停后台相册索引，新的 `D` 是多少？这为什么可能提升用户感知性能？（1 分）
3. Page-Fault Frequency allocation 会根据什么信号增加或减少某进程页框？（1 分）
4. Compulsory miss 能否完全消除？如果不能，能用什么方法降低影响？（1 分）

### Part E：策略选择短评（2 分）

在真实 OS 中，为什么很少直接实现精确 LRU，而常采用 Clock/Second-Chance 近似？请给出两个理由。

:::tip 答案与解析
### Part A

1. FIFO fault 次数为 **7**。过程为：A、B、C fault；A、B hit；D fault 淘汰 A；A fault 淘汰 B；D hit；B fault 淘汰 C；C fault 淘汰 D；B hit。
2. LRU fault 次数为 **5**。A、B、C fault；A、B hit；D fault 淘汰 C；A、D、B hit；C fault 淘汰 A；B hit。
3. 该串具有较强近期局部性，LRU 利用“最近用过的很快还会再用”，而 FIFO 只看进入内存时间，可能淘汰刚被频繁使用的页面。

### Part B

1. FIFO 在 3 个页框下有 **9** 次 fault，在 4 个页框下有 **10** 次 fault。
2. 这是 **Bélády anomaly**。它说明 FIFO 这类不满足 stack property 的策略中，增加页框不一定减少 fault。
3. LRU 满足 stack property：给定引用前缀，`k` 个页框中的 LRU 驻留集合总是 `k+1` 个页框驻留集合的子集。因此增加页框不会让 LRU fault 数增加。

### Part C

1. 从 F0 开始：F0 的 P `use=1`，清零跳过；F1 的 Q `use=1`，清零跳过；F2 的 R `use=0`，选择 R。被修改的 use bit 是 P 和 Q，从 1 变 0。
2. R 是 dirty，淘汰前需要写回；S 是 clean，可以直接复用页框。偏好 clean page 可以降低当前 page fault 的阻塞时间，dirty page 可交给 pageout daemon 提前写回。
3. OS 可先把可写页表项标成 read-only。第一次写触发 protection fault，OS 确认这是合法写后设置软件 dirty bit，并恢复写权限。
4. 一个物理页框可能被多个 PTE 映射，例如共享代码、`fork` 后 COW、`mmap`。淘汰时必须找到所有相关 PTE 并失效，否则会留下指向旧物理页的 stale mappings。

### Part D

1. `D = 4 + 2 + 5 = 11`，大于 `m=9`，系统容易 thrashing。
2. 暂停相册索引后 `D = 4 + 2 = 6`，小于 9。前台地图和音乐能保留 working set，减少缺页和磁盘 I/O，用户感知更流畅。
3. PFF 根据进程的 page-fault rate 调整页框：fault rate 太高说明页框不足，尝试增加；太低说明可能分配过多，可回收部分页框。
4. 不能完全消除，因为首次访问某页不可避免。可通过 prefetching、程序/数据布局优化、启动预热或增大顺序读批量来降低影响。

### Part E

精确 LRU 需要在每次内存引用时维护全局顺序，硬件和 OS 成本很高；多核下还会造成同步和缓存一致性压力。Clock/Second-Chance 只使用粗粒度 use bit，能捕获近期使用的大方向，开销低、实现简单，也便于结合 dirty bit 和 pageout daemon。
:::

## 大题四：遥测日志落盘管线（20 分）

某数据中心节点每秒产生大量遥测日志。日志先进入内存队列，随后由 I/O 线程写入本地存储。你需要分析磁盘/SSD 性能、排队延迟和调度策略。

### Part A：HDD 随机与顺序访问（4 分）

某 7200 RPM HDD 的平均 seek time 为 `5 ms`，controller overhead 为 `0.2 ms`，传输一个 `4 KB` block 需要 `0.08 ms`。忽略 queueing。

1. 平均旋转延迟约是多少？（1 分）
2. 随机读一个 `4 KB` block 的响应时间约是多少？（1 分）
3. 如果顺序读同一 track 上的下一个 `4 KB` block，不需要 seek 且不需要额外旋转等待，响应时间约是多少？（1 分）
4. 用一句话解释为什么同样是 `4 KB`，随机 I/O 和顺序 I/O 有巨大差异。（1 分）

### Part B：排队论计算（4 分）

日志写请求到达率为 `lambda = 60/s`，平均服务时间 `Tser = 10 ms`，先按 M/M/1 模型估算。

1. 利用率 `u` 是多少？（1 分）
2. 平均排队时间 `Tq = Tser * u/(1-u)` 是多少？（1 分）
3. 平均响应时间 `Tresp = Tq + Tser` 是多少？（1 分）
4. 如果突发流量让到达率临时变为 `95/s`，为什么即使平均服务时间不变，延迟也会急剧上升？（1 分）

### Part C：磁盘调度路径（5 分）

磁头当前在 cylinder `50`，请求队列为：

```text
95, 180, 34, 119, 11, 123, 62, 64
```

磁盘 cylinder 范围为 `0..199`。SCAN 当前方向为递增，并且会走到 `199` 后再反向。

1. FIFO 总移动距离是多少？（1.5 分）
2. SSTF 的一种服务顺序是什么？总移动距离是多少？（2 分）
3. 按题目定义的 SCAN 总移动距离是多少？（1.5 分）

### Part D：PIO、DMA、中断与轮询（4 分）

1. Programmed I/O 与 DMA 在“谁搬运数据”上有什么区别？（1 分）
2. 如果每条日志只有 8 字节且写入 memory-mapped device register，PIO 为什么仍可能合理？（1 分）
3. 为什么高性能存储设备常把 polling 和 interrupt 结合，而不是永远使用其中一种？（1 分）
4. 设备驱动 top half 与 bottom half 分别处理什么？（1 分）

### Part E：过载控制设计（3 分）

日志系统有一个内存队列。若队列长度超过 `10,000`，你可以选择：继续接受、阻塞生产者、丢弃低优先级日志或批量合并。请给出一个 admission control 策略，并说明它如何影响 latency、throughput 和数据完整性。

:::tip 答案与解析
### Part A

1. 7200 RPM 表示每分钟 7200 圈，每圈约 `60/7200 s = 8.33 ms`，平均旋转延迟约半圈，即 `4.17 ms`。
2. 随机读约 `5 + 4.17 + 0.2 + 0.08 = 9.45 ms`。
3. 顺序读下一个 block 约 `0.2 + 0.08 = 0.28 ms`。
4. 随机 I/O 被机械定位成本主导，seek 和 rotation 远大于真正传输 4 KB 的时间；顺序 I/O 可以摊掉或消除定位成本。

### Part B

1. `u = lambda * Tser = 60 * 0.010 = 0.6`。
2. `Tq = 10 ms * 0.6 / 0.4 = 15 ms`。
3. `Tresp = 15 ms + 10 ms = 25 ms`。
4. 当 `lambda = 95/s` 时，`u = 0.95`，`u/(1-u)=19`，排队项急剧放大。利用率接近 1 时，微小突发就会制造很长队列。

### Part C

1. FIFO 路径：`50->95->180->34->119->11->123->62->64`，总移动 `45+85+146+85+108+112+61+2 = 644`。
2. SSTF 一种顺序：`50->62->64->34->11->95->119->123->180`，总移动 `12+2+30+23+84+24+4+57 = 236`。
3. SCAN 递增方向：服务 `62,64,95,119,123,180`，走到 `199`，再反向服务 `34,11`。总移动为 `(199-50) + (199-11) = 149 + 188 = 337`。

### Part D

1. PIO 由 CPU 通过指令或 load/store 搬运数据；DMA 由 controller 在设备和内存之间搬运 block，CPU 主要负责设置描述符和处理完成事件。
2. 数据极小、设备接口简单、设置 DMA 的固定成本可能超过收益时，PIO 更直接，延迟也可能更低。
3. Interrupt 适合不可预测或低频事件，但每次中断有上下文切换/调度开销；polling 适合短时间内预计会完成的高频请求，但空闲时浪费 CPU。混合策略能在低延迟和 CPU 效率之间折中。
4. Top half 在系统调用路径上处理 `open/read/write/ioctl`、提交 I/O、可能让线程睡眠；bottom half 处理中断完成、更新状态、唤醒等待线程，并可能安排后续工作。

### Part E

一种策略是分级 admission control：队列小于 `10,000` 时正常接受；超过阈值后阻塞低优先级生产者并合并重复日志；超过 `20,000` 时丢弃可重建或 debug 级日志，但保留 error/security 日志。这样能限制 tail latency 和内存占用，保护核心吞吐；代价是低优先级数据完整性下降，需要在日志中记录 drop/merge 计数以便审计。
:::

## 大题五：小文件与大视频共存的文件系统（20 分）

你要为课程视频网站设计文件系统。该系统同时有大量几百字节的字幕/索引小文件，也有数 GB 的公开视频文件。磁盘 block 大小为 `4 KB`，指针大小为 `4 B`。

### Part A：FAT 的链式访问（4 分）

一个视频文件在 FAT 中以链表表示，起始 cluster 为 `100`。每个 cluster 为 `4 KB`。FAT 表本身已在内存中。

1. 读取文件 byte offset `1 MiB` 所在 cluster，需要沿 FAT 链前进多少次才能找到目标 cluster？（1 分）
2. FAT 对顺序读取有什么优势？（1 分）
3. FAT 对随机访问第 `k` 个块有什么劣势？（1 分）
4. FAT 目录若是线性 name-to-file-number 列表，大目录查找复杂度是多少？（1 分）

### Part B：Unix inode 多级索引（5 分）

某 Unix-like inode 有 `12` 个 direct pointer，`1` 个 single-indirect pointer，`1` 个 double-indirect pointer。每个 indirect block 可保存 `4KB/4B = 1024` 个 block pointer。假设 inode 已在内存中，读一个数据块时需要把必要的索引块从磁盘读入。

1. 读取 logical block `10` 需要几次磁盘 block 访问？（1 分）
2. 读取 logical block `500` 需要几次磁盘 block 访问？（1 分）
3. 读取 logical block `20000` 需要几次磁盘 block 访问？（1 分）
4. 为什么这种 direct + indirect 的非对称树同时适合小文件和大文件？（2 分）

### Part C：FFS 布局与保留空间（4 分）

课程视频目录 `/courses/os/` 中有一个目录 inode、若干小文件和一个大视频。FFS 试图把相关 inode 和数据放在同一 block group 中。

1. Block group 改善了哪类局部性？（1 分）
2. 为什么 FFS 会保留约 10% 空闲空间，而不是让磁盘完全写满？（1 分）
3. 对一个 1 字节字幕文件，使用 4 KB block 的主要空间代价是什么？（1 分）
4. Read-ahead 对顺序视频读取有帮助的前提是什么？（1 分）

### Part D：目录、路径遍历与 B+Tree（4 分）

假设无任何缓存，解析路径 `/courses/os/lec24.mp4`。简化模型中，每一级目录需要先读目录 inode，再读目录 data block 找到下一组件；最终文件还需要读文件 inode。

1. 按这个模型，需要多少次磁盘 block 访问？请列出访问对象。（2 分）
2. 为什么 OS 不应允许普通进程直接按 raw bytes 写目录文件？（1 分）
3. 当目录从线性列表改为 B+Tree/B+Tree-like 结构时，大目录查找的渐进复杂度如何变化？（1 分）

### Part E：Hard Link、Symbolic Link 与 NTFS Extent（3 分）

1. Hard link 和 symbolic link 在“名字指向什么”上有什么区别？（1 分）
2. 为什么 symbolic link 可能悬空，而 hard link 通常不会指向不存在的 inode？（1 分）
3. NTFS 用 extent 描述基本连续的大文件有什么好处？（1 分）

:::tip 答案与解析
### Part A

1. `1 MiB / 4 KB = 256`，目标是第 256 个 cluster（若从第 0 个 cluster 开始计）。从起始 cluster 沿链前进 **256 次** 可到达该 offset 所在 cluster。
2. 顺序读取只需不断跟随 FAT 链，结构简单，元数据集中在 FAT 表中。
3. 随机访问第 `k` 个块需要从起点沿链走 `k` 步，时间复杂度为 `O(k)`，除非额外建立缓存/索引。
4. 线性目录查找是 `O(n)`。

### Part B

1. Logical block 10 落在 12 个 direct pointer 内，inode 已在内存中，只需读数据块，**1 次**。
2. Logical block 500 超过 direct 区，但在 single-indirect 范围内；需要读 single-indirect block，再读数据块，**2 次**。
3. Single-indirect 覆盖 logical block `12..1035`。`20000` 落在 double-indirect 范围；需要读 double-indirect block、对应 single-indirect block、数据块，**3 次**。
4. 小文件常只用 direct pointers，不需要额外索引块，metadata 和访问成本低；大文件可通过 indirect/double-indirect 扩展到大量数据块，不要求物理连续，也避免为小文件付出大索引结构成本。

### Part C

1. 改善目录、inode 和相关数据块之间的空间局部性，减少 seek，并提升顺序/近邻访问性能。
2. 保留空闲空间让 allocator 有选择余地，更容易找到连续或近邻 block，降低碎片化；磁盘快满时 first-free 往往只能捡零散空洞。
3. Internal fragmentation：1 字节数据也可能占用 4 KB block，空间利用率很低。
4. 访问模式要可预测，尤其是顺序读取；预取量还不能过大，否则会污染缓存并挤掉其他热点数据。

### Part D

1. 访问对象为：root inode、root data block、`courses` inode、`courses` data block、`os` inode、`os` data block、`lec24.mp4` inode，共 **7 次**。如果还要读文件内容，再额外读数据块。
2. 目录维护 name 到 file number 的一致映射，还涉及权限、link count、格式约束和 crash consistency。普通进程 raw write 目录会破坏文件系统不变量，因此目录更新必须通过受控系统调用。
3. 线性列表从 `O(n)` 查找变为树索引的 `O(log n)`，同时插入、删除和范围扫描也由树结构维护。

### Part E

1. Hard link 是目录项直接映射到同一个 inode/file number；symbolic link 是一个特殊文件，内容是另一个路径名。
2. Symbolic link 的目标路径可被删除、移动或跨文件系统变化，因此可能悬空；hard link 增加目标 inode 的 link count，只要 link count 大于 0，inode 通常不会被释放。
3. Extent 用 `<起始块, 长度>` 描述连续范围，对基本连续的大文件非常紧凑，随机定位和顺序 I/O 都比逐块指针更省 metadata。
:::
