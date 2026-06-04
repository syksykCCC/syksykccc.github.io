# Lec17 - 内存 4：按需分页

## 学习目标
学完本讲后，你应当能够把按需分页理解为一个缓存管理问题，比较主要的页面替换策略，计算典型引用串下的缺页次数，解释为什么会出现 Bélády anomaly，描述 Clock 系列算法如何近似 LRU，并能够分析页框分配、抖动以及工作集模型。

## 1. 把按需分页看作缓存
按需分页把 DRAM 当作页面缓存，而完整的后备副本位于磁盘或其他更低层的对象中。缓存块大小就是一个页面，例如 4KB；组织方式可以理解为 **全相联**，因为任意虚拟页都可以放入任意物理页框。

一次查找沿着前面已经建立的层次进行：
- 处理器发出虚拟地址。
- 先查 TLB，寻找缓存好的虚拟页到物理页框的映射。
- TLB miss 时遍历页表。
- 如果页表项说明页面当前不在内存中，这次 miss 就变成 page fault，OS 会从更低层取回该页面，通常是从磁盘读取。

写操作采用类似 write-back 的方式。OS 不会把每一次内存写入都立刻同步到磁盘，而是把页面标记为 dirty，并且只在替换或同步需要时再写回。

于是核心策略问题变成：当物理内存已满而又必须调入新页面时，应该替换哪个旧页面？

:::remark 问题：为什么页面替换比普通 cache 替换更重要？
一次糟糕的 cache 替换通常只是多付出一次低层内存访问；一次糟糕的页面替换却可能带来一次磁盘 I/O，并让进程长时间停住。页面替换还会影响调度和公平性：如果 OS 把某个进程的重要工作页面换出，该进程可能大部分时间都在缺页，而不是在真正执行。
:::

## 2. 页面替换策略
页面替换策略本质上是在猜测：当前驻留内存的页面中，哪一个最不值得继续保留。不同策略在最优性、实现成本、可预测性以及利用局部性的能力上各不相同。

### 2.1 FIFO、RANDOM、MIN 与 LRU
几个基础策略如下：

| 策略 | 核心规则 | 优点 | 缺点 |
|---|---|---|---|
| **FIFO（First In, First Out）：替换最老的页面。** | 淘汰驻留时间最长的页面。 | 简单；从驻留时间角度看比较公平。 | 可能只因为页面来得早，就淘汰一个正在频繁使用的页面。 |
| **RANDOM：每次随机选择一个页面替换。** | 从驻留页面中均匀或伪随机选择一个页面。 | 实现极其简单；常见于某些小型硬件结构，例如部分 TLB。 | 行为不可预测，最坏情况很难保证。 |
| **MIN（Minimum）：替换最长时间不会再被使用的页面。** | 淘汰下一次未来使用最晚的页面。 | 对已知引用串是可证明最优的。 | 在线运行时无法实现，因为未来不可知。 |
| **LRU（Least Recently Used）：替换最长时间没有被使用的页面。** | 用过去预测未来，淘汰最近最久未被引用的页面。 | 在存在局部性时通常效果很好。 | 对分页而言，精确 LRU 很贵，因为几乎每次内存引用都要更新 recency 状态。 |

![LRU 链表实现](./lec17_materials/lru_list_implementation.png)

一种自然的精确 LRU 实现是维护一个链表。最近使用的页面放在表头，最久未使用的页面放在表尾。每当页面被使用，就把它从当前位置移除并放到表头；替换时移除表尾页面。

这个链表思想很清楚，但用于分页时很难承受：页面使用发生在普通 load、store 和取指过程中，精确维护意味着几乎每次内存引用都需要硬件或 OS 更新状态。因此真实系统通常只近似 LRU。

:::remark 问题：FIFO、RANDOM、MIN 和 LRU 中应该偏好哪一个？
MIN 是评估基准，因为在已知未来引用串时它产生最少缺页，但它不能在线实现。LRU 通常是最有用的思维模型，因为局部性常常让最近历史能够预测未来。FIFO 的主要吸引力只是简单，但可能表现很差。RANDOM 适用于实现简单性比确定性行为更重要的场景，尤其是小型硬件结构。
:::

### 2.2 FIFO 示例
考虑 3 个物理页框、4 个可能的虚拟页，以及如下引用串：

```text
A B C A B D A D B C B
```

FIFO 先用 `A`、`B` 和 `C` 填满 3 个页框。接下来 `A` 和 `B` 都命中。当 `D` 到来时，FIFO 会替换 `A`，因为 `A` 是当前最老的驻留页面；但 `A` 紧接着就要再次被使用。这个过早替换带来了额外缺页。

![FIFO 引用串示例](./lec17_materials/fifo_reference_string_example.png)

| 步骤 | 引用 | FIFO 下的结果 | 步骤结束后的页框 |
|---|---|---|---|
| 1 | A | 缺页，装入 A | A - - |
| 2 | B | 缺页，装入 B | A B - |
| 3 | C | 缺页，装入 C | A B C |
| 4 | A | 命中 | A B C |
| 5 | B | 命中 | A B C |
| 6 | D | 缺页，替换 A | D B C |
| 7 | A | 缺页，替换 B | D A C |
| 8 | D | 命中 | D A C |
| 9 | B | 缺页，替换 C | D A B |
| 10 | C | 缺页，替换 D | C A B |
| 11 | B | 命中 | C A B |

总计是 **7 次 page fault**。这个例子说明的不是 FIFO “过时”，而是驻留时间并不等于页面未来是否有用。

### 2.3 同一引用串上的 MIN 与 LRU
对同一个引用串，MIN 使用未来信息：

```text
A B C A B D A D B C B
```

装入 `A`、`B`、`C` 后，第一个关键 miss 是 `D`。此时未来引用为：

```text
A D B C B
```

在驻留页面 `A`、`B`、`C` 中，`C` 下一次使用最晚，因此 MIN 替换 `C`，而不是替换 `A`。这就避免了 FIFO 后面遇到的那次立即的 `A` 缺页。

![MIN 与 LRU 引用串示例](./lec17_materials/min_lru_reference_string_example.png)

| 步骤 | 引用 | MIN 决策 | LRU 决策 |
|---|---|---|---|
| 1-3 | A, B, C | 三次 compulsory fault | 三次 compulsory fault |
| 4-5 | A, B | 命中 | 命中；最近使用顺序变成 B, A, C |
| 6 | D | 缺页，替换 C，因为 C 在未来最晚使用 | 缺页，替换 C，因为 C 最近最久未使用 |
| 7-9 | A, D, B | 命中 | 命中 |
| 10 | C | 缺页，替换 A 或 D，因为二者之后都不再需要 | 缺页，替换 A，因为 A 最近最久未使用 |
| 11 | B | 命中 | 命中 |

在这个具体引用串上，MIN 和 LRU 都产生 **5 次 page fault**。这里 LRU 恰好做出了和 MIN 相同的关键决策，但这种一致性并不总是成立。

:::remark 问题：为什么这个例子中 LRU 会和 MIN 一致？
因为最近过去恰好很好地预测了未来。在 `D` 到来前，`C` 既是下一次使用最晚的页面，也是最近最久未使用的页面。换一个访问模式，这两个事实就可能分离。
:::

### 2.4 LRU 什么时候会表现很差
当工作集只比物理内存大一个页面，并且程序循环访问所有页面时，LRU 可能表现得非常糟：

```text
A B C D A B C D A B C D
```

在 3 个页框下，LRU 的每一次引用都会缺页。装入 `A`、`B`、`C` 之后，访问 `D` 会替换 `A`；下一次访问 `A` 又替换 `B`；随后 `B` 替换 `C`，如此循环。FIFO 在这个循环引用串上表现相同。

MIN 不会出现同样的崩溃。凭借未来信息，在前三次 compulsory fault 之后，它总是能替换下一次使用最晚的页面。对这个 12 次引用、3 个页框的引用串，MIN 只需要 **6 次 fault**，而 LRU 需要 **12 次 fault**。

:::remark 问题：这是否说明 LRU 很差？
不是。这个例子是刻意构造的对抗模式：4 个同样活跃的页面争夺 3 个页框。LRU 仍然是很强的局部性启发式，但它不是最优性保证。这个例子的价值在于区分“在局部性下通常很好”和“永远最优”。
:::

## 3. Stack Property 与 Bélády's Anomaly
如果一个页面替换策略满足 **stack property**，那么在同一个引用前缀下，用 `n` 个页框保存的页面集合，总是用 `n + 1` 个页框保存的页面集合的子集。满足这个性质时，增加内存不会增加缺页次数。

LRU 和 MIN 满足 stack property：
- 对 LRU 而言，`n` 个页框保存最近使用的 `n` 个页面；`n + 1` 个页框就是在这些页面之外再多保存一个。
- 对 MIN 而言，理想化的栈顺序可以按未来使用距离来理解；多保留一个页面是在原集合基础上增加页面，而不是彻底改变驻留集合。

FIFO 不满足 stack property。增加一个页框会改变替换队列，甚至可能让后续引用表现更差。

### 3.1 Bélády's Anomaly 示例
经典 FIFO 反例使用如下引用串：

```text
A B C D A B E A B C D E
```

![Bélády anomaly 的 FIFO 示例](./lec17_materials/belady_anomaly_fifo_example.png)

| FIFO 页框数 | 发生缺页的引用 | 总缺页数 | 发生了什么 |
|---|---|---|---|
| 3 个页框 | A, B, C, D, A, B, E, C, D | **9** | `E` 被装入后，`A` 和 `B` 仍然保留得足够久，因此后面命中。 |
| 4 个页框 | A, B, C, D, E, A, B, C, D, E | **10** | 多出来的页框改变了 FIFO 顺序，`E` 替换掉 `A`，之后触发一串连续缺页。 |

这就是 **Bélády's anomaly**：对 FIFO 而言，增加页框数反而可能增加 page fault 数。这个现象之所以反直觉，是因为我们误以为“更多内存”必然意味着“原来的页面集合再加一个页面”；FIFO 恰好破坏了这个假设。

:::remark 问题：增加内存是否一定会减少 page fault？
不一定。对 LRU 和 MIN 这样的 stack algorithm 来说可以保证；对 FIFO 则不保证。关键在于更多页框下的驻留集合是否包含更少页框下的驻留集合。FIFO 的队列顺序可能改变得很厉害，从而让更大的内存保存了一组不同且更差的页面。
:::

## 4. Clock：对 LRU 的实用近似
精确 LRU 很昂贵，因为它需要在每一次内存引用时立即更新 recency 状态。Clock 使用每页一个由硬件维护的 bit 来近似 LRU。

**Clock Algorithm：把物理页面排成环形列表，并使用一个 clock hand。** 每个物理页面有一个硬件 **use bit**，在 Intel 术语中也叫 **accessed bit**。只要页面被引用，硬件就会设置 use bit。

![Clock 算法总览](./lec17_materials/clock_algorithm_overview.png)

发生 page fault 时，clock hand 沿着页面移动：
1. 如果当前页面 `use = 1`，说明它最近被使用过。OS 清零该 bit，给页面第二次机会，并继续移动指针。
2. 如果当前页面 `use = 0`，说明它自上次扫描以来没有被引用。OS 选择它作为替换候选。
3. 如果 victim 是 dirty，OS 先把它写回磁盘。
4. OS 使旧 PTE 和任何过时 TLB entry 失效。
5. OS 装入新页面、更新 PTE；新页面在被引用时会设置 use bit。

![Clock 替换与装入流程](./lec17_materials/clock_replacement_load_flow.png)

Clock 替换的不是“最老的那一页”，而是“某个足够老的页面”。这正是它比精确 LRU 便宜、但只能近似 LRU 的原因。

:::remark 问题：Clock 一定能找到可替换页面吗，还是可能无限循环？
Clock 一定能找到候选页面。如果所有页面都是 `use = 1`，第一次完整扫描会把所有 bit 清为 `0`。下一轮扫描时，除非所有页面又都被重新引用，否则指针会遇到 `use = 0` 的页面。最坏情况下它可能扫描很多页面，但逻辑上不会无限循环。
:::

:::remark 问题：clock hand 走得慢是好事还是坏事？走得快呢？
hand 走得慢通常是好事：要么 page fault 不多，要么很快就能找到 `use = 0` 的页面。hand 走得快通常是警告：要么 page fault 很频繁，要么大多数页面的 use bit 总是被重新设置，说明系统处在内存压力下。
:::

### 4.1 N-th Chance Clock
**Nth Chance algorithm：给页面 N 次机会。** 它不是第一次发现 use bit 为 0 就替换页面，而是让 OS 为每个页面维护一个扫描计数器。

![N-th chance clock 算法](./lec17_materials/nth_chance_clock_algorithm.png)

每次 page fault 时：
- 如果 `use = 1`，清零 use bit，并把该页面的扫描计数器重置为 `0`。
- 如果 `use = 0`，递增计数器。
- 如果计数器达到 `N`，替换该页面。

较大的 `N` 让算法更接近 LRU，因为页面必须经历多轮扫描且一直未被使用才会被淘汰。较小的 `N` 更高效，因为 clock hand 不需要扫描太远。Dirty page 通常会得到额外保护：clean page 可以用 `N = 1`，dirty page 可以用 `N = 2`；dirty page 第一次获得机会时，OS 可以开始把它写回磁盘，使后续替换更便宜。

:::remark 问题：N 应该如何选择？
没有通用最优值。大的 `N` 能减少过早淘汰，但会增加扫描成本；小的 `N` 能快速找到 victim，但可能淘汰仍有用的页面。系统会根据 page fault 成本、扫描开销以及写回 dirty page 的代价折中选择。
:::

### 4.2 模拟 Modified Bit 与 Use Bit
硬件支持很有帮助，但并非绝对必要。

对于 modified bit，OS 可以用权限来模拟：
1. 为每个页面维护一个软件 modified bit。
2. 即使程序逻辑上允许写，也先在硬件页表中把可写页面标记为 read-only。
3. 写入触发 fault 后，检查该写入是否合法。如果合法，设置软件 modified bit，并把页面标记为 writable。
4. 当 dirty page 被写回磁盘后，清零软件 modified bit，并再次把页面标记为 read-only。

对于 use bit，OS 可以通过临时把驻留页面标记为 invalid 来模拟引用：
1. 维护软件 use bit 和 modified bit。
2. 即使页面驻留内存，也先把它标记为 invalid。
3. 对该页面的读或写会 trap 到 OS，从而证明页面被使用过。
4. OS 设置软件 use bit。读操作可以恢复 read-only 访问；合法写操作还会设置 modified bit，并恢复写权限。
5. 当 clock hand 扫过时，OS 清零软件 use bit，并再次把页面标记为 invalid。

这种方法可行，但会把一些普通内存引用变成 trap。这是典型的硬件/软件权衡：更少的硬件 bit 可以用更多 OS 介入来替代。

:::remark 问题：真的必须有硬件支持的 modified bit 和 use bit 吗？
严格来说不是。二者都可以通过保护 fault 和 valid fault 来模拟。代价是开销：模拟机制故意制造 trap，让 OS 观察写入或引用。硬件 bit 的价值在于，它们可以在 common case 不 trap 的情况下记录同样的信息。
:::

### 4.3 Second-Chance List Algorithm
**Second-Chance List Algorithm** 是另一种近似 LRU 的设计，与 VAX/VMS 风格系统有关；这类系统并不依赖硬件 use bit。

![Second-chance list 算法](./lec17_materials/second_chance_list_algorithm.png)

内存被分成两个列表：
- **Active list** 包含直接映射且标记为 readable/writable 的页面。访问这些页面可以全速运行。
- **Second-Chance list** 包含被标记为 invalid 的页面。它们仍然占有物理页框，但触碰它们会产生 page fault，让 OS 知道页面又被需要了。

发生 page fault 时：
1. OS 把 Active list 末尾溢出的页面移动到 Second-Chance list 的表头，并标记为 invalid。
2. 如果目标页面已经在 Second-Chance list 中，OS 把它移动到 Active list 表头，并标记为 readable/writable。这会产生一次 trap，但不需要磁盘 I/O。
3. 如果目标页面不在两个列表中，OS 从磁盘把它调入 Active list 表头。
4. 如果需要腾出空间，OS 淘汰 Second-Chance list 表尾最近最久未使用的页面。

Second-Chance list 的大小控制算法行为：
- 如果大小为 `0`，算法退化得接近 FIFO。
- 如果它包含所有页面，算法接近 LRU，但每次页面引用都会 fault。
- 中间大小可以减少磁盘 I/O，同时接受一定的 trap 开销。

相比 FIFO，它的收益是减少磁盘访问，因为页面只有在长时间未使用后才会真正写出。代价是 OS 要处理更多 fault，即便页面仍然物理驻留在内存中。

### 4.4 Free List 与 Pageout Daemon
系统可以维护一个 **free list**，提前准备好可立即使用的页框，从而降低 page fault 延迟。

![Free list 与 pageout daemon](./lec17_materials/free_list_pageout_daemon.png)

free list 通常由后台 pageout daemon 填充，daemon 会运行 Clock 或类似替换策略：
- daemon 在 page fault 急需页框之前，提前扫描页面并准备 victim frame。
- dirty page 进入列表时就开始写回磁盘。
- 如果某个页面在页框被重新使用前又被触碰，它可以被放回 active set。
- 发生 page fault 时，OS 可以立即取一个干净的 free frame，而不用临时等待替换和磁盘写回。

这体现了很多 OS 优化的共同思路：尽可能把慢工作移出关键路径。

### 4.5 Reverse Page Mapping 与 Coremap
当 OS 淘汰一个物理页框时，必须让所有指向该页框的页表项失效。如果只有一个 PTE 映射该页框，这很简单；但共享页面会让问题复杂得多。共享代码、fork 后的地址空间、memory-mapped file 都可能让多个 PTE 指向同一个物理页面。

反向映射机制回答的是相反方向的问题：给定一个物理页框，哪些虚拟映射指向它？

这个机制必须很快，因为 OS 会在以下场景中使用它：
- 释放或替换物理页；
- 找到所有必须失效的 PTE；
- 检查页面是否近期活跃。

一种直接实现是在每个物理页描述符中维护一个指向它的 PTE 链表。这很精确，但维护成本高。Linux 风格的 object-based reverse mapping 则链接更粗粒度的内存区域描述符，例如程序代码区域或通过 `mmap()` 映射的文件。更粗粒度的设计降低了管理开销，但牺牲了一部分直接精确性。

## 5. 跨进程分配页框
替换策略决定淘汰哪个页面，而页框分配决定每个进程一开始能得到多少内存。

这里有三个大问题：
- 每个进程是否应该得到相同份额的内存？
- 更大的进程或更高优先级的进程是否应该得到更多页框？
- 当内存过紧时，OS 是否应该把某些进程完全 swap out？

每个驻留进程都需要一个最低页数，才能继续向前执行。IBM 370 的 `SS MOVE` 指令例子说明了这个约束：该指令长 6 字节，可能跨越 2 个页面；源操作数 from 可能跨越 2 个页面；目标操作数 to 也可能跨越 2 个页面。因此机器可能需要 **6 个页面** 同时驻留，才能安全执行这一条指令。

两种替换范围很重要：
- **Global replacement** 允许一个进程从所有物理页框中选择替换页框，因此一个进程可以拿走另一个进程的页框。
- **Local replacement** 限制每个进程只能在已经分配给自己的页框中选择替换对象。

Global replacement 可以改善总体利用率，但会让进程互相干扰。Local replacement 更好地隔离进程，但如果一个进程有闲置页框而另一个进程缺页严重，就可能浪费内存。

### 5.1 Fixed、Proportional 与 Priority Allocation
**Equal allocation** 给每个进程相同数量的页框。例如系统有 100 个页框、5 个进程，则每个进程得到 20 个页框。这很简单，但忽略了进程大小和行为差异。

**Proportional allocation** 按进程大小分配内存。如果进程 `p_i` 的大小为 `s_i`，进程总大小为 `S = \sum_i s_i`，物理页框总数为 `m`，则分配量为：

$$
a_i = \frac{s_i}{S} \times m
$$

**Priority allocation** 使用类似的比例计算，但权重来自优先级而非大小。一种可能策略是：当进程 `p_i` 发生 page fault 时，从优先级数值更低的进程中选择一个页框作为替换对象。

:::remark 问题：如果应用突然需要更多内存，固定分配是否足够？
通常不够。固定分配可能太僵硬。如果进程进入一个工作集更大的新阶段，即使其他进程有空闲页框，它的 page-fault rate 也可能突然升高。这就引出了 page-fault frequency allocation 和 working-set tracking 这样的自适应方案。
:::

### 5.2 Page-Fault Frequency Allocation
Page-fault frequency allocation 追问的是：**能否通过动态改变每个应用拥有的页面数量来减少 capacity miss？**

![Page-fault frequency allocation](./lec17_materials/page_fault_frequency_allocation.png)

OS 会建立一个可接受的 page-fault-rate 区间：
- 如果实际缺页率过低，说明该进程当前拥有的内存超过需要，可以减少一个页框。
- 如果实际缺页率过高，说明该进程需要更多内存，应该增加一个页框。

图中展示了页框数增加时 page-fault rate 通常下降。下界防止进程囤积内存；上界防止进程因为页框过少而进入抖动。

:::remark 问题：如果根本没有足够内存供所有进程使用怎么办？
这时重新分配页框已经不够。如果所有活跃进程的总需求超过物理内存，OS 必须降低 multiprogramming degree：挂起或 swap out 一部分进程，让剩下的进程能够把自己的 working set 留在内存中。让每个进程都拿到过少页框，只会让整台机器变慢。
:::

## 6. Thrashing 与 Working-Set Model
如果进程没有足够页面，它的 page-fault rate 会非常高。CPU 随后会等待 paging I/O，而不是执行有用指令；OS 也会把大部分时间花在把页面换入换出磁盘上。

**Thrashing ≡ 进程忙于把页面换入换出，却几乎没有实际进展。**

![Thrashing 与 CPU 利用率](./lec17_materials/thrashing_cpu_utilization.png)

CPU 利用率图的形状很关键。一开始，提高 multiprogramming degree 会提升 CPU 利用率，因为一个进程等待时，另一个进程可以运行。但当系统越过内存容量阈值后，再增加进程会让每个进程失去太多页面。Page fault 激增，磁盘 paging 占据主导，CPU 利用率反而崩塌。右侧的崩塌区域就是 thrashing 区域。

:::remark 问题：如何检测 thrashing？最佳应对方式是什么？
Thrashing 可以通过高 page-fault rate、沉重的 paging 磁盘流量以及低 CPU 利用率共同识别。最佳应对通常不是继续增加进程，而是降低内存压力：给活跃进程足够页框，挂起或 swap out 一部分进程，并在内存足够时再把它们调回。
:::

### 6.1 内存引用中的局部性
程序的内存访问模式具有 **时间局部性** 和 **空间局部性**。程序倾向于重复使用最近使用过的页面，也倾向于访问相邻的数据或代码。在某个时间片内被访问的一组页面称为 **Working Set**。

![内存引用局部性](./lec17_materials/memory_reference_locality.png)

这张内存引用图应当被理解为时间轨迹。横轴是执行时间，纵轴是页号或内存地址。密集条带表示程序在一段时间内集中访问一小组页面，随后又移动到另一组页面。关键变化不是某个静态点，而是程序从一个 locality region 迁移到另一个 locality region。

Working set 定义了进程在当前阶段表现良好所需的最小页面集合。如果系统无法让 working set 驻留内存，进程就会 thrash。在这种情况下，临时 swap out 整个进程，可能比让它拿着过少页面继续运行更好。

### 6.2 Working-Set Model
Working-set model 用一个窗口形式化局部性：

**Δ ≡ working-set window ≡ 固定数量的页面引用。**

例如，`Δ` 可以对应 10,000 条指令，或某个固定数量的最近内存引用。对于进程 `P_i`，工作集定义为：

**WSi（进程 Pi 的 working set）= 最近 Δ 内引用过的页面总集合。**

![Working-set model 示例](./lec17_materials/working_set_model_example.png)

在图中的 page reference table 示例里：
- 在时间 `t_1`，最近 `Δ` 窗口包含对页面 `1`、`2`、`5`、`6`、`7` 的引用，因此 `WS(t_1) = {1, 2, 5, 6, 7}`。
- 在时间 `t_2`，最近 `Δ` 窗口集中在页面 `3` 和 `4` 上，因此 `WS(t_2) = {3, 4}`。

窗口大小非常重要：
- 如果 `Δ` 太小，它无法覆盖完整的当前局部性。
- 如果 `Δ` 太大，它会把多个局部性混在一起，从而高估当前需求。
- 如果 `Δ = \infty`，它覆盖的是整个程序，而不是当前执行阶段。

令：

$$
D = \sum_i |WS_i|
$$

其中 `D` 是所有活跃进程的总页框需求，`m` 是物理页框总数。如果：

$$
D > m
$$

系统就处于过度承诺状态，并会发生 thrashing。一个实用策略是：如果 `D > m`，就挂起或 swap out 一部分进程。这可以显著改善整体系统行为，因为较少的活跃进程反而能各自把 working set 留在内存中。

### 6.3 Compulsory Misses 怎么办
**Compulsory misses are misses that occur the first time that a page is seen.** 在分页中，这包括：
- 页面第一次被触碰；
- 进程被 swap out 后又 swap back in，随后页面再次被触碰。

两种实用技术可以减轻 compulsory miss 的痛苦：

**Clustering** 在 page fault 时，把 faulting page 周围的多个页面一起调入。磁盘顺序读效率更高，因此如果相邻页面很可能随后被使用，一次读入多个连续页面可能比分多次 I/O 更划算。

**Working Set Tracking** 尝试记住应用正在活跃使用的页面。当一个被换出的进程重新调入时，OS 可以调入它的 working set，而不是只调入单个 faulting page。

:::remark 问题：Compulsory miss 能否完全消除？
不能。页面第一次被引用这件事总要以某种方式被发现。Clustering 和 working-set tracking 通过预测相邻页面或近期活跃页面来减少后续停顿，但也可能读入实际上不会使用的页面。它们之所以有价值，是因为磁盘 I/O 的固定成本很高，而且局部性经常让预测值得一做。
:::

## Exam Review
这一节把本讲压缩成最值得复习的事实和推理模式。

### 核心定义
- **MIN** 在已知未来引用时最优：替换下一次使用最晚的页面。
- **LRU** 替换最长时间未使用的页面；它在局部性下近似 MIN，但在大于内存的循环工作集上可能失败。
- **FIFO** 替换最老的驻留页面，并可能出现 Bélády's anomaly。
- **Clock** 使用环形列表、clock hand 和硬件/软件 use bit 近似 LRU。
- **N-th chance Clock** 要求页面经历 `N` 次扫描且未被使用后才会被替换。
- **Thrashing** 表示 paging 主导执行，进程几乎没有有用进展。
- **Working set** 是最近 `Δ` 窗口中被引用的页面集合。

### 必须掌握的例子
- 对 `A B C A B D A D B C B` 和 3 个页框，FIFO 有 **7 次 fault**，MIN 和 LRU 有 **5 次 fault**。
- 对 `A B C D A B C D A B C D` 和 3 个页框，LRU 有 **12 次 fault**，因为循环中有 4 个页面但内存只有 3 个页框；MIN 有 **6 次 fault**。
- 对 `A B C D A B E A B C D E`，FIFO 在 3 个页框下有 **9 次 fault**，在 4 个页框下反而有 **10 次 fault**。这就是 Bélády's anomaly。
- 在 IBM 370 的 `SS MOVE` 示例中，一条指令可能需要 **6 个驻留页面**：2 个用于指令本身，2 个用于源操作数，2 个用于目标操作数。

### 推理模板
- 比较替换策略时，先问它使用什么信息：FIFO 使用到达时间，LRU 使用过去 recency，MIN 使用未来引用，Clock 使用粗粒度的 recent-use bit。
- 判断是否可能出现 Bélády's anomaly 时，先问策略是否满足 stack property。LRU 和 MIN 满足；FIFO 不满足。
- 分析 Clock 时，跟踪 clock hand：`use = 1` 表示清零并跳过；`use = 0` 表示候选 victim。
- 诊断 thrashing 时，观察高 page-fault frequency、沉重磁盘 paging、低 CPU 利用率。
- 应用 working-set model 时，计算每个 `|WS_i|`，求和得到 `D`，再与物理页框数 `m` 比较。

### 常见误区
- 增加页框并不对所有策略都自动减少 fault；FIFO 就是反例。
- Dirty bit 和 use bit 不同：dirty 表示页面自磁盘副本以来被写过；used 表示页面近期被引用过。
- Page fault 不一定总是磁盘读。Second-chance-list hit 可能只是为了让 OS 更新元数据而 fault。
- 当所有进程一起 thrash 时，swap out 一个进程反而可能提升性能。
