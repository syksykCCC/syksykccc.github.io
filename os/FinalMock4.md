# 期末考试模拟试题 FinalMock4

## 试卷说明

- 题型：大题 5 题，每题 20 分，共 100 分。
- 覆盖比例：期中前内容 1 题，期中后内容 4 题。
- 每题只分 Part A-D。题目以构造、证明、流程推理和核心伪代码为主，避免机械堆叠数值模拟。
- 答题建议：证明题写清不变量；构造题写出最小可行例子；流程题写出状态变化和失败点。

## 大题一：锁、优先级反转与资源分配边界（20 分）

单 CPU 内核中有三个线程：`H` 高优先级，`M` 中优先级，`L` 低优先级。锁 `X` 保护一段设备状态。调度器采用严格优先级，数值越小优先级越高。

### Part A：优先级反转的最小执行片段（5 分）

构造并分析以下执行片段：

```text
t=0: L runs, acquires X
t=1: H becomes ready, tries to acquire X
t=2: M becomes ready, CPU-bound for a long time
```

1. 不使用 priority donation 时，写出 `H` 为什么会被 `M` 间接延迟。（2 分）
2. 使用 priority donation 后，`L` 的 effective priority 如何变化？为什么这能给 `H` 一个有界等待？（2 分）
3. 为什么让 `H` 在单 CPU 上自旋等待 `X` 可能比阻塞等待更糟？（1 分）

### Part B：嵌套锁中的 donation 传播（5 分）

现在有两个锁 `X`、`Y` 和四个线程，优先级从高到低为 `H > A > L > B`。当前状态：

```text
H waits for X
X is held by L
L waits for Y
Y is held by B
A is ready and CPU-bound
```

1. 画出等待链或用箭头表示依赖关系。（2 分）
2. 若 donation 只捐给直接锁持有者 `L`，但不继续传给 `B`，系统还会出现什么问题？（1.5 分）
3. 正确的 donation 传播后，`B`、`L`、`H` 的推进顺序应是什么？（1.5 分）

### Part C：全局锁顺序的证明与反例（5 分）

系统规定所有线程必须按全局顺序申请锁：

```text
A < B < C < D
```

1. 证明：若所有线程都严格按该顺序申请锁，则不可能出现由这些锁构成的 circular wait。（3 分）
2. 给出一个只使用两个线程、两个锁的最小反例，说明只要有一个代码路径违反顺序，就可能死锁。（2 分）

### Part D：同质资源的“最后一个 token”规则（5 分）

有 $n$ 个线程和 $n$ 个完全相同的 token。每个线程最多需要 2 个 token 才能完成，完成后会释放自己持有的所有 token。考虑规则 R：

> 若当前没有线程持有 2 个 token，则系统最多允许 $n-1$ 个线程各持有 1 个 token；最后一个空闲 token 只能发给已经持有 1 个 token 的线程。

1. 证明规则 R 可以避免所有线程“各拿 1 个 token”造成的死锁。（2 分）
2. 证明 $n-1$ 是这个规则能允许的最大“单 token 持有者”数量：如果允许 $n$ 个线程都先拿 1 个 token，就存在死锁状态。（2 分）
3. 这条规则和 Banker 算法相比，保守在哪里？（1 分）

:::tip 答案与解析
### Part A

1. `H` 在 `t=1` 请求 `X`，但 `X` 被 `L` 持有，因此 `H` 阻塞。`M` 在 `t=2` 到达后优先级高于 `L`，会持续抢占 `L`。于是 `L` 无法运行到释放 `X`，`H` 被一个并不持锁的中优先级线程间接延迟。
2. Donation 会把 `H` 的高优先级临时赋给锁持有者 `L`。这样 `L` 能抢在 `M` 前运行，尽快退出临界区释放 `X`；`H` 的等待时间被 `L` 剩余临界区长度约束，而不是被 `M` 的任意计算时间放大。
3. 单 CPU 上 `H` 自旋会持续占用 CPU，导致真正能释放锁的 `L` 得不到运行机会。阻塞等待至少能让出 CPU，使锁持有者有机会前进。

### Part B

1. 等待链是：

```text
H -> X -> L -> Y -> B
```

`A` 虽不在等待链上，但它是 ready 的中高优先级 CPU-bound 线程。
2. 如果 donation 只给 `L`，`L` 会变高优先级，但它仍然阻塞在 `Y` 上；`B` 若仍是低优先级，就可能被 `A` 抢占，导致 `B` 不能释放 `Y`，整条链仍然卡住。
3. Donation 应沿等待链传播：`H` 捐给 `L`，`L` 再把有效高优先级捐给 `B`。于是 `B` 先运行并释放 `Y`，然后 `L` 获得 `Y`、完成并释放 `X`，最后 `H` 获得 `X`。

### Part C

1. 反证。假设存在 circular wait，线程 $T_i$ 持有锁 $R_i$ 并等待锁 $R_{i+1}$。由于所有线程都按全局顺序申请锁，必有：

$$
R_i < R_{i+1}
$$

沿环得到：

$$
R_1 < R_2 < \cdots < R_m < R_1
$$

这与严格全序矛盾。因此 circular wait 不可能出现。
2. 反例：

```text
T1: acquire(A); acquire(B);
T2: acquire(B); acquire(A);
```

若 `T1` 拿到 `A` 后切换，`T2` 拿到 `B`，之后 `T1` 等 `B`，`T2` 等 `A`，形成死锁。

### Part D

1. 若最多只有 $n-1$ 个线程各持有 1 个 token，则至少还有 1 个 token 空闲。规则规定这个最后 token 只能发给某个已持有 1 个 token 的线程，使它达到 2 个 token 并完成释放，所以系统总能产生一个完成者。
2. 如果允许 $n$ 个线程都先拿 1 个 token，则所有 token 都被占有，每个线程都还差 1 个 token 才能完成，没有任何线程能释放资源。这就是死锁状态。因此 $n-1$ 是避免该坏状态的最大上限。
3. 它只利用“每个线程最多需要 2 个同质资源”的特殊结构，比完整 Banker 更简单也更保守；Banker 可根据每个线程的最大需求和当前分配做更精细的安全序列判断。
:::

## 大题二：`mmap` 热更新与文件支持页面（20 分）

推理服务把只读模型文件 `model.current` 映射到多个 worker。热更新时，控制进程希望生成新模型并替换路径，同时不破坏仍在运行的旧 worker。

### Part A：File-backed page fault 流程（5 分）

把下面 6 个动作按一次 file-backed page fault 的合理顺序排列，并说明哪一步区分了“非法访问”和“合法但未驻留”。

```text
A. install PTE and restart the faulting instruction
B. check VMA range and permission
C. trap into kernel because PTE is invalid/non-resident
D. compute file offset from VMA and faulting address
E. look up page cache by (file object, page index)
F. if cache miss, submit disk read and block the faulting thread
```

### Part B：`rename` 热更新 vs 原地截断（5 分）

比较下面两种更新方案：

```text
Bad:  truncate old file; rewrite old file in place
Good: write model.tmp; fsync(model.tmp); rename(model.tmp, model.current)
```

1. 已经 `mmap` 旧文件的 worker，在 `rename` 后会自动看到新文件吗？为什么？（2 分）
2. 如果原地 `truncate` 到一半大小，旧 worker 访问原文件后半段映射时，合理的异常是什么？（1 分）
3. 为什么 `write tmp + fsync + rename` 更接近 all-or-nothing 更新？（2 分）

### Part C：Shared、Private 与 COW 的判定表（5 分）

父进程执行：

```c
char *s = mmap(NULL, len, PROT_READ|PROT_WRITE, MAP_SHARED,  fd, 0);
char *p = mmap(NULL, len, PROT_READ|PROT_WRITE, MAP_PRIVATE, fd, 0);
fork();
```

子进程随后执行：

```c
s[0] = 'S';
p[0] = 'P';
```

填写下表，并说明 `MAP_PRIVATE` 第一次写入触发的机制。

| 观察者 | 读 `s[0]` | 读 `p[0]` |
| --- | --- | --- |
| 子进程 | ? | ? |
| 父进程 | ? | ? |
| 底层文件最终内容 | ? | ? |

### Part D：选择 `mmap` 还是 `read`（5 分）

给出两个访问模式，并分别选择 `mmap` 或显式 `read` 更合适。要求每个模式都说明理由。

- 模式 1：顺序扫描 200 GB 文件，每个字节只看一次。
- 模式 2：多个进程共享读取同一大文件中的少量随机页面，并且这些页面会被反复访问。

:::tip 答案与解析
### Part A

合理顺序是：

```text
C -> B -> D -> E -> F -> A
```

`B` 是关键：内核检查 faulting address 是否属于某个合法 VMA，以及本次读/写/执行权限是否允许。如果不属于合法区域或权限不匹配，就是非法访问或 protection fault；如果合法但页未驻留，才继续按 file-backed page fault 调页。

### Part B

1. 不会。已有 mapping 绑定的是旧的打开文件对象/inode 和它的页缓存；`rename` 改变的是目录名到文件对象的映射。新打开者看到新文件，旧 worker 继续引用旧文件。
2. 类似 `SIGBUS` 的同步异常。地址仍在原映射范围内，但对应文件范围已经不存在，不能通过普通调页修复。
3. 临时文件写完并 `fsync` 后，新版本内容先 durable；`rename` 使目录名原子切换到新 inode。崩溃后通常看到旧完整版本或新完整版本，而不是半截旧文件加半截新文件。

### Part C

| 观察者 | 读 `s[0]` | 读 `p[0]` |
| --- | --- | --- |
| 子进程 | `S` | `P` |
| 父进程 | `S` | 原文件旧值 |
| 底层文件最终内容 | 可能变为 `S` | 不因 `P` 改变 |

`MAP_SHARED` 写入共享 file-backed page，父子和文件共享这份修改，持久化时间由 writeback 或 `msync` 控制。`MAP_PRIVATE` 第一次写触发 copy-on-write：内核给子进程分配私有页、复制旧内容，并把子进程 PTE 改到私有页。

### Part D

模式 1 更适合显式 `read` 或带大缓冲的流式 I/O：访问完全顺序、一次性，应用能控制缓冲大小和错误处理，也可配合 use-once/read-ahead，避免大量 page fault 和地址空间压力。  
模式 2 更适合 `mmap`：多个进程可共享 page cache 中同一批 file-backed pages，随机访问写法简单，反复访问能摊销 page fault 成本。
:::

## 大题三：Scan-Resistant Buffer Cache（20 分）

Buffer cache 容量为 $k$。热点集合为 $H=\{H_1,\dots,H_k\}$，一开始恰好都在主缓存中。夜间顺序扫描会访问大量只用一次的冷块。

### Part A：LRU 的对抗构造（5 分）

1. 构造一个长度为 $2k$ 的访问串，使普通 LRU 在这 $2k$ 次访问中全部 miss，或除初始条件外接近全 miss。（3 分）
2. 解释这个构造为什么不是“LRU 实现细节问题”，而是 recency 信号本身在顺序扫描下失效。（2 分）

### Part B：Use-Once/Two-Queue 核心伪代码（6 分）

补全下面策略。要求：第一次见到的非流式块进入 `A1`；在 `A1` 中再次命中才晋升到 `Am`；带 `use_once` 的块不污染 `Am`。

```c
void access(block x, bool use_once) {
    if (in_Am(x)) {
        move_to_mru(Am, x);
    } else if (in_A1(x)) {
        remove(A1, x);
        insert_mru(____(1)____, x);
    } else {
        read_from_disk(x);
        if (use_once) {
            attach_to____(2)____(x);
        } else {
            insert_mru(____(3)____, x);
        }
    }
}

block victim(void) {
    if (exists_clean_block(____(4)____)) return lru_clean_from(____(4)____);
    block v = choose_lru_candidate();
    if (v.dirty) send_to____(5)____(v);
    return v;
}
```

### Part C：不变量证明（5 分）

证明：若所有冷扫描块都带 `use_once`，并且 clean 的 `use_once` 块在使用后不进入 `Am`，那么任意长度的冷扫描都不会从 `Am` 中淘汰热点集合 $H$。请写出归纳不变量。

### Part D：脏块为什么破坏“立即丢弃”（4 分）

构造一个场景：某个 `use_once` 块被写成 dirty，导致它不能像 clean streaming block 一样立即释放。设计一个两状态处理流程，使它既不长期污染 `Am`，又不会丢失数据。

:::tip 答案与解析
### Part A

访问串可以是：

```text
S1, S2, ..., Sk, H1, H2, ..., Hk
```

其中所有 `Si` 都不在缓存中。前 $k$ 个冷块依次 miss，并把 $H_1,\dots,H_k$ 挤出；后 $k$ 次访问热点时，热点都已不在缓存中，因此再次全 miss。这个构造说明顺序扫描会把“最近访问过”伪装成“将来还会用”，而 LRU 无法区分一次性新块和真正热点。

### Part B

1. `Am`
2. `temporary/use_once list`
3. `A1`
4. `A1` 或 `temporary/use_once list`
5. `writeback queue`

核心思想是：一次性块可以服务当前请求，但不晋升到主缓存；只有被第二次访问的块才证明有复用价值。

### Part C

不变量：每次冷扫描访问前后，`Am` 中的热点集合 $H$ 不变。  
归纳基：初始 `Am` 包含 $H$。  
归纳步：访问一个带 `use_once` 的冷块时，它只进入临时列表，或用完后立即释放；策略不从 `Am` 中选择 victim 来容纳它。因此本次访问不会删除 `Am` 中任何 $H_i$。对任意长度扫描反复应用归纳步，$H$ 始终保留。

### Part D

场景：顺序备份程序写出临时块 `S`，它带 `use_once`，但写后 `S.dirty=true`。如果立即丢弃，会丢失尚未落盘的数据。  
两状态流程：

```text
TEMP_DIRTY -> enqueue writeback
writeback done -> TEMP_CLEAN -> free/evict
```

它不进入 `Am`，所以不污染热点；但 dirty 状态必须先通过 writeback queue 持久化，之后才能释放。
:::

## 大题四：安全替换配置文件与日志恢复（20 分）

数据库更新 `config.json` 时使用：

```text
write config.tmp
fsync(config.tmp)
rename(config.tmp, config.json)
fsync(parent directory)
```

底层文件系统使用 delayed writes 和 redo journal。

### Part A：省略步骤的反例（6 分）

分别说明省略下面步骤后，构造一个 crash 点会导致什么坏结果：

1. 省略 `fsync(config.tmp)`。（2 分）
2. 省略 `fsync(parent directory)`。（2 分）
3. 不使用临时文件，直接原地覆盖 `config.json`。（2 分）

### Part B：Redo Journal 的判定规则（5 分）

Crash 后 journal 中有：

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

1. 哪些事务 replay？哪些 discard？（2 分）
2. 证明 redo replay committed transaction 是幂等的。（2 分）
3. 如果 `COMMIT T3` durable 了，但 `UPDATE T3 C := c3` 没 durable，违反了什么写前规则？（1 分）

### Part C：Rename 的偏序约束（5 分）

一次 `rename("tmp","final")` 涉及：

```text
D_new: add "final"
I:     update link count / metadata
D_old: remove "tmp"
```

设计一个 journal 中的偏序，使 crash 后不会出现“两个名字都消失”。再给出一个违反偏序的坏顺序，并说明坏状态。

### Part D：COW 的 all-or-nothing 证明（4 分）

小文件系统只有：

```text
Root -> Dir -> Inode
```

用 copy-on-write 更新 `Dir`。说明应写哪些新块、最后切换哪个指针，并证明 crash 后只能看到旧版本或新版本。

:::tip 答案与解析
### Part A

1. 若省略 `fsync(config.tmp)`，可能 rename 已持久化，但临时文件内容尚未持久化；恢复后 `config.json` 指向新 inode，却是空文件、旧块或部分内容。
2. 若省略父目录 `fsync`，临时文件内容可能已 durable，但目录项切换未 durable；恢复后可能仍看到旧 `config.json`，应用无法确认 rename 是否真正持久化。
3. 原地覆盖会让崩溃暴露中间状态，例如前半是新配置、后半是旧配置；既不是旧完整版本，也不是新完整版本。

### Part B

1. `T1` 和 `T3` 有 commit，应 replay；`T2` 没有 commit，应 discard。
2. Redo 记录写的是确定的新镜像，例如 `A := a1`。第一次 replay 后 home location 已是 `a1`；第二次 replay 仍写入 `a1`，不会产生额外语义变化，因此幂等。
3. 违反 write-ahead logging：commit record 不能先于该事务所有 update log records 持久化。否则恢复时知道必须 redo，却缺少完整 redo 信息。

### Part C

一种偏序是：

```text
log(D_new add final) -> log(I metadata update) -> log(D_old remove tmp) -> COMMIT
```

如果先持久化 `D_old remove tmp`，而 crash 发生在 `D_new add final` 前，就可能旧名字消失、新名字还没出现，文件不可达。Journal 的 commit record 把这组偏序更新变成二元规则：无 commit 则整体丢弃，有 commit 则整体 replay。

### Part D

COW 写出新目录块 `Dir'`，其中包含更新后的目录项；若 inode 也变化，则写出 `Inode'`。最后原子地把 `Root` 从旧 `Dir` 切到 `Dir'`。如果 crash 发生在 root 切换前，旧 root 仍指向旧 `Dir`，看到旧版本；如果 crash 发生在 root 切换后，沿新 root 能到达 `Dir'`，看到新版本。中间写出的孤儿新块可由清理过程回收。
:::

## 大题五：2PC 的不确定区间与非阻塞化改造（20 分）

三个 shard 参与一次事务：`S1` 扣减课程容量，`S2` 写学生课表，`S3` 写审计日志。协调者为 `C`。系统使用 Two-Phase Commit。

### Part A：只看本地 stable log 的决策表（5 分）

参与者 crash 后恢复，只能读取自己的 stable log。填写决策表：

| 本地最后相关记录 | 能否单方面决定？ | 决定 |
| --- | --- | --- |
| 没有 `YES`，也没有 decision | ? | ? |
| `YES`，没有 decision | ? | ? |
| `GLOBAL_ABORT` | ? | ? |
| `GLOBAL_COMMIT` | ? | ? |

### Part B：READY 不能单方面 abort 的证明（5 分）

证明：处于 READY 状态、已经 durable 写入 `YES`、但没有收到 decision 的参与者，不能因为 coordinator 暂时不可达就单方面 abort。要求使用两个对该参与者不可区分的执行历史。

### Part C：参与者之间的 termination protocol（5 分）

READY 参与者 `P` 联系其他参与者查询状态。设计一个安全规则：

- 如果某个参与者回复 `GLOBAL_COMMIT`，`P` 应该怎么做？
- 如果某个参与者回复 `GLOBAL_ABORT`，`P` 应该怎么做？
- 如果所有能联系到的参与者都只说 `YES/READY`，`P` 能否决定？
- 如果联系到一个从未写 `YES` 的参与者，为什么通常可以帮助 abort？

### Part D：复制 coordinator decision log（5 分）

把 coordinator 的 decision log 复制到 $2f+1$ 个副本；只有当 decision 写入至少 $f+1$ 个副本后才通知参与者。

1. 证明任意两个大小为 $f+1$ 的副本集合必相交。（2 分）
2. 为什么这能容忍 $f$ 个副本崩溃后仍查到已经提交的 decision？（1.5 分）
3. 这种方法降低了哪类 blocking？又引入什么成本？（1.5 分）

:::tip 答案与解析
### Part A

| 本地最后相关记录 | 能否单方面决定？ | 决定 |
| --- | --- | --- |
| 没有 `YES`，也没有 decision | 能 | ABORT |
| `YES`，没有 decision | 不能 | BLOCK / query others |
| `GLOBAL_ABORT` | 能 | ABORT |
| `GLOBAL_COMMIT` | 能 | COMMIT |

关键行是 `YES` 但无 decision：该参与者已经承诺如果全局 commit 就必须 commit，因此不能自己 abort。

### Part B

构造两个历史。  
历史 1：coordinator 已收齐所有 `YES`，durable 写入 `GLOBAL_COMMIT`，并把 commit 发给另一个参与者后崩溃。  
历史 2：coordinator 尚未做出决定，或最终会 abort。  
对本参与者来说，两种历史都表现为：自己写了 `YES`，没有收到 decision，coordinator 暂时不可达。本地观测不可区分。如果它在这种观测下 abort，就会在历史 1 中与已经 commit 的参与者冲突，破坏 atomicity。因此 READY 不能单方面 abort。

### Part C

若任何参与者已经知道 `GLOBAL_COMMIT`，`P` 必须 commit；若任何参与者已经知道 `GLOBAL_ABORT`，`P` 必须 abort。若所有能联系到的参与者都只是 `YES/READY`，没人知道最终决定，`P` 仍不能安全决定，只能继续等待或查询 coordinator。若联系到一个从未写 `YES` 的参与者，说明 unanimous yes 不可能成立；在 coordinator 尚未 durable commit 的前提下，abort 是安全方向。实际协议仍要小心 coordinator 是否已记录 commit。

### Part D

1. 若两个大小为 $f+1$ 的集合不相交，它们合起来至少有 $2f+2$ 个副本，超过全集 $2f+1$，矛盾。因此任意两个多数集合必相交。
2. Decision 已写入某个 $f+1$ 集合。最多 $f$ 个副本崩溃，所以这个集合中至少还有 1 个副本存活，恢复者可以查询到 decision。
3. 它降低 coordinator 单点崩溃导致 READY 参与者无处查询 decision 的 blocking。成本是额外副本、更多同步写入、提交延迟、复制协议复杂性，以及多数派可用性假设。
:::
