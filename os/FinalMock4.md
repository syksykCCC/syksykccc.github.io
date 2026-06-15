# 期末考试模拟试题 FinalMock4

## 试卷说明

- 题型：大题 5 题，每题 20 分，共 100 分。
- 覆盖比例：期中前内容 1 题，期中后内容 4 题。
- 题目风格：本卷强调构造、证明、流程填空、符号分析和系统不变量；少做机械数值模拟。
- 答题建议：证明题写清楚关键不变量或反证点；流程题写清楚触发条件、状态变化和失败模式。

## 大题一：急救机器人调度、锁协议与死锁避免（20 分）

某医院急救机器人运行在单 CPU 实时内核上。机器人同时执行药品配送、影像采集、语音提醒和后台日志上传。系统采用固定优先级：数值越小优先级越高。任务和可能使用的资源如下：

| 任务 | 优先级 | 每次计算时间 | 周期/最迟响应 | 可能访问的资源 |
| --- | --- | --- | --- | --- |
| `Alarm` | 1 | `C_A` | `D_A` | `Speaker` |
| `Vision` | 2 | `C_V` | `D_V` | `Camera`, `MapDB` |
| `Drug` | 3 | `C_D` | `D_D` | `MapDB`, `Arm` |
| `Logger` | 4 | best effort | none | `Flash` |

资源的使用关系为：

- `Speaker` 只会被 `Alarm` 使用。
- `Camera` 只会被 `Vision` 使用。
- `MapDB` 会被 `Vision` 与 `Drug` 使用。
- `Arm` 只会被 `Drug` 使用。
- `Flash` 只会被 `Logger` 使用。

### Part A：Priority Ceiling Protocol 流程填空（5 分）

系统希望使用 Priority Ceiling Protocol（PCP）限制优先级反转。定义资源的 priority ceiling 为“所有可能锁该资源的任务中的最高优先级”。补全流程：

```text
When task T requests lock R:
  1. compute ceiling(R) = ________________________(1)
  2. compute system_ceiling = min priority number among
       ceilings of resources currently locked by tasks other than T
  3. T may lock R only if
       priority(T) is ________________________(2) system_ceiling
       or T already holds the resource that contributes system_ceiling
  4. if T is blocked by a lower-priority lock holder L,
       L temporarily ________________________(3)
```

1. 填写 `(1)`、`(2)`、`(3)`。（3 分）
2. 根据表格，写出 `ceiling(Speaker)`、`ceiling(MapDB)`、`ceiling(Arm)`。（2 分）

### Part B：构造优先级反转场景（4 分）

只使用普通 mutex 和严格优先级调度，不使用 donation/PCP。构造一个执行片段，使 `Vision` 因为 `Drug` 持有 `MapDB`，又被 `Logger` 间接延迟。要求说明：

1. 初始谁先运行并获得哪个锁。（1 分）
2. `Vision` 何时到达并阻塞在哪里。（1 分）
3. `Logger` 如何让 `Drug` 无法及时释放锁。（1 分）
4. 这个现象为什么不是普通死锁，但会破坏实时可预测性。（1 分）

### Part C：全局资源顺序的证明题（4 分）

另一位同学提出不用 PCP，只规定所有线程必须按全局顺序申请资源：

```text
Camera < MapDB < Arm < Flash < Speaker
```

证明：如果每个线程都严格按该顺序申请资源，并按任意顺序释放资源，则不可能出现由锁资源构成的 circular wait。要求使用反证法或最小元素法。

### Part D：Banker 视角的符号判定（5 分）

把“用餐律师”推广成 `n` 个线程共享 `n` 个完全相同的设备 token，每个线程最多需要 `k` 个 token 才能完成并释放所有 token。当前所有线程都还没有完成。系统使用一个简化 Banker 规则：只有在批准请求后，仍存在至少一个线程能够最终拿到 `k` 个 token 并完成，才批准请求。

1. 若当前可用 token 数为 $a$，线程 $i$ 当前已持有 $h_i$ 个 token，则“至少有一个线程能完成”的符号条件是什么？（2 分）
2. 对经典情形 $n=5,\ k=2$，解释为什么“让每个人先拿 1 根筷子”是不安全的。（1 分）
3. 对一般 $n,\ k$，构造一个 unsafe 但尚未 deadlock 的状态。（1 分）
4. Banker 相比固定全局资源顺序，主要收益和主要代价分别是什么？（1 分）

### Part E：实时可调度性中的 blocking 项（2 分）

在固定优先级实时分析中，常把低优先级临界区造成的最长阻塞记为 $B_i$。给出一个保守响应时间不等式的形式，说明 $C_i$、高优先级任务干扰和 $B_i$ 分别代表什么即可。

:::tip 答案与解析
### Part A

1. `(1)` 是“可能锁 `R` 的任务中最高优先级”，也就是最小 priority number；`(2)` 是“高于”，即数值更小；`(3)` 是“继承/提升到被阻塞高优先级任务的优先级”。
2. `ceiling(Speaker)=1`，`ceiling(MapDB)=2`，`ceiling(Arm)=3`。`MapDB` 可被 `Vision` 和 `Drug` 使用，其中最高优先级是 `Vision` 的 2。

### Part B

一种构造是：`Drug` 先运行并获得 `MapDB`，进入较长临界区；随后 `Vision` 到达并请求 `MapDB`，因锁被 `Drug` 持有而阻塞；接着 `Logger` 变为 ready，若系统的普通调度/实现错误地让 `Logger` 或其他中等优先级 CPU 工作持续运行在 `Drug` 前面，`Drug` 无法获得 CPU 释放 `MapDB`，`Vision` 被间接延迟。严格说若 `Logger` 优先级低于 `Drug`，它不会抢占 `Drug`；因此真正的优先级反转需要一个优先级介于 `Vision` 和 `Drug` 之间的任务，或系统把 I/O bottom half/日志线程提升到中等优先级。关键结构是：高优先级等待低优先级锁持有者，而中间优先级工作阻止低优先级持有者运行。它不是普通死锁，因为锁持有者理论上能运行并释放锁；问题是调度策略让释放时间无上界，破坏实时可预测性。

### Part C

反证。假设存在 circular wait：$T_1$ 持有 $R_1$ 等待 $R_2$，$T_2$ 持有 $R_2$ 等待 $R_3$，依此类推，$T_m$ 持有 $R_m$ 等待 $R_1$。由于每个线程都按全局顺序申请资源，若线程持有 $R_i$ 又等待 $R_{i+1}$，必有：

$$
R_i < R_{i+1}
$$

沿环得到：

$$
R_1 < R_2 < \cdots < R_m < R_1
$$

这与严格全序的反自反性矛盾。因此 circular wait 不可能出现。

### Part D

1. 批准后若存在某个线程 `i` 满足：

$$
h_i + a \ge k
$$

则至少该线程可最终获得足够 token 完成并释放资源。这是必要的直观 Banker 检查之一。
2. $n=5,\ k=2$ 时，如果五个线程各持有 1 个 token，则 $a=0$，每个线程还差 1 个 token，没有任何线程能完成释放，形成死锁。
3. 对一般 $n,\ k$，令每个线程持有 $k-1$ 个 token，且 $a=0$。尚可在分配过程中到达这个状态；如果所有线程都还需要 1 个 token 才能完成，则已经 deadlock。若要 unsafe 但尚未 deadlock，可令 $a=1$、一个线程持有 $k-2$，其余持有接近上限，使当前可能还有一步可走，但若把最后一个 token 给错误线程会进入无人可完成状态。核心是：unsafe 表示存在请求序列会把系统推入不可完成状态，不等于当前已有环形等待。
4. Banker 收益是比静态顺序更灵活，可能批准更多安全交错；代价是需要最大需求信息和运行时安全性检查，且实现复杂。

### Part E

一种保守形式是：

$$
R_i
= C_i + B_i
+ \sum_{j \in \operatorname{hp}(i)}
\left\lceil \frac{R_i}{T_j} \right\rceil C_j
$$

$C_i$ 是任务自身执行时间，$\operatorname{hp}(i)$ 是优先级高于 $i$ 的任务集合，求和项是高优先级任务在 $R_i$ 窗口内的抢占干扰，$B_i$ 是低优先级临界区导致的最长阻塞。若解出的响应时间满足：

$$
R_i \le D_i
$$

则任务 $i$ 在该模型下可满足 deadline。
:::

## 大题二：可热更新模型文件的 `mmap` 运行时（20 分）

某推理服务把模型权重文件 `model.v1` 通过 `mmap` 映射到多个 worker 进程。为了热更新，控制进程会生成 `model.v2`，然后用 `rename` 替换路径 `model.current`。服务希望避免复制 20 GB 权重，又要处理文件被截断、访问模式变化和共享可见性。

### Part A：File-backed page fault 流程填空（5 分）

补全一次对 file-backed mapping 的缺页处理流程：

```text
CPU loads address x
  -> PTE says ________________________(1)
  -> trap into kernel
  -> find VMA containing x, check ________________________(2)
  -> compute file offset = ________________________(3)
  -> look up page cache by (file object, page index)
  -> if cache miss, submit disk read and put thread on ________________________(4)
  -> install PTE with physical frame and permission
  -> restart ________________________(5)
```

每空 1 分。

### Part B：热更新、truncate 与 SIGBUS（4 分）

`worker W` 已经把 `model.current` 映射为 `MAP_SHARED | PROT_READ`，长度为 `20 GB`。控制进程错误地对同一个底层文件执行 `truncate(fd, 10 GB)`，而不是写新文件再 `rename`。

1. 若 `W` 随后访问原 offset `15 GB`，这不是普通 protection fault；更合理的处理结果是什么？（1 分）
2. 为什么“写新文件 + fsync + rename”比“原地 truncate + rewrite”更适合热更新？（1.5 分）
3. `rename` 替换路径后，已经持有旧文件映射的 worker 会自动变成新文件内容吗？为什么？（1.5 分）

### Part C：`mmap` vs `read` 的符号成本模型（5 分）

一个文件有 $N$ 个页，每页大小为 $P$。用 `mmap` 顺序扫描时，假设每页第一次访问触发一次 minor/major fault，平均 fault 处理成本为 $F$，每页实际计算成本为 $A$。用 `read` 时，每个系统调用一次读取 $b$ 页，系统调用固定成本为 $S$，每页拷贝成本为 $C$，每页计算成本仍为 $A$。

1. 写出 `mmap` 总成本的符号表达式。（1 分）
2. 写出 `read` 总成本的符号表达式，忽略最后不足 `b` 页的取整误差。（1 分）
3. 推导 `read` 比 `mmap` 更快的大致条件。（2 分）
4. 这个模型说明了为什么“少一次用户态拷贝”并不总能让 `mmap` 更快？（1 分）

### Part D：`MAP_SHARED`、`MAP_PRIVATE` 与 fork 后 COW（4 分）

父进程映射同一文件的两段区域：

```c
char *s = mmap(NULL, len, PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0);
char *p = mmap(NULL, len, PROT_READ|PROT_WRITE, MAP_PRIVATE, fd, 0);
fork();
```

1. 子进程写 `s[0]='x'`，父进程随后读 `s[0]`，应看到什么语义？（1 分）
2. 子进程写 `p[0]='y'`，父进程随后读 `p[0]`，应看到什么语义？（1 分）
3. 对 `MAP_PRIVATE`，第一次写通常会触发什么机制？（1 分）
4. 为什么两种映射的 flags 不能在映射建立后随意“就地切换”？（1 分）

### Part E：访问模式提示设计（2 分）

你要给运行时加一个 `advise(region, pattern)` 接口，pattern 包括 `SEQUENTIAL`、`RANDOM`、`WILLNEED`、`DONTNEED`。任选两个 pattern，说明 OS 可据此改变什么策略。

:::tip 答案与解析
### Part A

1. 页无效或 non-resident。
2. 地址范围与访问权限是否合法。
3. 文件偏移为：

$$
\text{VMA.file\_offset} + (x - \text{VMA.start})
$$

再按页对齐得到文件页号。
4. wait queue / blocked queue / I/O wait queue。
5. faulting instruction。

### Part B

1. 访问映射范围内但已经超出底层文件当前大小的页，合理结果是向进程发送类似 `SIGBUS` 的同步异常，而不是简单调入页面。
2. 新文件写好并 `fsync` 后再 `rename`，能让旧文件内容继续服务旧 worker，新路径原子指向新版本；原地 truncate 会破坏仍在使用旧 inode 的映射，并暴露半写状态。
3. 不会。已有 mapping 绑定的是打开时的文件对象/inode 及其页缓存；`rename` 改变的是目录名到文件对象的映射，新打开者看到新文件，旧 worker 仍引用旧文件对象，直到关闭/munmap。

### Part C

1. `mmap` 的总成本可写为：

$$
T_{\text{mmap}} = N(F + A)
$$

2. `read` 的总成本可写为：

$$
T_{\text{read}} = \frac{N}{b}S + N(C + A)
$$

3. `read` 更快当：

$$
\frac{N}{b}S + N(C + A) < N(F + A)
$$

两边同除以 `N` 后得到：

$$
\frac{S}{b} + C < F
$$

也就是说，批量 read 的摊销 syscall 成本加拷贝成本小于每页 fault 成本时，`read` 更快。
4. `mmap` 省掉显式 read 和一次拷贝，但把 I/O 边界变成 page fault；若每页 fault 成本高、预取不佳或访问只顺序扫描一次，fault 开销可能超过拷贝节省。

### Part D

1. `MAP_SHARED` 写入共享文件页；父进程读同一映射位置应看到共享修改，持久化到磁盘的时间另由 writeback/msync 控制。
2. `MAP_PRIVATE` 写入是进程私有；父进程不应看到子进程写入的 `'y'`，文件也不应因此改变。
3. Copy-on-write：写 fault 后内核分配私有物理页，复制原内容，更新写者 PTE。
4. flags 决定 VMA、页表权限、COW 语义和与 page cache 的关系。随意切换会破坏已有 PTE、共享页和 dirty/COW 状态的一致性，通常需要重新映射。

### Part E

`SEQUENTIAL` 可增大 read-ahead，并在页面用过后降低其缓存优先级。`RANDOM` 可减少预取，避免污染缓存。`WILLNEED` 可提前异步预取。`DONTNEED` 可让 OS 尽快回收 clean pages 或降低其优先级。
:::

## 大题三：扫描抗性的 Buffer Cache 与在线构造（20 分）

某数据库有 `k` 个热点索引块 `H1..Hk`，buffer cache 容量恰好为 `k`。白天 workload 反复访问热点块；夜间 workload 会顺序扫描大量冷块 `S1,S2,...`。你要证明普通 LRU 的脆弱性，并设计一种 scan-resistant 策略。

### Part A：LRU 的对抗构造（5 分）

假设一开始 cache 中正好是 `H1..Hk`，且 LRU 顺序从老到新为 `H1,H2,...,Hk`。

1. 构造一个长度为 `k` 的冷块访问串，使所有热点块都被 LRU 淘汰。（1 分）
2. 接着访问 `H1,H2,...,Hk`，会发生多少次 miss？（1 分）
3. 证明：对任意确定性的“把每个 miss 装入主缓存”的 LRU 类策略，存在长度 $2k$ 的访问串使其至少发生 $2k$ 次 miss 或接近全 miss。（2 分）
4. 这个构造说明了什么系统设计教训？（1 分）

### Part B：Two-Queue/Use-Once 流程填空（5 分）

设计一个简化 Two-Queue cache：

- `A1`：probationary queue，保存第一次见到的块。
- `Am`：main queue，保存至少第二次命中的热点块。
- 顺序扫描被标记为 `use_once`，不进入 `Am`。

补全流程：

```text
on access block x:
  if x in Am:
      move x to MRU of Am
  else if x in A1:
      remove x from A1
      insert x into ________________________(1)
  else:
      read x from disk
      if x has use_once hint:
          place x in ________________________(2)
      else:
          insert x into ________________________(3)

on eviction:
  prefer evicting clean blocks from ________________________(4)
  dirty victims must first enter ________________________(5)
```

每空 1 分。

### Part C：符号化预取窗口优化（4 分）

顺序读取 $N$ 个 block。若预取窗口为 $w$，每次 I/O 的固定 seek/提交成本为 $S$，每个 block 传输成本为 $T$。预取过大会污染缓存，抽象为额外代价 $\alpha w$。忽略取整，总代价模型：

$$
\operatorname{Cost}(w)
= \frac{N}{w}S + NT + \alpha w
$$

1. 对连续变量 $w > 0$，求使 $\operatorname{Cost}(w)$ 最小的 $w^*$。（2 分）
2. 如果 $\alpha$ 增大，最优窗口如何变化？解释含义。（1 分）
3. 真实系统中为什么还要把 $w^*$ 限制在上下界内？（1 分）

### Part D：Dirty metadata 的偏序约束（4 分）

一次 `rename("tmp", "final")` 需要更新两个目录块 `D_old`、`D_new` 和 inode link count `I`。为了防止 crash 后出现“两个名字都消失”或“link count 明显错误”，文件系统定义如下偏序：

```text
log(D_new add final)  -> log(I linkcount update) -> log(D_old remove tmp) -> COMMIT
```

1. 用图或文字表示这四个事件的有向依赖关系。（1 分）
2. 给出一个违反该偏序的写入顺序，并说明可能出现的坏状态。（1 分）
3. 为什么 journal commit record 可以把这个偏序变成恢复时的二元规则？（1 分）
4. 如果不使用 journal，只靠 delayed write，这个偏序为什么难以保证？（1 分）

### Part E：证明题：Use-Once 保护热点集合（2 分）

假设 cache 容量为 `k`，初始包含热点集合 `H`，且所有冷块访问都带 `use_once` 并在使用后立即丢弃。证明：任意长度的冷块顺序扫描不会把 `H` 中任何 clean 热点块从主缓存中淘汰。

:::tip 答案与解析
### Part A

1. 访问 `S1,S2,...,Sk`。每个 `Si` 都是 miss 并装入缓存，按 LRU 依次淘汰 `H1,H2,...,Hk`。
2. 接着访问 `H1..Hk` 全部 miss，共 `k` 次 miss。
3. 对初始热点全在缓存的情形，先用 $k$ 个互不相同且不在缓存中的冷块填满缓存，导致原热点全被替换；再访问原热点集合，因它们都不在缓存而全 miss。总访问长度 $2k$，产生 $2k$ 次 miss。若策略有某些保留细节，只要每个新 miss 都可能污染主缓存，就能构造足够长的冷块前缀挤出热点。
4. 对一次性扫描，recency 不是 reuse 的好信号。文件系统需要 hints、分队列或 scan-resistant replacement，不能盲目信任 LRU。

### Part B

1. `Am`
2. `temporary/use-once list`
3. `A1`
4. `A1` 或 temporary list
5. `writeback/pageout queue`

第一次见到的块先进 probationary queue；只有再次命中才说明可能有复用价值并晋升到 main queue。Use-once 块服务当前请求后尽快丢弃。Dirty victim 必须写回后才能真正释放。

### Part C

1. 对 $\operatorname{Cost}(w)$ 求导：

$$
\frac{d}{dw}\operatorname{Cost}(w)
= -\frac{NS}{w^2} + \alpha
$$

令其为 0 得：

$$
w^* = \sqrt{\frac{NS}{\alpha}}
$$

2. $\alpha$ 越大，污染代价越高，$w^*$ 越小。含义是内存压力大或热点缓存价值高时，应更保守预取。
3. 设备最大请求大小、内存上限、并发公平性、页缓存压力、访问模式误判和实现粒度都会要求 $w$ 有最小/最大限制。

### Part D

1. 依赖链是 `D_new add final -> I linkcount update -> D_old remove tmp -> COMMIT`，后一个事件不能在前一个事件持久化前被认为 committed。
2. 若先持久化 `D_old remove tmp`，但 crash 发生在 `D_new add final` 前，可能导致旧名字消失、新名字未出现，文件不可达。若 link count 更新顺序错误，也可能造成 inode 被过早回收或泄漏。
3. Journal 把意图记录和 commit marker 持久化。恢复时没有 commit 就丢弃整组更新；有 commit 就按 log replay，避免观察到偏序中间状态。
4. Delayed write 可能让磁盘实际写入顺序与程序发起顺序不同；设备缓存也可能重排。没有 journal/barrier/fsync，crash 可能暴露任意子集，偏序难以跨崩溃保证。

### Part E

Use-once 冷块不进入主缓存，或进入临时列表后立即可回收。因此冷块扫描只消耗临时缓冲，不参与主缓存的 victim 选择。若热点集合 `H` 中的 clean 块只驻留在主缓存，且主缓存 eviction 不从 `H` 中选择来容纳 use-once 块，则扫描长度无论多长都不会淘汰 `H`。证明的不变量是：每次 cold access 前后，主缓存中的 `H` 集合保持不变。
:::

## 大题四：应用级崩溃一致性：安全替换配置文件（20 分）

一个数据库把关键配置保存在 `config.json`。更新时不能让崩溃后出现“旧配置没了，新配置也不完整”。应用开发者准备采用常见的 write-temp-and-rename 协议：

```text
write config.tmp
fsync(config.tmp)
rename(config.tmp, config.json)
fsync(parent directory)
```

底层文件系统可能 delayed write，目录项和 inode 更新可能被缓存。

### Part A：流程填空（4 分）

补全安全更新流程中的目的：

```text
1. write config.tmp       // create ________________________(1)
2. fsync(config.tmp)      // force ________________________(2)
3. rename(tmp, final)     // atomically switch ________________________(3)
4. fsync(parent dir)      // force ________________________(4)
```

每空 1 分。

### Part B：省略步骤的反例构造（6 分）

分别构造一个 crash 场景，说明省略下列步骤可能导致什么问题：

1. 省略 `fsync(config.tmp)`。（2 分）
2. 省略 `fsync(parent directory)`。（2 分）
3. 直接原地覆盖 `config.json`，不用 temp + rename。（2 分）

### Part C：Write-ahead logging 的不变量（4 分）

考虑一个 redo journal。它有三类记录：`BEGIN(T)`、若干 `UPDATE(T, block, new_image)`、`COMMIT(T)`。

1. 写出 recovery 的二元规则。（1 分）
2. 证明 redo recovery 是幂等的：同一个 committed transaction replay 两次不会比 replay 一次更糟。（1.5 分）
3. 为什么 `COMMIT(T)` 必须在所有 `UPDATE` 记录 durable 之后才能 durable？（1.5 分）

### Part D：Mini log 解析题（4 分）

Crash 后 journal 中有以下记录，按顺序排列：

```text
BEGIN T1
UPDATE T1 A := a1
COMMIT T1
BEGIN T2
UPDATE T2 B := b2
BEGIN T3
UPDATE T3 C := c3
COMMIT T3
```

1. 哪些事务应 replay？哪些应 discard？（1.5 分）
2. 如果 home location 中 `A` 已经是 `a1`，replay T1 是否安全？（1 分）
3. 如果 T3 的 `COMMIT` durable 了，但 `UPDATE T3 C:=c3` 的日志块其实没有 durable，这违反了哪个规则？（1 分）
4. 日志扫描时为什么需要事务 id？（0.5 分）

### Part E：COW 与 Journaling 的构造性比较（2 分）

给出一个只包含两个指针块 `Root -> Dir -> Inode` 的小文件系统。说明 journaling 和 copy-on-write 分别如何让 `Dir` 的一次更新在 crash 后呈现 all-or-nothing。

:::tip 答案与解析
### Part A

1. 新版本内容。
2. 临时文件的数据和必要 inode metadata 已经到达持久存储。
3. 目录名 `config.json` 从旧 inode 切到新 inode。
4. 目录项更新本身，也就是 rename 的命名效果。

### Part B

1. 若省略 `fsync(config.tmp)`，crash 可能发生在 rename 后但临时文件数据尚未落盘；恢复后 `config.json` 指向新 inode，但内容为空、旧数据或部分数据。
2. 若省略目录 `fsync`，文件内容可能已 durable，但 rename 的目录项更新未 durable；恢复后可能仍看到旧 `config.json`，或在某些文件系统语义下看到临时文件状态，应用无法确认切换是否发生。
3. 原地覆盖可能让旧文件前半部分是新内容、后半部分是旧内容，或者 metadata 指向部分更新数据；crash 后既不是旧完整版本，也不是新完整版本。

### Part C

1. 有 `COMMIT(T)` 的事务 redo；没有 commit 的事务 discard。
2. Redo 写的是确定的 `new_image` 到指定 block。第一次 replay 后 block 已是 `new_image`；第二次写入同样内容，状态不再变化。因此幂等。
3. 如果 commit 先 durable，而某些 update log 未 durable，recovery 会认为事务必须 replay，却缺少完整新镜像，无法保证 all-or-nothing。这违反 write-ahead logging 的基本顺序。

### Part D

1. T1 和 T3 有 commit，应 replay；T2 没有 commit，应 discard。
2. 安全。Redo 幂等，重复写 `A:=a1` 不改变语义。
3. 违反“commit durable 前，事务所有 update log records 必须 durable”的 write-ahead 顺序。
4. 多个事务记录可能交错，事务 id 用来把 BEGIN/UPDATE/COMMIT 归组。

### Part E

Journaling：把 `Dir` 的新内容或 patch 写入 log，写 commit record；恢复时无 commit 则忽略，有 commit 则把新 `Dir` redo 到 home location。Copy-on-write：写出新 `Dir'`，让它指向旧 `Inode` 或新 inode，最后原子更新 `Root` 指向 `Dir'`；root 未切换则看到旧树，已切换则看到新树。
:::

## 大题五：2PC 的不确定区间与非阻塞化改造（20 分）

某分布式课程平台在三个 shard 上提交一次选课事务 `T`：`S1` 扣减课程容量，`S2` 写学生课表，`S3` 写审计日志。协调者为 `C`。系统使用 Two-Phase Commit，但你要分析它为什么 blocking，并提出改造。

### Part A：Participant 状态机填空（4 分）

补全 participant 的状态机：

```text
INIT --PREPARE received--> LOCAL_CHECK
LOCAL_CHECK --cannot commit--> ________________________(1)
LOCAL_CHECK --can commit; force log YES--> ________________________(2)
____(2)____ --GLOBAL_COMMIT--> ________________________(3)
____(2)____ --GLOBAL_ABORT--> ________________________(4)
```

每空 1 分。

### Part B：日志表决策题（5 分）

某节点 crash 后恢复，只能看到自己的 stable log。判断它能否单方面决定：

| 本地 log 中最后相关记录 | 能否单方面决定？ | 决定 |
| --- | --- | --- |
| 没有 `YES`，也没有 decision | ? | ? |
| `YES`，没有 decision | ? | ? |
| `GLOBAL_ABORT` | ? | ? |
| `GLOBAL_COMMIT` | ? | ? |

填写表格并说明最关键的一行。

### Part C：不可单方面 abort 的不可区分性证明（4 分）

证明：处于 READY/YES 状态且没有收到 decision 的 participant，不能仅因为 coordinator 暂时不可达就单方面 abort。要求用两个执行历史 `H_commit` 与 `H_abort/unknown` 的不可区分性说明。

### Part D：多数派决策日志改造（5 分）

为了降低 blocking，系统把 coordinator 的 decision log 复制到 $2f+1$ 个副本上。只有当某个 decision 写入至少 $f+1$ 个副本后，才向 participants 发送 decision。

1. 为什么 $2f+1$ 个副本可以容忍 $f$ 个副本 crash 后仍读到已提交 decision？（1.5 分）
2. 证明任意两个大小为 $f+1$ 的多数集合必相交。（1.5 分）
3. 这种改造解决了 2PC 的哪类 blocking？仍不能解决什么问题？（1 分）
4. 它引入了什么成本？（1 分）

### Part E：2PC 与 Two-Phase Locking 区分（2 分）

有同学把 2PC 和 2PL 混为一谈。请用两句话区分它们的目标：一个解决什么一致性问题，另一个解决什么并发控制问题？

:::tip 答案与解析
### Part A

1. `ABORT`
2. `READY` 或 `UNCERTAIN`
3. `COMMIT`
4. `ABORT`

READY/UNCERTAIN 是 2PC 的关键状态：participant 已经持久承诺 yes，但还不知道全局决定。

### Part B

| 本地 log 中最后相关记录 | 能否单方面决定？ | 决定 |
| --- | --- | --- |
| 没有 `YES`，也没有 decision | 能 | ABORT |
| `YES`，没有 decision | 不能 | BLOCK/QUERY |
| `GLOBAL_ABORT` | 能 | ABORT |
| `GLOBAL_COMMIT` | 能 | COMMIT |

最关键的一行是 `YES` 但无 decision：该节点已经承诺如果全局 commit 就必须 commit，而 coordinator 可能已经把 commit 告诉了别人；单方面 abort 会破坏 atomicity。

### Part C

考虑 participant P 的本地视角：它已写 `YES`，之后 coordinator 不可达，且 P 没收到 decision。在历史 `H_commit` 中，coordinator 已收齐所有 YES，持久写入 COMMIT，并把 COMMIT 发给另一个 participant 后崩溃；在历史 `H_abort/unknown` 中，coordinator 尚未决定或最终会 abort。对 P 来说，这两个历史都表现为“我写了 YES，但没有收到消息，coordinator 不可达”，本地观测不可区分。若 P 在这种观测下选择 abort，则在 `H_commit` 中会与已 commit 的节点冲突；因此 P 不能单方面 abort。

### Part D

1. Decision 写入至少 $f+1$ 个副本；最多 $f$ 个 crash，因此至少还有一个保存该 decision 的副本存活可读。
2. 在 $2f+1$ 个元素中，两个大小为 $f+1$ 的集合若不相交，总大小至少 $2f+2$，超过全集大小 $2f+1$，矛盾。因此必相交。
3. 它缓解 coordinator 单点崩溃导致 participants 无处查询 decision 的 blocking。它仍不能让未获得多数派 decision 的事务凭空完成，也不能在网络分区导致多数派不可达时保证所有节点继续前进。
4. 成本包括额外副本、更多消息轮次、写入延迟、复制协议复杂性和多数派可用性假设。

### Part E

2PC 是分布式 commit 协议，目标是让多个节点对同一事务的 commit/abort 达成原子一致决定。2PL 是并发控制协议，目标是通过先获取锁、后释放锁的规则保证并发事务的 serializability；它不负责跨机器最终 commit 决策。
:::
