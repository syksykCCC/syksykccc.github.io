# Lec14 - 内存 1：地址转换与虚拟内存

## 学习目标
学完本讲后，你应当能够解释为什么内存必须虚拟化，区分保护与转换的职责，分析从 base-and-bound 到 segmentation 和 paging 的演进过程，完成基础地址转换计算，并推导页表下的共享与增长行为。

## 1. 为什么必须做内存虚拟化
现代系统需要让多个进程和线程共享同一套硬件。CPU 调度解决了“谁先运行”的问题，而内存管理要解决“状态放在哪里且如何隔离”的问题。

核心事实有两条：
- 进程和内核的完整工作状态由寄存器与内存中的数据共同定义。
- 不同进程不能直接共享同一批物理地址，否则会破坏正确性与安全性。

因此，内存管理必须默认隔离，并在需要时支持“受控共享”。

## 2. 地址与地址空间基础
`k` 位地址可以定位 `2^k` 个可寻址单元（通常是字节）。

本讲反复使用的换算：
- `2^10 B = 1024 B = 1 KB`（内存语境使用 2 的幂）。
- `4 KB = 2^12 B`，因此 4 KB 页内字节偏移需要 **12 位**。
- 可寻址空间规模：
  - `20-bit`: `2^20 B = 1 MiB`
  - `32-bit`: `2^32 B = 4 GiB`
  - `64-bit`: `2^64 B = 16 EiB`

一个进程的虚拟地址空间通常包含 code、static data、heap、stack，并且中间可能有空洞。
对 32 位进程：
- 总字节数：`2^32`
- 可容纳的 32 位整数（每个 4 字节）数量：`2^32 / 4 = 2^30`

内存访问的结果不止一种：普通读写、内存映射 I/O 行为、访问异常（如 segfault），或者在共享映射下体现为跨进程通信效果。

## 3. 内存复用必须满足的能力
本讲强调三项要求：
- **Protection**：阻止进程访问其他进程或内核的私有内存。
- **Translation**：把 CPU 看到的虚拟地址映射到 DRAM 使用的物理地址。
- **Controlled overlap**：避免意外重叠，同时允许有意重叠来实现共享。

![内存访问的介入问题](./lec14_materials/memory_interposition_question.png)

:::remark 问题：如果软件逐次检查太慢，OS 如何介入内存访问？
常见路径交给硬件（MMU）做快速转换；非常见路径（如 fault）再 trap 给 OS 处理。这就是虚拟内存的核心性能设计。
:::

## 4. 从 Uniprogramming 到 Base-and-Bound
### 4.1 Uniprogramming 与早期 multiprogramming
在没有转换/保护时，单个应用可以直接访问物理内存。早期多程序系统通过 loader/linker 重定位把程序放到不同物理地址，但仍缺少强保护和稳定性。

### 4.2 带保护的 base-and-bound
base-and-bound 为每个进程提供一个受保护的连续区域。带转换时可写成：

$$
\text{if } v < \text{bound, then } p = \text{base} + v; \quad \text{otherwise fault}
$$

这样既支持硬件重定位，也能对越界访问做隔离。

![带转换的 base-and-bound](./lec14_materials/base_bound_with_translation.png)

### 4.3 简单 base-and-bound 的局限
简单连续分配会遇到三类问题：
- 随着进程进出，长期产生碎片。
- 对稀疏地址空间支持较差。
- 进程间共享不够灵活。

这些问题直接推动了 segmentation 的设计。

## 5. Segmentation
### 5.1 核心思想
segmentation 把一个进程看成多个逻辑块（code/data/heap/stack 等）。
每个 segment 在物理内存中连续，但不同 segment 可以分散放置。

### 5.2 转换流水线
虚拟地址拆为 `SegID` 与 `Offset`。
`SegID` 选中段表项 `(Base, Limit, Valid, Permission...)`。
硬件随后做有效性与边界检查。
若合法，物理地址为：

$$
\text{physical} = \text{base}_{seg} + \text{offset}
$$

否则产生访问错误/fault。

![多段模型转换流水线](./lec14_materials/multi_segment_translation_pipeline.png)

### 5.3 例子：16 位地址下的四段模型
该例子使用最高 3 位作为 `SegID`（位 15..13），剩余 13 位作为偏移。

![四段模型示例](./lec14_materials/four_segment_example_table.png)

段表如下：

| Seg ID | 含义 | Base   | Limit  |
|---|---|---|---|
| 0 | code   | `0x4000` | `0x0800` |
| 1 | data   | `0x4800` | `0x1400` |
| 2 | shared | `0xF000` | `0x1000` |
| 3 | stack  | `0x0000` | `0x3000` |

由 base/limit 可得有效物理区间：
- Seg0: `[0x4000, 0x47FF]`
- Seg1: `[0x4800, 0x5BFF]`
- Seg2: `[0xF000, 0xFFFF]`（共享段）
- Seg3: `[0x0000, 0x2FFF]`

课件中的连续图展示了：code/data 被映射到一段物理区间，shared 段映射到高地址区，同时中间可以留给其他应用。

### 5.4 观察与权衡
优势：
- 对有空洞的稀疏地址空间较高效。
- 容易做分段权限（如 code 只读，data/stack 可读写）。

运行特征：
- 每次取指/读写都要做地址转换。
- stack 或 heap 增长时，可能故意触及当前有效范围外地址；OS 可在 fault 后扩展段元数据。
- 上下文切换需要保存/恢复段相关元数据。

### 5.5 段放不下时：交换与代价
当内存紧张时，可能需要按段（或大块）swap out/in，这会显著放大上下文切换成本。

![分段下的 swapping](./lec14_materials/segmentation_swapping.png)

:::remark 问题：segmentation 的关键问题是什么？
本讲给出的重点是：可变大小块的放置复杂度高、容易触发多次搬移/紧凑、交换灵活性有限，以及 external/internal fragmentation 并存。
:::

## 6. Paging
### 6.1 核心思想与动机
paging 把物理内存切成固定大小块（frame/page），分配管理更简单，且不容易出现 external fragmentation。

可用位图记录分配状态：
- `1` 表示该 frame 已分配。
- `0` 表示该 frame 空闲。

本讲语境下页大小通常较小（大致 1K-16K），因此一个逻辑段通常由多个页组成。

### 6.2 简单分页流水线
虚拟地址拆为 `VPN + offset`。
- offset 原样复制到物理地址。
- VPN 用于索引页表项（PTE）。
- PTE 给出物理页号与元数据（valid、读写权限等）。
- 硬件检查页表边界与权限。

![简单分页流水线](./lec14_materials/simple_paging_pipeline.png)

### 6.3 例子（4 字节页）
课件示例映射关系：
- `VPN 0 -> PPN 4`
- `VPN 1 -> PPN 3`
- `VPN 2 -> PPN 1`

![简单页表示例计算](./lec14_materials/simple_page_table_worked_example.png)

课件给出的两次转换：
- `0x06 = 0000 0110`
  - `VPN=1`, `offset=2`
  - `PPN=3`
  - 物理地址 `= 0000 1110 = 0x0E`
- `0x09 = 0000 1001`
  - `VPN=2`, `offset=1`
  - `PPN=1`
  - 物理地址 `= 0000 0101 = 0x05`

### 6.4 分页下的共享
分页共享的方式是：让不同进程的页表项指向同一个物理页。
不同虚拟页号可以映射到同一 frame，且权限仍可按进程分别控制。

![两个进程共享同一物理页](./lec14_materials/page_sharing_mapping.png)

常见场景：
- 所有进程共享一套 kernel region 页表项（再配合特权保护）。
- 多进程执行同一二进制时共享代码页。
- 用户态共享库映射。
- 共享内存 IPC 区域。

## 7. 分页增长场景：栈继续增长会怎样？
在分页总结图中，部分虚拟页初始是未映射（页表为 `null`）。
若向下增长的栈触及未映射页（例如图中的 `1110 0000` 附近），会先触发 fault。
OS 随后可在“有空间的位置”分配新的物理页，并更新对应页表项。
更新完成后，程序继续执行。

![栈增长触发新页分配](./lec14_materials/paging_stack_growth_allocate_new_pages.png)

:::remark 问题：为什么这件事在 paging 中比 segmentation 更容易处理？
paging 只需要找若干空闲的固定大小 frame，而不需要找到一个大的连续可变长区域，因此增量扩展的代价和重定位压力都更低。
:::

## 8. 关键结论
- base-and-bound 提供了第一代强隔离能力，但在碎片与稀疏空间上扩展性有限。
- segmentation 更贴近程序逻辑结构并支持共享，但可变长管理会带来长期复杂度。
- paging 把内存管理转化为固定粒度映射，提升了灵活性，也让按需增长更实用。
- 地址转换本质是软硬件协作：常见路径走 MMU 快速通道，异常路径交给 OS。

## 附录 A. Exam Review
### A.1 必背定义
- **Virtual address space**：进程可见的地址集合。
- **Physical address space**：真实 DRAM 地址空间。
- **Translation**：虚拟地址到物理地址的映射过程。
- **Segmentation**：以可变长逻辑段为单位，用 base/limit 管理。
- **Paging**：以固定页为单位，通过页表映射。
- **External fragmentation**：空闲空间被切碎成难用小洞。
- **Internal fragmentation**：已分配块内部未被充分使用。

### A.2 核心公式与规则
$$
\text{Addressable bytes with }k\text{ bits} = 2^k
$$

$$
\text{Base-and-bound: } v<\text{bound} \Rightarrow p=\text{base}+v
$$

$$
\text{Paging: } VA=(VPN,offset),\; PA=(PPN,offset)
$$

### A.3 高频简答题
1. 为什么内存转换不能在常见路径完全交给软件逐次处理？
2. base-and-bound 的哪个扩展性问题推动了 segmentation/paging？
3. 固定大小分页为什么能缓解 external fragmentation？
4. 两个进程如何安全地共享同一个物理页？
5. 栈增长触及未映射页时，系统的处理链路是什么？

### A.4 常见误区
- 把“虚拟连续”误当成“物理连续”。
- 忘记 paging 中 offset 原样复制。
- 描述地址转换时忽略 valid/permission 检查。
- 误以为共享页意味着所有进程权限完全相同。
- 把 segmentation 的碎片问题与 paging 的碎片问题混为一谈。
