# 期末考试模拟试题 FinalMock4

## 试卷说明

- 题型：大题 5 题，每题 20 分，共 100 分。
- 覆盖比例：期中前内容 1 题，期中后内容 4 题。
- 题目风格：每题有明确场景、数据和状态，包含计算、代码/伪代码填空、状态机、崩溃点分析和简短设计题。
- 答题建议：涉及算法模拟时写出关键序列；涉及可靠性时明确说明 crash point、durable state 和 recovery action。

## 大题一：实时门诊调度与资源分配（20 分）

某医院门诊系统运行在单 CPU 教学 OS 上。系统中有周期性实时任务、普通后台任务和共享设备锁。你需要判断实时调度是否可行，并处理优先级反转和死锁避免。

### Part A：EDF 可调度性与时间线（5 分）

三个周期性任务如下，周期等于相对 deadline。所有任务在 `t=0` 同时释放第一批 job，之后按周期释放。

| 任务 | 含义 | 执行时间 C | 周期 P | 相对 deadline D |
| --- | --- | --- | --- | --- |
| T1 | 分诊提醒 | 1 | 4 | 4 |
| T2 | 影像预取 | 2 | 5 | 5 |
| T3 | 化验同步 | 1 | 10 | 10 |

1. 计算 EDF 利用率和可调度性判定。（1.5 分）
2. 按 EDF 给出 `t=0` 到 `t=10` 的一种执行时间线，忽略上下文切换成本。（2.5 分）
3. 若加入一个永远 ready 的后台任务 B，EDF 在上述实时 job 都未就绪时应如何处理 B？（1 分）

### Part B：RR 不能保证 deadline 的反例（3 分）

现在有三个一次性任务在 `t=0` 到达，RR 时间片 `q=1`，初始 ready queue 顺序为 `L1, L2, H`：

| 任务 | 执行时间 C | deadline |
| --- | --- | --- |
| L1 | 1 | 100 |
| L2 | 1 | 100 |
| H | 1 | 2 |

1. 按 RR 写出执行顺序和 H 的完成时刻。（1.5 分）
2. H 是否满足 deadline？这说明 RR 与 EDF 的目标差异是什么？（1.5 分）

### Part C：优先级反转与 donation（4 分）

系统有三个线程：

- `L`：低优先级，持有锁 `devLock`，还需运行 3 ms 才能释放。
- `H`：高优先级，在 `t=1` 到达，需要 `devLock`。
- `M`：中优先级，在 `t=2` 到达，不需要锁，可运行 10 ms。

单 CPU，严格优先级调度。

1. 不使用 priority donation 时，说明 `t=1` 后 H 为什么会被间接阻塞很久。（1.5 分）
2. 使用 priority donation 后，`L` 的优先级如何变化？H 最早可在何时获得锁？（1.5 分）
3. 为什么让 H 自旋等待 `devLock` 反而可能造成无进展？（1 分）

### Part D：Banker 安全态判断（6 分）

系统有三类资源 `A/B/C`。当前 Available 为 `[3,3,2]`。Allocation 与 Max 如下：

| 进程 | Allocation | Max |
| --- | --- | --- |
| P0 | `[0,1,0]` | `[7,5,3]` |
| P1 | `[2,0,0]` | `[3,2,2]` |
| P2 | `[3,0,2]` | `[9,0,2]` |
| P3 | `[2,1,1]` | `[2,2,2]` |
| P4 | `[0,0,2]` | `[4,3,3]` |

1. 写出 Need 矩阵。（2 分）
2. 判断当前状态是否安全；若安全，给出一条安全序列。（2 分）
3. 若 P1 请求 `[1,0,2]`，是否可立即批准？请先检查请求是否不超过 Need/Available，再做安全性判断。（2 分）

### Part E：死锁预防策略选择（2 分）

门诊系统中有打印机、影像缓存和药房接口三个资源。有同学建议“所有线程必须按全局顺序申请资源”。这个策略破坏了死锁四条件中的哪一个？它的主要代价是什么？

:::tip 答案与解析
### Part A

1. 利用率为 `1/4 + 2/5 + 1/10 = 0.25 + 0.4 + 0.1 = 0.75 <= 1`。在独立、可抢占、周期等于 deadline 的理想模型下，EDF 可调度。
2. 一种 EDF 时间线：`0-1:T1`，`1-3:T2`，`3-4:T3`，`4-5:T1`，`5-7:T2`，`7-8:idle/B`，`8-9:T1`，`9-10:idle/B`。到 `t=10` 前所有已释放 job 都满足 deadline。
3. EDF 是 work-conserving 时，可以在没有实时 job ready 时运行 B；一旦实时 job 到达且 deadline 更早，应抢占 B。

### Part B

1. RR 顺序为 `0-1:L1`，`1-2:L2`，`2-3:H`，H 完成时刻为 `t=3`。
2. H 的 deadline 是 2，因此 miss。RR 主要提供时间片轮转和等待公平，不理解 deadline；EDF 按绝对 deadline 选择任务，目标是实时可预测性。

### Part C

1. `t=1` 时 H 到达并请求 `devLock`，但锁由 L 持有，H 阻塞。`t=2` 时 M 到达，严格优先级下 M 高于 L，会持续运行，导致 L 无法获得 CPU 释放锁，H 被 M 间接延迟。
2. Donation 把 H 的高优先级临时捐给锁持有者 L。L 会抢在 M 前运行，运行 3 ms 后释放锁；若 L 从 `t=1` 开始继续运行，则 H 最早约在 `t=4` 获得锁。
3. H 自旋会占用 CPU；单 CPU 上锁持有者 L 得不到运行机会，无法释放锁，系统忙着检查条件却没有有效进展。

### Part D

1. Need = Max - Allocation：
   - P0 `[7,4,3]`
   - P1 `[1,2,2]`
   - P2 `[6,0,0]`
   - P3 `[0,1,1]`
   - P4 `[4,3,1]`
2. 当前安全。一条安全序列是 `P1 -> P3 -> P4 -> P0 -> P2`：  
   Available `[3,3,2]` 满足 P1，释放后 `[5,3,2]`；满足 P3，释放后 `[7,4,3]`；满足 P4，释放后 `[7,4,5]`；满足 P0，释放后 `[7,5,5]`；满足 P2。
3. P1 请求 `[1,0,2]` 不超过 Need `[1,2,2]`，也不超过 Available `[3,3,2]`。试探分配后 Available `[2,3,0]`，P1 Allocation `[3,0,2]`，Need `[0,2,0]`。可先完成 P1，释放后 Available `[5,3,2]`，之后仍可按 `P3 -> P4 -> P0 -> P2` 完成，因此可批准。

### Part E

强制全局资源申请顺序破坏 **circular wait** 条件。主要代价是灵活性下降：线程可能不得不提前申请暂时不用的资源，或按不自然顺序重构代码，降低并发度和资源利用率。
:::

## 大题二：跨进程 `mmap` 数据分析器（20 分）

两个进程 `P` 和 `Q` 同时分析文件 `data.bin`。文件大小为 `10,000` 字节，页大小为 `4096` 字节。`P` 执行：

```c
int fd = open("data.bin", O_RDWR);
char *p = mmap(0, 10000, PROT_READ | PROT_WRITE, MAP_FILE | MAP_SHARED, fd, 0);
```

`Q` 稍后也用 `MAP_SHARED` 映射同一文件，但映射到不同虚拟地址。

### Part A：参数与页数（4 分）

1. 解释 `mmap(0, 10000, PROT_READ|PROT_WRITE, MAP_FILE|MAP_SHARED, fd, 0)` 中 `0`、`10000`、权限和 `MAP_SHARED` 的含义。（2 分）
2. 该映射覆盖几个虚拟页？最后一页有多少字节超出文件长度？（1 分）
3. 访问 `p[5000]` 和 `p[9000]` 分别落在哪个文件页和页内 offset？（1 分）

### Part B：File-backed page fault 路径（4 分）

初始时没有任何文件页驻留在内存中。

1. `P` 第一次读取 `p[5000]` 时，OS 需要执行哪些关键步骤？（2 分）
2. 若随后 `Q` 读取同一文件 offset `5000`，是否必须再次从磁盘读？为什么？（1 分）
3. 如果 `P` 写 `p[9000]='X'`，该页会被标记成什么状态？什么时候可能落盘？（1 分）

### Part C：`MAP_SHARED`、`MAP_PRIVATE` 与可见性（4 分）

假设文件初始 `data.bin[20]='a'`。

1. `P` 用 `MAP_SHARED` 写 `p[20]='b'` 后，`Q` 的共享映射读取 offset 20，理论上应看到什么？（1 分）
2. 若 `Q` 是在写入后用普通 `read(fd, &c, 1)` 读取 offset 20，为什么可见性可能受 buffer cache/writeback 语义影响，但不应被理解为 `P` 的私有用户缓冲？（1 分）
3. 若 `P` 改用 `MAP_PRIVATE` 写 `p[20]='c'`，文件和 `Q` 的共享映射是否应看到 `'c'`？（1 分）
4. `msync` 或 `munmap` 在这里能提供什么作用？（1 分）

### Part D：画图题：不同虚拟地址共享同一页（4 分）

请画出或文字描述以下映射关系：`P` 把文件页 1 映射到虚拟页 `0x401`，`Q` 把同一文件页 1 映射到虚拟页 `0x900`，二者共享同一物理页框 `F7`。回答：

1. 两个进程的虚拟地址是否必须相同？（1 分）
2. 两个 PTE 至少应包含哪些关键信息？（1 分）
3. 若内存压力下要淘汰 `F7`，OS 必须更新哪些状态？（2 分）

### Part E：`mmap` 与 `read/write` 的取舍（4 分）

某同学要扫描整个 10 GB 数据文件并统计字节频率。

1. 使用 `mmap` 的一个优势和一个风险/复杂性是什么？（2 分）
2. 使用显式 `read` 循环的一个优势和一个劣势是什么？（2 分）

:::tip 答案与解析
### Part A

1. 第一个 `0` 表示让 OS 选择映射起始虚拟地址；`10000` 是映射长度；`PROT_READ|PROT_WRITE` 允许读写；`MAP_FILE|MAP_SHARED` 表示区域由文件支持，修改采用共享文件语义。
2. `ceil(10000/4096)=3` 页。3 页总容量 `12288` 字节，超出文件 `2288` 字节。
3. `p[5000]` 在文件页 `floor(5000/4096)=1`，offset `904`。`p[9000]` 在文件页 `2`，offset `808`。

### Part B

1. CPU 访问未驻留页触发 page fault；OS 检查地址属于合法 file-backed region；在文件/页缓存中查找对应 block；分配页框；从磁盘或 buffer cache 读入文件页；更新 PTE/TLB；重启 faulting instruction。
2. 不一定。若 P 的 fault 已把文件页 1 读入 page cache/物理页框，Q 的 PTE 可映射到同一物理页框，不需要再次读磁盘。
3. 页会变成 dirty file-backed page。它可能在 `msync`、内存回收、周期性 writeback、`munmap` 或文件关闭相关路径中被写回，具体时机由 OS 策略决定。

### Part C

1. 应看到 `'b'`，因为二者共享同一文件支持的映射，最终可指向同一 cached physical page。
2. `mmap` 写入不是 `fwrite` 那种 C library 私有缓冲；它修改的是页缓存中的 file-backed page。普通 `read` 也通常经过同一 buffer/page cache，因此应与内核缓存一致，但持久化到磁盘的时间仍受 dirty writeback 控制。
3. 不应看到。`MAP_PRIVATE` 写入触发 copy-on-write，P 获得私有匿名副本；文件和 Q 的 shared mapping 不应被改成 `'c'`。
4. `msync` 可请求把 dirty mapped pages 同步到文件，提高持久化时序可控性；`munmap` 解除映射，并可能触发相关清理和写回安排。

### Part D

1. 不必须。共享的是文件页/物理页框，不是虚拟地址数值。
2. PTE 至少包含 valid、PPN=`F7`、权限位、dirty/use 等状态；OS 的 VMA/映射元数据还记录该页来自 `data.bin` 的文件页 1。
3. 如果 `F7` dirty，需要先写回文件对应位置；随后必须通过 reverse mapping/coremap 找到 P 的 VPN `0x401` 和 Q 的 VPN `0x900` 的 PTE，把它们标成 non-resident/invalid，并保留 backing store 信息以便下次 fault 恢复。

### Part E

1. `mmap` 优势是把文件访问统一成内存访问，OS 可按需分页、共享页缓存，代码可直接随机访问；风险是 page fault 时机隐式，错误处理、SIGBUS、持久化时序和地址空间压力更复杂。
2. `read` 循环优势是 I/O 边界和错误返回显式，缓冲大小、重试和顺序访问策略更可控；劣势是需要手动管理用户缓冲和拷贝，随机访问时代码较繁琐，也可能多一次内核到用户拷贝。
:::

## 大题三：Buffer Cache 与预取污染事故（20 分）

某数据库在夜间做全表扫描，导致白天常用的索引块被挤出 buffer cache。你需要分析 LRU 的失败模式，并设计更合适的缓存策略。

### Part A：LRU 与 Use Once（5 分）

Buffer cache 容量为 4 个 block，初始为空。访问序列为：

```text
A B C D A B S1 S2 S3 S4 A B C D
```

其中 `A/B/C/D` 是热点索引块，`S1..S4` 是一次性顺序扫描块。

1. 使用普通 LRU，计算 hit 次数和 miss 次数。（2 分）
2. 使用 Use Once 策略：`S1..S4` 被读取后不放入主缓存，计算 hit 次数和 miss 次数。（2 分）
3. 用一句话解释为什么 LRU 在该 streaming workload 上表现差。（1 分）

### Part B：一次跨 block 写入会弄脏哪些块？（4 分）

文件当前大小为 `4096` 字节，只有 logical block 0 已分配。应用调用：

```c
pwrite(fd, buf, 200, 4090);
```

文件系统 block 大小为 `4096` 字节。

1. 这次写涉及哪些 logical data block？各写入多少字节？（1 分）
2. 为什么可能需要 read-modify-write？（1 分）
3. 除数据块外，至少哪些 metadata 可能变 dirty？（1 分）
4. 写完后文件大小是多少？（1 分）

### Part C：Dirty block eviction 与 delayed writes（4 分）

1. Dirty buffer cache block 被选为 victim 时，为什么不能像 clean block 一样直接丢弃？（1 分）
2. Delayed writes 带来两个性能收益是什么？（1 分）
3. Delayed writes 制造的 crash window 是什么？（1 分）
4. 如果 dirty block 是目录块，崩溃风险为什么比普通临时数据更严重？（1 分）

### Part D：Read-ahead 与缓存/VM 平衡（4 分）

数据库顺序扫描文件 `scan.dat`，每次实际需要连续 128 个 block。系统可选择 read-ahead 窗口为 `0`、`8`、`128` 或 `4096` 个 block。

1. 为什么窗口 `0` 可能吞吐较差？（1 分）
2. 为什么窗口 `4096` 可能伤害其他应用？（1 分）
3. 选择 `8` 和 `128` 的主要权衡是什么？（1 分）
4. “buffer cache 和 virtual memory 之间的平衡”指什么？（1 分）

### Part E：策略填空（3 分）

补全一个简化的 Use Once 伪代码：

```c
block_t *cache_read(blockno_t b, bool sequential_stream) {
    block_t *blk = disk_read(b);
    if (sequential_stream) {
        blk->use_once = ____(1)____;
        attach_to_temporary_list(blk);
    } else {
        insert_into_____(2)____(blk);
    }
    return blk;
}

void release_after_use(block_t *blk) {
    if (blk->use_once && !blk->dirty) {
        ____(3)____(blk);
    }
}
```

每空 1 分。

:::tip 答案与解析
### Part A

1. 普通 LRU：前四次 A/B/C/D miss；随后 A/B hit；S1/S2/S3/S4 四次 miss 并逐步挤出 C/D/A/B；最后 A/B/C/D 全部 miss。总 hit **2**，miss **12**。
2. Use Once：前四次 miss；A/B hit；S1..S4 仍是 compulsory miss 但不进入主缓存；最后 A/B/C/D 都 hit。总 hit **6**，miss **8**。
3. LRU 把一次性顺序扫描块误认为值得缓存的新近数据，导致热点块被污染性淘汰。

### Part B

1. Offset 4090 起写 200 字节，block 0 写 `4090..4095` 共 6 字节，block 1 写剩余 194 字节。
2. 对 block 0 和 block 1 都是 partial-block write。若缓存中没有完整旧块，文件系统可能要先读旧块，再修改局部字节并写回，尤其 block 0 未覆盖整块。
3. Block 1 需要新分配，free-space map/bitmap 会变 dirty；inode 的 size、mtime 和 block pointer 会变 dirty；若涉及间接块，间接块也会 dirty。
4. 新文件大小为 `4090 + 200 = 4290` 字节。

### Part C

1. Dirty block 是内存中比磁盘新的版本，直接丢弃会丢失更新。必须写回或确保更新已由 journal/COW 等机制保护。
2. 它可合并多次写、减少同步等待；也能让 allocator 更好地批量布局，提升顺序性。
3. 写调用返回后，数据/metadata 可能只在内存中。如果此时崩溃，应用以为完成的更新可能没有持久化，甚至只持久化了一部分相关块。
4. 目录块影响命名和可达性；目录项半更新可能造成名字指向错误 inode、文件丢失、link count 不一致等全局结构问题。

### Part D

1. 没有 read-ahead 时，每个 block 可能串行等待 I/O 完成，无法利用顺序带宽和设备并行。
2. 预取 4096 个 block 可能占用大量 cache 和 I/O 带宽，挤掉热点数据，增加其他应用 latency。
3. 窗口 8 更保守，污染小但可能吞吐不足；窗口 128 匹配本次需求，吞吐好但若预测错误会浪费更多资源。
4. 物理内存既可用作进程 resident pages，也可用作文件系统缓存。给 buffer cache 太多会挤压进程 working set；给 VM 太多又会降低文件 I/O 命中率。

### Part E

1. `true`
2. `LRU/main_cache`
3. `evict_or_free`

语义上应表达：streaming block 可服务当前读，但不提升为长期缓存对象；释放后若 clean 可快速丢弃。
:::

## 大题四：崩溃中的文件创建与重命名（20 分）

某简化文件系统要执行：

```sh
echo "hi" > /d/x
```

它需要分配 inode `42`、分配数据块 `900`、写入数据 `"hi"`、初始化 inode，并在目录 `/d` 中加入目录项 `"x" -> 42`。涉及的磁盘块包括：

- `IB`：inode bitmap
- `DB`：data-block bitmap
- `I42`：inode 42 所在 inode block
- `D900`：数据块 900
- `DIR`：目录 `/d` 的 data block

### Part A：Naive 写入顺序的崩溃点（5 分）

某错误实现按如下顺序写盘：

```text
1. write IB   // 标记 inode 42 已分配
2. write DIR  // 加入 "x" -> 42
3. write I42  // inode 指向 D900, size=2
4. write DB   // 标记 data block 900 已分配
5. write D900 // 写入 "hi"
```

分析以下 crash point 的主要不一致：

1. crash after step 2, before step 3。（1.5 分）
2. crash after step 3, before step 4。（1.5 分）
3. crash after step 4, before step 5。（1 分）
4. 哪一种不一致最可能让目录项指向垃圾 inode 或无效数据？（1 分）

### Part B：Careful Ordering 设计（4 分）

给出一种更安全的写入顺序，使得“指针或目录项持久化前，它指向的对象已经足够有效”。要求包含 `D900`、`DB`、`I42`、`IB`、`DIR` 五类写入，并说明这种顺序下 crash 后最多会出现什么较容易恢复的问题。

### Part C：Journaling 记录与恢复（5 分）

文件系统使用 redo journal。一次事务 T7 的 journal 可能包含：

```text
BEGIN T7
UPDATE IB
UPDATE DB
UPDATE I42
UPDATE DIR
COMMIT T7
```

为简单起见，数据块 `D900` 采用 ordered mode：先写数据块，再提交 metadata journal。

1. 为什么 ordered mode 要求 `D900` 在 `COMMIT T7` 前写到磁盘？（1 分）
2. crash 后 journal 中只有 `BEGIN/UPDATE`，没有 `COMMIT`，recovery 应如何处理？（1 分）
3. crash 后 journal 中已有 `COMMIT T7`，但 home location 只写回了一部分，recovery 应如何处理？（1.5 分）
4. 为什么许多文件系统只 journal metadata，而不是 journal 所有 data？（1.5 分）

### Part D：Copy-on-Write 版本切换（4 分）

另一种文件系统采用 copy-on-write。它不会覆盖旧目录块或旧 inode block，而是写出新 `I42'`、新 `DIR'`，最后更新一个 root pointer 指向新树。

1. 为什么 COW 中 root pointer 的最后切换很关键？（1 分）
2. crash 发生在写完 `I42'` 但没写 `DIR'` 时，mount 后应看到旧版本还是新版本？（1 分）
3. crash 发生在 root pointer 已切换后，mount 后应看到什么？（1 分）
4. COW 的一个代价是什么？（1 分）

### Part E：`fsck`、Journal 与 COW 对比（2 分）

用两句话比较 `fsck`、journaling 和 COW 在恢复时间和正常写入开销上的差异。

:::tip 答案与解析
### Part A

1. `DIR` 已有 `"x" -> 42`，但 `I42` 尚未初始化。目录项可能指向垃圾 inode 或旧内容，这是危险的 dangling name。
2. `I42` 指向 `D900` 且 size=2，但 `DB` 还没标记 900 已分配。未来 allocator 可能把 900 分给别人，造成双重分配；同时 `D900` 数据还没写，读取可能看到垃圾。
3. Bitmap 和 inode 都说块 900 属于文件，但 `D900` 还没写 `"hi"`，文件内容可能是旧数据或垃圾。
4. Crash after step 2 最直接导致目录项指向未初始化 inode；crash after step 3/4 则可能导致 inode 指向未初始化数据。

### Part B

一种更安全的顺序是：`write D900 -> write DB -> write I42 -> write IB -> write DIR`。核心原则是先写被指向的数据，再写声明其已分配的 metadata，再写包含指针的 inode，最后让目录项使文件可达。不同真实系统会细化 bitmap/inode 顺序，但必须避免“持久化指针指向未初始化对象”。这种顺序下，中途崩溃更可能造成不可达但已分配的 inode/block 泄漏，可由 `fsck` 扫描修复；比目录项指向垃圾安全。

### Part C

1. Ordered mode 只 journal metadata。如果 `COMMIT` 后 metadata 被 replay，使 inode/目录指向 D900，那么 D900 必须已经包含正确用户数据，否则会暴露旧数据或垃圾。
2. 没有 commit 的事务视为未完成，recovery 丢弃该 journal 片段，不把 UPDATE replay 到 home location。
3. 有 commit 的事务必须 redo/replay：把 journal 中完整的 metadata updates 写到 home location，确保事务效果全有或全无。
4. Journal 所有 data 会显著增加写放大和 journal 空间压力；metadata journaling 已能保护文件系统结构一致性。代价是用户数据持久化语义较弱，所以需要 ordered/writeback/data-journal 等模式区分。

### Part D

1. Root pointer 决定哪棵树是当前一致版本。只有所有新块写好后才切换 root，才能保证 crash 后看到旧完整版本或新完整版本。
2. 旧版本。root pointer 没切换，新块不可达，可之后回收。
3. 新版本。只要 root pointer 更新本身是原子的或可恢复的，mount 后沿新 root 找到新目录和 inode。
4. COW 会增加写放大和空间占用，也可能造成碎片；还需要垃圾回收旧版本和管理快照。

### Part E

`fsck` 依赖崩溃后扫描全局 metadata，正常写入开销低但恢复时间可能与磁盘大小成正比。Journaling 正常写入多写 log 但恢复只扫描 journal；COW 正常写入新块和 root 切换，恢复简单，但写放大、碎片和空间管理成本更高。
:::

## 大题五：跨机转账的 2PC 状态机（20 分）

银行系统把账户分片存储在两个 shard 上。事务 `TX88` 要从账户 A 所在 shard `WA` 扣款 100，并给账户 B 所在 shard `WB` 加款 100。协调者为 `C`。系统使用 Two-Phase Commit，并要求关键状态写入 stable storage。

### Part A：协议消息序列（4 分）

无故障且两个 worker 都同意提交时，写出 2PC 的主要消息序列。要求包含 prepare/vote/decision/ack 四类动作。

### Part B：Stable log 应记录什么？（4 分）

1. Worker 在发送 `VOTE-COMMIT` 前为什么必须把自己的 vote 记录到 stable storage？（1.5 分）
2. Coordinator 在发送全局 `COMMIT` 前为什么必须先把 decision 记录到 stable storage？（1.5 分）
3. 如果 worker 在投票前崩溃，恢复后为什么 abort 通常是安全的？（1 分）

### Part C：故障场景推理（5 分）

判断每个场景下参与者应该 commit、abort 还是 block，并说明理由。

1. `WA` 回复 `VOTE-ABORT`，`WB` 回复 `VOTE-COMMIT`。（1 分）
2. `WA` 和 `WB` 都已写入并发送 `VOTE-COMMIT`，`C` 崩溃，且没有任何 worker 收到最终决定。（1.5 分）
3. `C` 已写入 `COMMIT`，并把 `COMMIT` 发给 `WA`；`WA` ack 后，`C` 崩溃，`WB` 仍在 READY 状态。（1.5 分）
4. `WB` 在收到 prepare 后、写 vote 前崩溃，`C` 等待超时。（1 分）

### Part D：Two General's Paradox 与 2PC 的目标（3 分）

1. Two General's Paradox 说明了不可靠消息系统中的什么不可能性？（1 分）
2. 2PC 是否解决“同时行动”？它真正解决的是什么问题？（1 分）
3. 为什么 2PC 仍可能 blocking？（1 分）

### Part E：状态机填空与超时策略（4 分）

补全 worker 端状态机描述：

```text
INIT --prepare received--> ____(1)____
____(1)____ --local yes, log vote--> READY
____(1)____ --local no or timeout before vote--> ABORT
READY --global commit--> COMMIT
READY --global abort--> ABORT
READY --coordinator unreachable--> ____(2)____
```

1. 填写 `(1)` 和 `(2)`。（1 分）
2. 为什么 `(2)` 不能简单写成 ABORT？（1 分）
3. 给出一个工程上缓解 blocking 的办法，但说明它引入的新假设或复杂性。（2 分）

:::tip 答案与解析
### Part A

典型无故障序列：

1. `C -> WA/WB: PREPARE(TX88)`
2. `WA/WB` 本地检查可提交，把 vote 写入 stable log，然后发送 `VOTE-COMMIT`
3. `C` 收到 unanimous commit votes，把 `COMMIT(TX88)` 写入 stable log
4. `C -> WA/WB: GLOBAL-COMMIT`
5. `WA/WB` 执行 commit，写本地 commit log，释放锁，回复 `ACK`
6. `C` 收齐 ACK 后可写 `END/FORGET`

### Part B

1. Worker 一旦投 `VOTE-COMMIT`，就承诺不再单方面 abort。若崩溃恢复后忘记自己投过 commit，可能错误 abort，破坏全局一致性。
2. Coordinator 的 decision 是全局真相。若先发 commit 再崩溃但未持久记录，恢复后可能忘记决定，导致有的 worker commit、有的 abort 或永久不一致。
3. 投票前 worker 尚未承诺 commit；coordinator 等不到该 worker 的 yes vote 时，按 2PC 规则不能 commit，因此 abort 是安全的。

### Part C

1. 全局 abort。2PC 只有 unanimous `VOTE-COMMIT` 才能 commit；任一 abort vote 都导致 abort。
2. `WA/WB` 都在 READY，不能单方面 abort，也不知道 coordinator 是否已决定 commit，因此必须 block，等待 coordinator 恢复或从其他参与者得知决定。
3. 全局决定已经是 commit。`WB` 若能联系到 `WA` 并确认其已收到 commit，可以学习决定并 commit；若联系不到任何知道决定的节点，它在纯 2PC 中仍可能 block，直到 coordinator 恢复。
4. `WB` vote 前失败，coordinator 超时后可决定 abort。因为 commit 需要所有 worker 的 `VOTE-COMMIT`。

### Part D

1. 它说明在不可靠消息上，有限轮确认无法保证双方获得“对方也知道”的共同知识，因此不能保证 simultaneous action。
2. 2PC 不保证同一物理时刻行动；它解决的是所有正确参与者最终遵循同一个 commit/abort 决定的 atomic commitment。
3. READY worker 已承诺不能单方面 abort，但又不知道最终决定；coordinator failure 或通信中断时，它只能等待，因此 blocking 是 2PC 简洁性的代价。

### Part E

1. `(1)=WAITING_FOR_LOCAL_DECISION` 或 `PREPARED_CHECKING`，语义是收到 prepare 后做本地检查；`(2)=BLOCK/WAIT`。
2. READY 表示已经投 yes 并持久承诺，最终决定可能已经是 commit。若直接 abort，可能与已 commit 的其他参与者不一致。
3. 可使用 replicated coordinator/consensus log，让 decision 存在 Raft/Paxos 复制组中，coordinator 单点故障不再让 READY worker 无处查询；代价是引入多数派可用性假设、更多消息轮次和更复杂的复制协议。也可使用 3PC，但它需要更强的网络同步/超时假设。
:::
