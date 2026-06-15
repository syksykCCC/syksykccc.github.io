# 期末考试模拟试题 FinalMock5

## 试卷说明

- 题型：大题 5 题，每题 20 分，共 100 分。
- 覆盖重点：虚拟内存、页面替换、buffer cache、崩溃一致性、分布式查找与提交。整体以后半学期内容为主。
- 题目风格：每题都从一个小模型出发，要求通过构造、计算或证明推出一般结论。答案写在题后折叠框中。

## 大题一：TLB 冲突的模运算构造（20 分）

一个进程反复访问若干虚拟页。TLB 有 `S` 个 set，每个 set 有 `W` 路，TLB index 为：

```text
set(VPN) = VPN mod S
```

忽略 page fault，只考虑 TLB hit/miss。TLB 采用 LRU 替换。

### Part A：一个看似小的 stride 为什么会全 miss（5 分）

设 `S = 4`，`W = 2`。访问串为：

```text
0, 4, 8, 12, 0, 4, 8, 12, ...
```

1. 写出这 4 个 VPN 分别落在哪个 set。（2 分）
2. 从空 TLB 开始，说明进入稳定循环后为什么每次访问都是 TLB miss。（3 分）

### Part B：等差访问串的 set 覆盖数（5 分）

考虑一般访问集合：

```text
P = { a, a + d, a + 2d, ..., a + (m - 1)d }
```

其中 set index 按 `mod S` 计算。

1. 证明这些页最多只会落入

$$
\frac{S}{\gcd(d,S)}
$$

个不同 set。（3 分）
2. 若访问串循环遍历 `P`，给出“不会发生稳定 TLB 抖动”的一个充分必要条件。（2 分）

### Part C：padding 能不能救 stride 冲突（5 分）

程序员尝试给数组前面加 `b` 个 page 的 padding，使访问集合变成：

```text
P_b = { a + b, a + b + d, ..., a + b + (m - 1)d }
```

1. 证明改变 `b` 只能整体平移 set residue，不能改变 Part B 中的 set 覆盖数。（2 分）
2. 对 `S = 8`，`W = 2`，`d = 4`，求使循环访问必然稳定抖动的最小 `m`。（2 分）
3. 在本题的 `VPN mod S` TLB 模型下，page coloring 能否消除这种冲突？如果冲突发生在 physically indexed cache 中，答案又如何？（1 分）

### Part D：VIPT L1 cache 的页内 index 边界（5 分）

一个 virtually indexed, physically tagged 的 L1 cache 希望在 TLB 返回物理页号前并行访问 cache。页大小为 `P` 字节，cache line 为 `B` 字节，相联度为 `A`。为了避免 synonym 问题，所有 cache index bits 必须来自 page offset。

1. 推导 cache 容量 `C` 必须满足的上界。（3 分）
2. 对 `P = 4 KiB`，`B = 64 B`，`A = 8`，求最大 `C`。（2 分）

:::tip 答案与解析
### Part A

1. 四个 VPN 的 set 都是 0，因为 `0 mod 4 = 4 mod 4 = 8 mod 4 = 12 mod 4 = 0`。
2. set 0 只有 2 路，却要循环容纳 4 个页。访问 `0,4` 后 set 0 满；访问 `8` 淘汰最久未用的 `0`；访问 `12` 淘汰 `4`；下一次访问 `0` 时它已被淘汰。之后同理，每个将要访问的页恰好都已经被前两个新页挤出，所以稳定后全 miss。

### Part B

1. set 序列为：

$$
a,\ a+d,\ a+2d,\ldots \pmod S
$$

设 `g = gcd(d,S)`。每次加 `d` 不会改变 residue 对 `g` 的余数，因此只能落在同一个 residue class 中。这个 residue class 里共有 `S/g` 个 set。另一方面，步长 `d/g` 与 `S/g` 互质，所以在模 `S/g` 意义下会遍历全部 `S/g` 个位置。因此覆盖数正好不超过 `S/g`。

2. 循环遍历 `P` 时，稳定不抖动的充分必要条件是：每个 set 中被循环访问的不同 VPN 数量不超过 `W`。若某个 set 中有 `W+1` 个页按循环访问，则该 set 内部就是“容量为 `W` 的 LRU 访问 `W+1` 个循环页”，稳定后每次访问该 set 的页都会 miss；若每个 set 至多 `W` 个页，装满后都能保留。

### Part C

1. padding 后 set 序列变为：

$$
a+b+jd \pmod S
$$

这只是把原来的 residue 全部加上 `b`。加同一个常数是模 `S` 上的双射，所以不同 set 的数量不变。

2. `gcd(4,8)=4`，因此只覆盖 `8/4=2` 个 set。每个 set 有 2 路，总共能稳定容纳 `2 * 2 = 4` 个页。最小抖动规模是 `m = 5`。由抽屉原理，5 个页分到 2 个 set 中，至少一个 set 有 3 个页，超过 2 路。
3. 在本题的 TLB 模型下不能，因为 set 完全由 VPN 决定，OS 改变物理页颜色不会改变 `VPN mod S`。但若冲突发生在 physically indexed cache 中，OS 可以选择物理页号让这些页落入更多不同 set。page coloring 只对“由物理颜色决定 index”的缓存冲突有效。

### Part D

1. cache set 数为：

$$
\frac{C}{A B}
$$

需要的 index bits 为：

$$
\log_2 \frac{C}{A B}
$$

line offset bits 为 `log2 B`。二者合起来必须不超过 page offset bits `log2 P`：

$$
\log_2 B + \log_2 \frac{C}{A B} \le \log_2 P
$$

化简得：

$$
C \le A P
$$

2. 最大容量为：

$$
C = A P = 8 \times 4\text{ KiB} = 32\text{ KiB}
$$
:::

## 大题二：LRU 的对抗串与 reuse distance（20 分）

物理内存有 `k` 个页框。假设 `k >= 2`。页面替换算法在每次 miss 时替换一个已有页。

### Part A：一个循环串给出的线性差距（5 分）

考虑引用串：

```text
1, 2, ..., k, k+1, 1, 2, ..., k, k+1, ...
```

即 `k+1` 个页面循环访问。

1. 证明 LRU 在 warm-up 后每次引用都会 miss。（3 分）
2. 说明 MIN/OPT 在每轮长度 `k+1` 的循环中至多只需要 2 次 miss，并给出渐进比值。（2 分）

### Part B：reuse distance 是 LRU 的精确判据（5 分）

对一次引用 `x`，定义它的 reuse distance 为：从上一次引用 `x` 之后到本次引用之前，出现过的不同页面数量；若此前没出现过，则为无穷大。

证明：在容量为 `k` 的 LRU 中，一次非首次引用 `x` hit 当且仅当它的 reuse distance 小于 `k`。（5 分）

### Part C：构造“增加内存也救不了”的局部性断点（5 分）

对任意给定的 `k` 和任意正整数 `r`，构造一个只包含 `k+1` 个不同页面、长度至少为 `r(k+1)` 的引用串，使容量为 `k` 的 LRU 在 warm-up 后每次 miss，但容量为 `k+1` 的 LRU 在 warm-up 后每次 hit。（3 分）

这说明什么样的工作集边界最危险？（2 分）

### Part D：Stack Property 的一行证明（5 分）

一个替换算法满足 stack property：对同一引用前缀，容量为 `k` 时的驻留集合总是容量为 `k+1` 时驻留集合的子集。

1. 证明满足 stack property 的算法不可能出现 Bélády anomaly。（3 分）
2. 为什么 FIFO 不满足这个证明的关键前提？（2 分）

:::tip 答案与解析
### Part A

1. 看任意一轮 `1,2,...,k,k+1`。访问完前 `k` 个不同页后，LRU 保存的是最近访问的 `k` 个页。下一次访问 `k+1` 时，最久未用的 `1` 被淘汰；随后访问 `1`，它已经不在内存中，于是淘汰 `2`；再访问 `2`，它也刚被淘汰。这个链式追赶会一直持续，所以 warm-up 后每次都 miss。
2. MIN 知道未来。对 `k+1` 个循环页和 `k` 个页框，它每轮至少要 miss 一次，因为内存无法同时容纳全部 `k+1` 个页。另一方面，每轮开始时若缺的是本轮最后一个页，则本轮只有最后一次 miss；若缺的是中间某页，则在该页处 miss，并可淘汰本轮最后一个页，之后到最后一个页时再 miss 一次。因此每轮至多 2 次 miss。LRU 每轮约 `k+1` 次 miss，而 MIN 每轮至多 2 次 miss，差距随 `k` 线性增长，渐进比值为 $\Theta(k)$。

### Part B

LRU 保存的是“最近被访问过的 `k` 个不同页面”。若 `x` 的 reuse distance 小于 `k`，说明从上次访问 `x` 到现在，不到 `k` 个其他不同页面比 `x` 更新，因此 `x` 仍在最近 `k` 个不同页面中，必 hit。反过来，若 reuse distance 至少为 `k`，则已有至少 `k` 个不同页面在 `x` 之后被访问过，它们都比 `x` 更新，容量为 `k` 的 LRU 不可能还保存 `x`，故 miss。

### Part C

构造：

```text
(1, 2, ..., k, k+1)^r
```

容量为 `k` 时，Part A 已证明 warm-up 后每次 miss。容量为 `k+1` 时，第一次见到这些页面后全部装入，之后再也不需要替换，因此 warm-up 后每次 hit。

危险边界是：真实工作集大小只比内存容量大 1。此时算法并不是偶尔犯错，而是每次淘汰的页都恰好是下一轮马上要用的页。

### Part D

1. 若容量 `k` 在某次引用 hit，则目标页属于容量 `k` 的驻留集合。由 stack property，它也属于容量 `k+1` 的驻留集合，所以容量 `k+1` 也 hit。因此增加容量不会把任何原本 hit 的引用变成 miss，缺页次数不可能上升。
2. FIFO 的驻留集合由“进入内存的时间”决定。增加一个页框会改变之后的淘汰节奏，导致大容量下的队列内容不一定包含小容量下的队列内容，因此不满足驻留集合包含关系。
:::

## 大题三：Use-Once Cache 的必要性与极限（20 分）

Buffer cache 容量为 `h + c` 个块。热点集合 `H = {H1, ..., Hh}` 会反复访问；冷扫描块 `S1, S2, ...` 每个只访问一次。初始时 `H` 全在 cache 中，另外有 `c` 个空闲或可牺牲位置。

### Part A：普通 LRU 的精确污染量（5 分）

先访问一段长度为 `L` 的冷扫描：

```text
S1, S2, ..., SL
```

随后立即访问：

```text
H1, H2, ..., Hh
```

1. 在普通 LRU 下，冷扫描结束后有多少个热点块被挤出？答案用 `h`、`c`、`L` 表示。（3 分）
2. 随后的热点访问会产生多少个额外 miss？（2 分）

### Part B：没有 hint 时的不可区分下界（5 分）

考虑任意确定性在线 cache 策略，它看不到未来，也不知道 `S_i` 是 use-once。先给它同一个前缀：

```text
S1, S2, ..., S_{h+c}
```

此时从初始热点 `H` 和扫描块 `S` 合在一起看，一共出现过 `2h+c` 个不同块，但 cache 只能保存 `h+c` 个块，因此恰好有 `h` 个块不在 cache 中。

设这 `h` 个缺失块中有 `q` 个来自 `H`。证明：存在两个可能的后续阶段之一，使该策略至少产生

$$
\max(q,\ h-q) \ge \left\lceil \frac{h}{2} \right\rceil
$$

次 miss。解释这个下界为什么说明 use-once hint 是额外信息，而不只是实现技巧。（5 分）

### Part C：两队列 Use-Once 设计（5 分）

设计两个队列：

- `P`：protected queue，存放确认会复用的块，容量上限 `h`。
- `U`：use-once/probation queue，存放第一次看到或带 use-once hint 的块，容量上限 `c`。

补全伪代码：

```c
void access(block x, bool use_once) {
    if (in_P(x)) {
        move_to_mru(P, x);
    } else if (in_U(x)) {
        remove(U, x);
        insert_mru(____(1)____, x);
    } else {
        read_from_disk(x);
        if (use_once) insert_mru(____(2)____, x);
        else insert_mru(____(3)____, x);
    }
    while (size(P) > h) demote_lru(P, ____(4)____);
    while (size(U) > c) evict_lru(____(5)____);
}
```

填写 `(1)` 到 `(5)`，并解释为什么冷扫描不会挤出 `P` 中的热点。（5 分）

### Part D：dirty use-once 的反直觉边界（5 分）

如果 `S_i` 是 dirty block，系统不能在访问后立即丢弃它。

1. 写出 dirty use-once block 的最小状态机。（2 分）
2. 证明：只要 dirty use-once block 不进入 `P`，它最多消耗 `U` 或 writeback queue 的容量，不会破坏 Part C 对热点的保护。（3 分）

:::tip 答案与解析
### Part A

1. 前 `c` 个冷块可以使用空闲或牺牲位置，不必挤出热点。之后每多一个冷块，就会挤出一个热点，直到热点全被挤出。因此被挤出的热点数为：

$$
\min(h,\ \max(0,\ L-c))
$$

2. 随后访问 `H1,...,Hh` 时，额外 miss 数正好等于被挤出的热点数，即：

$$
\min(h,\ \max(0,\ L-c))
$$

### Part B

同一个前缀后，缺失块分成两类：

- `q` 个旧热点块不在 cache 中；
- `h-q` 个刚扫描过的块不在 cache 中。

若后续阶段是：

```text
H1, H2, ..., Hh
```

则至少有 `q` 次 miss。若后续阶段改成“访问那些不在 cache 中的扫描块”，则至少有 `h-q` 次 miss。两个可能世界有完全相同的历史前缀，在线策略无法在前缀结束时知道哪一个未来会发生，因此必有一个未来让它产生至少：

$$
\max(q,\ h-q) \ge \left\lceil \frac{h}{2} \right\rceil
$$

次 miss。

这个下界的含义是：第一次看到 `S_i` 时，系统仅凭历史无法判断它是一次性扫描还是新热点的开头。`use_once` hint 给了替换策略一个历史中没有的信息，允许它把“一次性块”隔离在 `U` 中。

### Part C

填空为：

```text
(1) P
(2) U
(3) U
(4) U
(5) U
```

第一次看到的普通块先进入 `U`，第二次命中 `U` 才晋升到 `P`。带 `use_once` hint 的块也只进入 `U`。当 `P` 超容量时，把 `P` 的 LRU 降级到 `U`；随后若 `U` 超容量，从 `U` 淘汰。

冷扫描块每个只访问一次，因此不会从 `U` 晋升到 `P`。只要 victim 优先来自 `U`，冷扫描造成的 churn 都被限制在 `U` 中，不能直接挤出 `P` 中的热点。

### Part D

1. 最小状态机：

```text
DIRTY_U -> WRITEBACK_PENDING -> CLEAN_U -> EVICTED
```

或者如果写回完成前仍被引用，可以停留在 `DIRTY_U` 并重新排队。

2. 关键不变量：dirty use-once block 的状态集合不属于 `P`。它可能占用 `U`，也可能挂在 writeback queue 上等待落盘，但替换策略从不因为它而从 `P` 选择 victim。写回完成后它变为 clean use-once block，可以从 `U` 直接淘汰。因此 dirty 只改变“何时能释放”，不改变“是否污染 protected 热点集合”。
:::

## 大题四：逻辑日志为什么不能替代物理 redo（20 分）

考虑一个极小文件系统。磁盘上有：

- inode bitmap；
- inode table；
- directory block。

`create("/d/x")` 的实现顺序是：

```text
1. 在 bitmap 中找第一个空闲 inode i，并标记已用
2. 初始化 inode i
3. 在目录 /d 中加入 ("x", i)
```

Bob 想优化 journaling：日志里只记录逻辑操作 `create("/d/x")`，恢复时重新执行这个操作，而不是记录被修改的物理块内容。

### Part A：一个三步操作中的崩溃反例（5 分）

构造一次崩溃：日志中已有 `create("/d/x")`，但磁盘只完成了步骤 1，没有完成步骤 2 和 3。恢复时 Bob 重新执行 `create("/d/x")`。

1. 说明可能出现什么错误状态。（3 分）
2. 这个错误的根因是“日志太晚写”还是“日志内容不够确定”？（2 分）

### Part B：同一条逻辑日志无法区分的两个世界（5 分）

构造两个崩溃后的磁盘状态 `A` 和 `B`，它们有同一条逻辑日志 `create("/d/x")`，但正确恢复动作不同。要求 `A` 中应该补完目录项，`B` 中重新执行会分配到不同 inode 并造成错误。（5 分）

### Part C：物理 redo 日志的最小偏序（5 分）

改用物理 redo journal。一次 transaction 记录三个 after-image：

```text
bitmap := bitmap'
inode[i] := inode'
dir[d] := dir'
```

并有 `BEGIN`、`COMMIT` 两条日志记录。写回顺序必须满足哪些偏序，才能保证 crash 后 recovery 要么重放完整 transaction，要么完全忽略它？（5 分）

### Part D：Copy-on-Write 的根指针证明（5 分）

另一种设计不覆盖旧块，而是写出：

```text
bitmap', inode_table', dir'
```

最后只原子更新一个 root pointer，使其指向新版本。

证明：如果 root pointer 的单块写是原子的，则任意时刻 crash 后可见的文件系统要么是旧版本，要么是新版本，不会看到半新半旧版本。（5 分）

:::tip 答案与解析
### Part A

1. 磁盘上 bitmap 已经把 inode `i` 标为占用，但 inode table 和目录项没有对应内容。恢复时重新执行 `create("/d/x")` 会再次寻找“第一个空闲 inode”。由于 `i` 已经被标记占用，系统可能分配 `i+1`，最后得到 inode `i` 泄漏，或者产生 bitmap、inode table、目录之间不一致的状态。
2. 根因是日志内容不够确定。即使逻辑日志写得足够早，`create("/d/x")` 也没有记录“本次 create 选择了 inode i”以及相关物理 after-image。恢复时重新执行不是同一个确定性动作。

### Part B

例子：

- 状态 `A`：bitmap 标记 inode `7` 已用，inode `7` 已初始化，但目录中还没有 `("x", 7)`。正确动作是补写目录项。
- 状态 `B`：bitmap 标记 inode `7` 已用，但 inode `7` 尚未初始化，目录中也没有 `x`。正确动作不是简单重新运行高层 `create`，因为重新运行会跳过 inode `7`，分配另一个 inode。

两者的逻辑日志都只是 `create("/d/x")`，但恢复所需动作依赖已经落盘的物理中间状态。只记录逻辑操作无法区分它们。

### Part C

必须满足：

1. 所有 redo after-image 日志记录先于 `COMMIT` durable。
2. `COMMIT` durable 后，checkpoint 才能把对应的 home location 写回。
3. recovery 扫描日志时，只重放有完整 `COMMIT` 的 transaction；没有 `COMMIT` 的 transaction 忽略。

偏序可写为：

```text
BEGIN < redo(bitmap'), redo(inode'), redo(dir') < COMMIT < checkpoint home blocks
```

redo 记录之间可以任意排序，但都必须在 `COMMIT` 前 durable。这样 crash 后若看不到 `COMMIT`，说明不能保证 redo 内容完整，直接忽略；若看到 `COMMIT`，则 redo 内容完整，重放 after-image 是幂等的。

### Part D

不变量：root pointer 指向的版本内部是自洽的。

在更新 root pointer 前，旧 root 仍指向旧的 bitmap、inode table、directory。新块即使已经写到磁盘，也没有被任何可达 root 引用，所以 crash 后不可见。原子切换 root pointer 后，root 一次性指向新版本；因为新版本的所有块已经先写好，所以 crash 后从 root 出发只能看到新版本。不存在 root 同时指向旧 bitmap 和新 directory 的状态，因此不会暴露半新半旧版本。
:::

## 大题五：Chord 查找中的二分结构与提交日志复制（20 分）

一个 Chord ring 使用 `m = 6` 位 identifier，编号范围是 `0..63`。当前在线节点为：

```text
1, 9, 18, 20, 37, 45, 52
```

key 由 `successor(key)` 负责。

### Part A：successor 与 finger table（5 分）

1. 求 key `0, 2, 19, 44, 53, 63` 分别由哪个节点负责。（2 分）
2. 写出节点 `9` 的 6 个 finger entry。第 `i` 项为：

$$
successor(9 + 2^{i-1} \bmod 64)
$$

其中 `i = 1..6`。（3 分）

### Part B：lookup 路径与“减半”直觉（5 分）

从节点 `9` 查找 key `44`。每一步选择 finger table 中严格位于当前节点和目标 key 之间、且最接近目标 key 的节点。

1. 写出查找路径。（3 分）
2. 用本例说明 finger table 为什么不是线性扫描。（2 分）

### Part C：新节点加入时移动多少 key（5 分）

现在新节点 `30` 加入。

1. 它的 predecessor 和 successor 分别是谁？（1 分）
2. 哪些 key 的负责人会从旧节点转移到 `30`？写成区间。（2 分）
3. 证明一般情况下，新节点 `x` 加入时，只有区间 `(pred(x), x]` 中的 key 会移动。（2 分）

### Part D：把 2PC decision log 放到 Chord 上（5 分）

系统把每个 transaction id 映射到 Chord 上的一个 key，并在其 successor 以及后继的 `r-1` 个节点上复制 decision log。假设最多有 `f` 个存储节点 crash-stop，且恢复者可以查询所有存活节点。

1. 为了保证已经写入的 decision 在 `f` 个 crash 后仍可被查到，`r` 至少是多少？（2 分）
2. 如果还要求任意两个可能成功写入的 decision quorum 必相交，应使用 `N` 个副本中的写 quorum `W` 满足什么条件？（2 分）
3. 这和 2PC coordinator 必须先 durable 决策再通知 participant 有什么关系？（1 分）

:::tip 答案与解析
### Part A

1. successor 结果：

| key | successor |
| --- | --- |
| 0 | 1 |
| 2 | 9 |
| 19 | 20 |
| 44 | 45 |
| 53 | 1 |
| 63 | 1 |

2. 节点 `9` 的 finger start 为：

| i | start | successor(start) |
| --- | --- | --- |
| 1 | 10 | 18 |
| 2 | 11 | 18 |
| 3 | 13 | 18 |
| 4 | 17 | 18 |
| 5 | 25 | 37 |
| 6 | 41 | 45 |

### Part B

1. 从 `9` 到 key `44`，可选 finger 中最接近且小于 `44` 的是 `37`，所以第一跳到 `37`。在节点 `37` 看 key `44`，其 successor 是 `45`，且 `44` 落在 `(37,45]` 中，因此路径是：

```text
9 -> 37 -> 45
```

2. 线性 successor 扫描会走 `9 -> 18 -> 20 -> 37 -> 45`。finger table 允许第一跳跨到 `37`，直接跳过中间多个节点。其本质是按 `1,2,4,8,...` 的尺度保存远近不同的捷径。

### Part C

1. 新节点 `30` 的 predecessor 是 `20`，successor 是 `37`。
2. 原来 `(20,37]` 的 key 都由 `37` 负责。加入 `30` 后，`(20,30]` 改由 `30` 负责，`(30,37]` 仍由 `37` 负责。因此移动区间是：

```text
(20, 30]
```

3. Chord 的规则是 key 归第一个顺时针不小于它的节点负责。新节点 `x` 加入前，区间 `(pred(x), succ(x)]` 由 `succ(x)` 负责；加入后，只有 `(pred(x), x]` 中的 key 的第一个顺时针节点变成了 `x`。其他 key 的 successor 不变，所以不会移动。

### Part D

1. 若 decision 写在 `r` 个副本上，最多 `f` 个 crash 后仍要至少剩 1 个副本，因此需要：

$$
r \ge f+1
$$

2. 若在 `N` 个副本中，任意两个成功写 quorum 都必须相交，则需要：

$$
2W > N
$$

即：

$$
W > \frac{N}{2}
$$

3. 2PC 的关键是 participant 收到 commit/abort 后，未来恢复必须能查到同一个 durable decision。复制 decision log 是把“coordinator 本地 durable”推广成“分布式 durable”；若通知先于 durable decision，participant 之后可能处于无法恢复的 blocked/uncertain 状态。
:::
