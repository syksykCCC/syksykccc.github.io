# Lec21 - 文件系统 2：文件系统案例研究与缓冲

## 学习目标
学完本讲之后，你应该能够比较 FAT、基于 Unix inode 的文件系统、Berkeley FFS 和 NTFS。你还应该能够解释文件号如何找到文件块、为什么物理块布局会影响性能、hard link 和 symbolic link 有什么区别、路径名遍历如何执行，以及为什么大目录和碎片化文件需要索引结构。

## 1. 性能与块访问回顾
文件系统设计仍然受磁盘和 SSD 的 I/O 性能模型约束。一个系统可能拥有很高的吞吐，但单个用户请求如果停在队列里，仍然会经历较高延迟。两个关键定义仍然是：

- **Response Time or Latency: Time to perform an operation（响应时间或延迟：执行一次操作所需的时间）**。
- **Bandwidth or Throughput: Rate at which operations are performed（带宽或吞吐：操作被执行的速率）**。

对于稳定的单服务器队列，主要量包括：

- `lambda`：平均到达率。
- `T_ser`：平均服务时间。
- `mu = 1 / T_ser`：服务率。
- `u = lambda / mu = lambda * T_ser`：服务器利用率。
- `T_q`：在队列中等待的时间。
- `L_q = lambda T_q`：平均队列长度。
- `C = sigma^2 / m^2`：服务时间的平方变异系数。

需要放在工作记忆里的两个公式是：

$$
T_q = T_{ser} \times \frac{u}{1-u}
$$

这是 M/M/1 队列的等待时间公式。对于 M/G/1 队列，有：

$$
T_q = T_{ser} \times \frac{1}{2}(1+C) \times \frac{u}{1-u}
$$

核心结论是，当利用率接近 1 时，排队延迟会急剧增长。一个文件系统如果制造了不必要的寻道或随机 I/O，不仅会增加服务时间，还会把设备推向排队曲线最陡峭的区域。

## 2. 磁盘调度与字节到块的转换
磁盘调度策略决定队列中的磁盘请求按什么顺序被服务。对于形如 `(2,2), (5,2), (7,2), (3,10), (2,1), (2,3)` 的请求队列，不同策略强调不同权衡：

| 策略 | 核心思想 | 优点 | 缺点 |
|---|---|---|---|
| FIFO | 按到达顺序服务请求。 | 实现简单，并且按到达顺序公平。 | 可能造成很长的寻道。 |
| SSTF | 服务离当前磁头位置最近的请求。 | 通常可以减少寻道距离。 | 远处请求可能饥饿。 |
| SCAN | 像电梯一样沿当前方向移动，服务当前方向上最近的请求。 | 保留局部性，并避免饥饿。 | 仍然会对中间磁道有一定偏好。 |
| C-SCAN | 只沿一个方向服务请求，返回时跳过请求。 | 比 SCAN 更公平，不偏向中间磁道。 | 某些请求可能等待完整一轮。 |

文件 API 经常以字节为单位说话，而存储设备通常读写固定大小的块。如果应用程序请求读取第 2 到第 12 个字节，文件系统必须取出包含这些字节的块，并只返回相关的字节范围。如果应用程序写入第 2 到第 12 个字节，文件系统通常需要先读出旧块，在内存里修改相关部分，再把整个块写回。

:::remark 问题：为什么一次字节级写入常常要先读取旧块？
设备通常覆盖完整块，而不是任意字节范围。如果写入只改变块的一部分，同一块中没有被修改的字节必须被保留下来。标准的 read-modify-write 流程是：读出旧块，在内存里 patch 目标字节，然后把整个块写回。
:::

## 3. 案例研究：FAT
**File Allocation Table（FAT，文件分配表）** 起源于 1977 年的 MS-DOS，并且由于简单、可移植、甚至容易放进设备固件实现，至今仍然被广泛使用。它的核心思想是把文件块之间的连接关系保存在一张表里，而不是保存在每个文件的数据块里。

先假设目录查找已经把路径转换成了文件号。磁盘存储是一组块，文件偏移可以表示为 `o = <B, x>`，其中 `B` 是文件内部的逻辑块号，`x` 是这个块内部的字节偏移。

![FAT 通过链表读取文件](./lec21_materials/fat_read_linked_list.png)

执行 `file_read(31, <2, x>)` 时，文件系统把文件号 `31` 作为 FAT 的索引。对应的 FAT 表项指向这个文件的第一个物理块。为了到达逻辑块 2，文件系统要从逻辑块 0 沿链表走到逻辑块 1，再走到逻辑块 2。随后它把对应物理块从磁盘读入内存，并返回偏移 `x` 处的字节。

![FAT 文件分配方式](./lec21_materials/fat_file_allocation.png)

在 FAT 中：

- **File is collection of disk blocks; FAT is a linked list with blocks（文件是一组磁盘块，FAT 用链表描述这些块）**。
- **File number is the index of the root of the block list for the file（文件号是文件块链表根节点的索引）**。
- **File offset = block number + offset within block（文件偏移等于块号加块内偏移）**。
- **Follow list for block number（要找到某个块号，就沿链表前进）**。
- **Unused blocks marked free（未使用块被标记为空闲）**。

空闲空间可以通过扫描 FAT 表项寻找 free entry，也可以通过额外维护 free list 来寻找。

## 4. FAT 中的写入与格式化
一次扩展文件的写入必须分配并链接新块。

![FAT 写入并扩展文件](./lec21_materials/fat_write_extend_file.png)

对于 `file_write(31, <3, y>)`，假设逻辑块 3 还不存在。文件系统会找到一个空闲物理块，把 `y` 写入这个块，把原来的最后一个 FAT 表项改成指向新块，并把新块的 FAT 表项标记成新的链尾。数据块保存字节内容，FAT 保存链式结构。

FAT 本身也存储在磁盘上。因此格式化和快速格式化主要是对元数据的操作：

- 格式化磁盘时，系统可以清零块，并把 FAT 表项标记为空闲。
- 快速格式化磁盘时，系统可以只把 FAT 表项标记为空闲。
- 由于结构简单，FAT 可以放在设备固件中实现。

:::remark 问题：为什么快速格式化不一定真正擦除旧数据字节？
快速格式化改变的是分配元数据，使旧块看起来已经空闲。旧数据字节可能仍然留在介质上，直到后续写入覆盖它们。从文件系统视角看，文件已经不存在，因为文件名和分配链不再是有效的权威记录；但从原始存储视角看，旧字节可能仍然存在。
:::

## 5. FAT 中的目录
目录是一种文件，内容是从名字到文件号的映射：

![FAT 目录结构](./lec21_materials/fat_directories.png)

一个 FAT 目录项保存类似 `<file_name : file_number>` 的信息。目录文件中也会包含空闲空间，用于新建条目或复用删除后留下的条目。FAT 把文件属性存放在目录项中，而不是和文件对象本身放在一起。

每个目录被表示成目录项的链表，名字查找是线性搜索。根目录 `/` 位于一个预先规定的位置。在 FAT 中，它从块 2 开始，因为块 0 和块 1 被保留。

示例目录 `/home/tom` 包含 `.`, `..`, `Music`, `Work`, `foo.txt` 等条目。每个条目把名字映射到一个文件号，例如 `Music -> 35002320` 或 `foo.txt -> 66212871`。文件删除之后，合法条目之间可能留下空闲目录槽位。

:::remark 问题：线性目录列表的代价是什么？
查找时间会随着目录项数量增长。小目录很便宜，但包含成千上万甚至上百万个条目的目录，可能需要大量字符串比较，并且可能需要许多次磁盘读取，才能找到目标名字。因此后来的文件系统经常用 hash table、B-Tree 或 B+Tree 替代线性目录扫描。
:::

## 6. FAT 设计讨论
FAT 的核心设计问题是：假设我们已经知道文件号，它在查找文件块、顺序访问、随机访问、碎片化、小文件和大文件这些方面表现如何？

![FAT 设计讨论问题](./lec21_materials/fat_discussion_questions.png)

:::remark 问题：如果从文件号开始，FAT 的主要权衡是什么？
为了找到逻辑块 `k`，文件系统必须从文件第一个块开始沿着链走 `k` 步。如果 FAT 被缓存在内存中，这个遍历可能不需要额外的元数据磁盘 I/O，但这个逻辑操作本身仍然是关于 `k` 的线性过程。

块布局可能高度碎片化，因为每一条链都可以指向任意空闲物理块。顺序访问是可行的，因为文件系统可以沿链走一遍；但它不能保证磁盘上的物理位置也是连续的。随机访问较弱，因为到达较远的逻辑块需要从开头或某个缓存位置开始继续走链。

小文件表示起来简单且便宜，但属性存储在目录项中，会让“多个名字共享同一个文件”的语义变得别扭。大文件当然可以表示，但长链和碎片化会让随机访问和高吞吐顺序访问都不够理想。
:::

## 7. 案例研究：Unix 文件系统
Unix 文件系统使用 **inode** 把文件元数据和目录名字分离。文件号，也就是 **inumber**，是 inode 数组中的索引。每个 inode 对应一个文件，并保存这个文件的元数据和块指针。

它和 FAT 的关键区别是：读写权限保存在文件本身，而不是保存在目录项中。这使得多个名字指向同一个文件变得自然。inode 还维护一个多级树，用来定位文件的存储块。

这种设计同时适合小文件和大文件，因为这棵树是非对称的。小文件可以使用 direct pointer，开销很低；大文件可以通过 indirect、double-indirect 和 triple-indirect pointer 继续增长。这个 inode 设计出现在原始 BSD 4.1 文件系统中，并且与 Linux Ext2 和 Ext3 相似。

![Unix inode 结构](./lec21_materials/unix_inode_structure.png)

## 8. 文件属性与保护
Unix 文件属性包括：

![Unix inode 文件属性](./lec21_materials/inode_file_attributes.png)

- User。
- Group。
- 9 个基础访问控制位：**UGO x RWX**。
- **SetUID bit: execute at the file owner's permissions rather than the user's（SetUID 位：执行时使用文件所有者的权限，而不是当前用户的权限）**。
- **SetGID bit: execute at the file group's permissions（SetGID 位：执行时使用文件所属组的权限）**。

这 9 个基础位按主体和操作组织。`U`, `G`, `O` 分别表示 user、group、other。`R`, `W`, `X` 分别表示 read、write、execute。一个文件可以表达类似“所有者可读写，组成员可读，其他人无权限”的策略。

:::remark 问题：为什么把权限存放在 inode 中很重要？
如果权限属于 inode，那么指向同一文件的每个 hard link 都会看到同一份保护状态。如果权限分别保存在每个目录项中，同一个底层文件的两个名字可能意外拥有不同访问规则。Unix 避免了这个问题：inode 是文件对象，目录项只是这个对象的名字。
:::

## 9. 小文件与直接指针
对于小文件，inode 中直接保存指向数据块的 direct pointer。

![小文件的直接指针](./lec21_materials/inode_small_files_direct_pointers.png)

如果有 12 个 direct pointer，且块大小为 4 KB，那么 direct pointer 本身可以覆盖：

$$
12 \times 4KB = 48KB
$$

这很符合常见负载，因为大量文件都比较小。读取一个小文件时，只需要读取 inode，沿 direct pointer 找到数据块，再读出数据块即可，元数据遍历非常少。

## 10. 大文件与间接指针
对于大文件，inode 使用 indirect block。indirect block 是一种只保存指针的磁盘块，它的指针再指向数据块。

![大文件的间接指针](./lec21_materials/inode_large_files_indirect_pointers.png)

如果块大小是 4 KB，指针大小是 4 字节，那么一个 indirect block 可以保存 1024 个指针。inode 的可达范围按如下方式增长：

| 指针区域 | 额外可达数据量 | 直观含义 |
|---|---:|---|
| Direct pointers | 48 KB | inode 直接指向数据块。 |
| Single indirect | 4 MB | 一个指针块指向 1024 个数据块。 |
| Double indirect | 4 GB | 一个块指向 1024 个 indirect block。 |
| Triple indirect | 4 TB | 一个块指向 1024 个双层区域。 |

:::remark 问题：为什么这种非对称树同时适合小文件和大文件？
小文件只需要支付 inode 中已有 direct pointer 的开销。大文件只有在真正需要时才额外支付间接块元数据。这不是一棵完全平衡树，而是故意偏向小文件常见情况的结构：小文件保持便宜，超大文件仍然能够被寻址。
:::

## 11. 磁盘索引访问例子
考虑一种多级索引文件格式：块大小为 1 KB，有 10 个 direct pointer，每个 indirect block 有 256 个指针，double-indirect 区域可覆盖 256 的平方个指针，triple-indirect 区域可覆盖 256 的立方个指针。

![多级索引访问例子](./lec21_materials/multilevel_index_access_example.png)

假设打开文件时已经访问过 file header，那么：

- 逻辑块 `5` 需要 **1 次磁盘访问**，因为它由 direct pointer 覆盖，剩下只需要读取数据块。
- 逻辑块 `23` 需要 **2 次磁盘访问**，因为 direct pointer 覆盖块 `0` 到 `9`，single-indirect 区域覆盖块 `10` 到 `265`。文件系统先读 indirect block，再读数据块。
- 逻辑块 `340` 需要 **3 次磁盘访问**，因为 double-indirect 区域从 `10 + 256 = 266` 之后开始。文件系统先读 double-indirect block，再读被选中的 single-indirect block，最后读数据块。

:::remark 问题：为什么块 340 不在 single-indirect 区域？
10 个 direct pointer 覆盖逻辑块 0 到 9。single-indirect block 含有 256 个指针，所以覆盖逻辑块 10 到 265。逻辑块 340 已经超过 265，因此必须通过 double-indirect pointer 寻址。
:::

## 12. 案例研究：Berkeley Fast File System
**Berkeley Fast File System（FFS）** 于 1984 年出现在 BSD 4.2 中。它保留了 BSD 4.1 的 inode 结构，但为了性能和可靠性改变了分配和布局策略。经典论文是 McKusick、Joy、Leffler 和 Fabry 的 **A Fast File System for UNIX**。

FFS 的重要变化包括：

- 它把块大小从 1024 字节增加到 4096 字节，以提升性能。
- 它把 inode 分散到更靠近数据的磁道附近。
- 它用 bitmap allocation 替代 free list。
- 它尝试连续分配文件块。
- 它保留大约 10% 的磁盘空间。
- 它使用 skip-sector positioning 处理旋转延迟。

早期 Unix 和 DOS/FAT 把文件头放在靠近最外层柱面的特殊数组中。这个设计有两个主要问题。第一，如果该区域附近发生磁头碰撞，许多 inode 可能被破坏，从而导致许多文件无法访问。第二，文件头不靠近数据，所以即使是一次小读取，也可能需要先寻道到文件头，再寻道到数据。

另一个难题是文件增长。创建文件时，文件系统通常不知道它最终会变多大。Unix 工作负载又常常向文件追加内容，因此分配器既要支持增长，又要尽可能保持布局连续。

## 13. FFS 用 Block Group 改善局部性
FFS 把一个卷划分成多个 block group，每个 group 是一组相近的磁道。数据块、元数据和空闲空间在同一个 block group 内交错放置。

![FFS block group](./lec21_materials/ffs_block_groups.png)

常见分配策略是把文件 inode 放在与父目录相同的 cylinder group 中。这会让 `ls` 等目录操作更快，因为目录项和许多对应的文件头相距很近。FFS 还尽量把目录和目录中的文件放在共同的 block group 里，从而让路径遍历和小文件读取避免巨大寻道。

这既是元数据设计，也是物理布局设计。逻辑文件系统可以说“这个文件拥有这些块”，但性能取决于这些块在物理上是否接近。

## 14. FFS First-Free Allocation 与保留空间
FFS 对新文件块使用 first-free allocation。扩展文件时，它首先尝试使用 bitmap 中连续的空闲块。如果失败，再寻找新的连续范围。

![FFS first-fit 块分配](./lec21_materials/ffs_first_fit_allocation.png)

这种策略会形成一个有用模式：block group 前部的小洞可以被小写入填掉，而后部较大的连续区间会保留给更大的文件。这有助于避免碎片化，并支持大文件的顺序布局。

FFS 还会保留大约 10% 的磁盘空间。这不是浪费空间，而是给分配器留下选择好位置的余地，避免它被迫塞进零散的小洞里。

:::remark 问题：为什么保留 10% 空闲空间能提升性能？
当磁盘几乎完全写满时，分配器几乎没有自由度。新块只能放在剩下的孤立空闲槽中，从而增加碎片化和寻道距离。每个 block group 中保留空闲空间，可以让分配器维持连续区间，把相关元数据和数据放近，并避免性能崩塌。
:::

## 15. 旋转延迟、Read-Ahead 与缓冲
磁头可能读完一个块，花时间处理它，然后再请求下一个块时，磁盘已经旋转越过了下一个块。如果没有额外机制，顺序读取可能退化成每个块都等待一次完整旋转。

![旋转延迟与缓冲解决方案](./lec21_materials/rotational_delay_solutions.png)

两个经典解决方案是：

- **Skip-sector positioning** 会在同一文件的连续块之间留出间隔。这个间隔给系统处理当前块的时间，让下一个目标块到达磁头下方时刚好可以被读取。
- **Read ahead** 会在应用程序明确请求下一个块之前，就紧接着当前块把下一个块读出来。

现代磁盘和控制器经常在底层隐藏这些机制。它们可能使用 track buffer、能够捕获整条磁道的内部 RAM、elevator scheduling，以及 bad-block filtering。在文件系统层面，同一个思想表现为 buffering 和 prefetching：如果很可能发生顺序访问，就提前读取附近数据，让后续请求命中内存而不是访问磁盘。

:::remark 问题：为什么 read-ahead 只有预测正确时才有帮助？
当下一个请求真的访问附近的顺序数据时，read-ahead 很有价值，因为后续读取可以直接从缓冲中满足。如果工作负载是随机的，read-ahead 可能读取不会被使用的块，从而浪费带宽和缓存空间。
:::

## 16. FFS 的优缺点
FFS 同时改善了性能和可靠性，但它仍然有权衡。

| 方面 | 评价 |
|---|---|
| 小文件和大文件 | 通过 inode 的 direct 和 indirect pointer 同时高效支持。 |
| 小文件局部性 | 目录、inode 和数据通常可以留在同一个 block group 中。 |
| 大文件局部性 | 分配器尽量保留连续区间。 |
| 元数据与数据局部性 | inode 被分散到它们描述的数据附近。 |
| 碎片整理 | 如果保留足够空闲空间，通常不需要定期 defragmentation。 |
| 极小文件 | 1 字节文件也可能需要一个 inode 和一个数据块，因此低效。 |
| 基本连续的文件 | 多级索引编码可能比 extent list 需要更多元数据。 |
| 空闲空间要求 | 需要大约 10% 到 20% 的空闲空间来防止碎片化。 |

:::remark 问题：为什么 1 字节文件在 FFS 中可能很低效？
文件内容很小，但仍然会消耗元数据和至少一个可分配的数据区域。这个数据结构面向一般文件优化，而不是把许多极小字节串直接塞进文件头。NTFS 对极小文件采用了不同方式：允许数据 resident 在 MFT record 中。
:::

## 17. Hard Links
**Hard link** 是目录中从名字到文件号的映射。

![Hard link](./lec21_materials/hard_links.png)

第一个 hard link 在文件创建时产生。额外的 hard link 可以通过 `link()` 创建，hard link 可以通过 `unlink()` 删除。当一个文件不再有 hard link 时，它的内容就可以被删除。inode 维护 reference count，让系统知道还有多少个目录项仍然命名这个文件。

:::remark 问题：如果两个名字 hard-link 到同一个 inode，哪个才是“真正的文件”？
两个名字都不是更“真实”的那个。inode 才是文件对象，目录项只是指向它的名字。删除其中一个名字只会删除那个目录项。只要还有至少一个 hard link 指向该 inode，底层文件就仍然可达。
:::

## 18. Symbolic Links
**Soft link** 也叫 **symbolic link** 或 **shortcut**，它把一个名字映射到另一个名字。

![Soft link](./lec21_materials/soft_links.png)

普通目录项的形式是 `<file name, file #>`。symbolic link 的形式则是 `<file name, dest. file name>`。每当程序通过源名字访问文件时，操作系统都会重新查找目标名字。因此如果目标名字被删除、重命名或变得不可达，symbolic link 就会失败。

:::remark 问题：为什么 symbolic link 能跨越 hard link 通常不能跨越的边界？
hard link 直接指向 inode 或文件号，因此绑定在某个文件系统的文件号命名空间内。symbolic link 保存的是路径字符串，所以可以命名其他位置的目标。代价是目标路径要在之后解析，并且可能解析失败。
:::

## 19. 路径名遍历
打开 `/home/pkuos/stuff.txt` 是一串目录查找。根目录的 inumber 配置在内核中，例如 inumber 2。

![目录遍历](./lec21_materials/directory_traversal.png)

遍历过程如下：

1. 从 inode 数组中读取 inode 2。
2. 从 inode 2 中提取 direct 和 indirect pointer。
3. 判断根目录数据位于块 49358。
4. 读取块 49358，扫描 `home`，得到 inumber 8086。
5. 读取 `/home` 对应的 inode 8086。
6. 读取它的目录块 7756，扫描 `pkuos`，得到 inumber 732。
7. 读取 `/home/pkuos` 对应的 inode 732。
8. 读取它的目录块 12132，扫描 `stuff.txt`，得到 inumber 9909。
9. 读取 inode 9909。
10. 建立一个指向 inode 9909 的 file description，使后续 read/write 可以使用该 inode 的块指针访问数据。

系统必须检查最终 inode 的权限，也必须检查路径上每个目录 inode 的权限。用户需要有权限穿过这些目录，最终文件访问才可能成功。

:::remark 问题：为什么除了最终文件，也要检查目录权限？
路径遍历本身也是一种操作。即使用户对最终文件有读权限，系统仍然要判断用户是否可以穿过 `/`、`/home` 和 `/home/pkuos` 到达它。Unix 中目录的 execute permission 通常表示遍历权限。
:::

## 20. 大目录与 B-Tree
早期文件系统把目录表示为 `<file_name, inode>` 条目的列表或数组。这个表示很简单，但当目录变大时，线性搜索会很昂贵。一次查找可能需要读取目录的大部分内容，才能找到目标名字。

FreeBSD、NetBSD 和 OpenBSD 等现代 Unix-family 系统会使用 B-Tree 或目录 hash 这样的索引目录结构。B-Tree 在内部节点中存放有序 key，并利用这些 key 选择子树。B+Tree 在内部节点中保存搜索 key，并把实际条目保存在叶子节点。

![大目录 B+Tree 查找](./lec21_materials/large_directories_btree_search.png)

示例查找的是：

$$
hash("out2") = 0x0000c194
$$

根节点包含 separator key。由于 `0x0000c194` 小于图中第一个根分隔键 `0x00ad1102`，搜索会进入左孩子。下一层内部节点包含分隔键 `0x0000c195`；由于 `0x0000c194` 刚好小于这个分隔键，搜索进入对应的孩子并到达叶子节点。叶子节点中包含 key `0x0000c194`，它把名字 `out2` 映射到文件号 `841014`。

:::remark 问题：目录从线性列表改成 B+Tree 后，发生了什么变化？
线性列表反复问“这个条目是不是我要的”。B+Tree 则反复问“哪个范围可能包含我的 key”，并在每一层丢弃目录中的大部分内容。查找复杂度从关于条目数的线性扫描变成对数级搜索，磁盘 I/O 也集中在树上的一条很短路径上。
:::

## 21. 案例研究：Windows NTFS
NTFS 是现代 Windows 的默认文件系统。它使用 variable-length extent，而不是固定块指针链，并且围绕 **Master File Table（MFT）** 组织元数据。

![NTFS 概览](./lec21_materials/ntfs_overview.png)

NTFS 不使用 FAT 或传统 inode 数组，而是把 MFT 当作类似数据库的结构。每个 MFT entry 最多约 1 KB。几乎所有东西都表示成一串 `<attribute : value>` 对，包括元数据和数据。

一个 MFT entry 可能包含：

- standard information 和 file name attribute 等元数据；
- 小文件的数据本身；
- 对 nonresident data 的 extent 列表 `(start block, size)`；
- 当大文件或碎片化文件需要更多 extent list 时，指向其他 MFT entry 的指针。

## 22. NTFS Resident Data 与 Extents
对于小文件，数据可以 **resident** 在 MFT record 内部。

![NTFS 小文件 resident data](./lec21_materials/ntfs_small_file_resident_data.png)

MFT record 包含 standard information、file name 和 resident data attribute 等属性。standard information 包括 create、modify、access time 等时间，owner ID，security specifier，以及 read-only、hidden、system 等 flags。

对于中等大小文件，数据是 **nonresident** 的。MFT record 保存 start 和 length 等 extent descriptor，真实字节则放在磁盘其他位置的数据 extent 中。

![NTFS 中等文件 extent](./lec21_materials/ntfs_medium_file_extents.png)

一个 extent 表示“某个连续区间从这里开始，长度是这么多”。当文件基本连续时，这种表示很紧凑。一个 extent 可以描述许多块，而不需要每个块一个指针。

:::remark 问题：为什么 extent 对基本连续的文件很高效？
如果一个文件占据一段很长的连续区域，块指针设计需要大量指针，而 extent 设计只需要起始块和长度。元数据开销与连续区间的数量成正比，而不是与块数成正比。
:::

## 23. NTFS 中的大文件与碎片化文件
当文件变得很大或高度碎片化时，一个 MFT entry 可能没有足够空间保存所有 extent descriptor。NTFS 会使用 attribute list 和额外的 MFT record。

![NTFS 大文件 attribute list](./lec21_materials/ntfs_large_file_attribute_list.png)

对于巨大的碎片化文件，主 MFT record 可以指向其他 MFT record，而这些 record 可以保存更多 nonresident data attribute 和 extent list。

![NTFS 巨大碎片化文件](./lec21_materials/ntfs_huge_fragmented_file.png)

这种设计给 NTFS 提供了灵活的增长路径。极小文件可以直接存放在元数据记录中，基本连续的文件可以用 extent 紧凑描述，碎片化文件则可以把元数据溢出到额外记录中。

:::remark 问题：NTFS 灵活 attribute 设计的权衡是什么？
这种灵活设计对极小文件和连续文件很节省空间，但对于巨大的碎片化文件，查找会更复杂。系统可能必须沿 attribute list 访问多个 MFT record，才能得到从逻辑文件偏移到物理 extent 的完整映射。
:::

## 24. NTFS 目录与 Hard Links
NTFS 目录通过 B-Tree 实现。

![NTFS 目录](./lec21_materials/ntfs_directories.png)

文件号标识它在 MFT 中的 entry。MFT entry 总是有 file name attribute，其中保存人类可读的名字和父目录的文件号。一个 hard link 可以表示为同一个 MFT entry 中的多个 file name attribute。

:::remark 问题：这和 Unix 目录项有什么不同？
Unix 强调目录项把名字映射到 inumber，而 inode 保存文件元数据。NTFS 则把 file-name attribute 存放在 MFT entry 自身之中，并包含父目录信息。两者都可以支持一个文件有多个名字，但编码命名关系的方式不同。
:::

## 25. 设计对比
这些案例展示了三种把块变成文件的方式：

| 设计 | 如何找到数据 | 最适合 | 主要代价 |
|---|---|---|---|
| FAT | 文件号索引 File Allocation Table 中链表的根。 | 简单介质、可移植格式、小型系统。 | 随机访问和碎片化表现较弱。 |
| Unix inode | inumber 索引 inode，inode 中有 direct 和多级 indirect pointer。 | 同时支持小文件和大文件，并保持稳定元数据。 | 基本连续的文件也可能需要较多指针结构。 |
| Berkeley FFS | 保留 inode 索引，但用 block group 和分配策略改变物理布局。 | 磁盘上的局部性、可靠性和顺序性能。 | 依赖保留足够空闲空间。 |
| NTFS | MFT record 保存 attribute、resident data、extent，以及到更多 record 的链接。 | 极小文件、连续 extent 和灵活元数据。 | 高度碎片化文件可能需要复杂的元数据遍历。 |

文件系统中的共同主题是：

- 文件系统把块转换成文件和目录。
- 文件系统围绕文件大小分布、访问模式和使用模式优化。
- 文件系统试图最大化顺序访问，同时仍然支持高效随机访问。
- 文件系统暴露操作系统的保护与安全策略，例如 UGO 权限或类似 ACL 的 security descriptor。
- 命名把用户可见名字翻译成系统资源。
- 目录、链式结构、树和 extent list 都是管理这种翻译的方式。

## Exam Review
你应该能够不回看正文，直接解释以下要点：

1. **排队理论仍然影响文件系统。** 更高服务时间和更高利用率会增加排队延迟，尤其当 `u` 接近 1 时。
2. **FAT 把文件布局保存为 File Allocation Table 中的链表。** 顺序遍历很简单，但随机访问第 `k` 个块需要沿链前进。
3. **FAT 目录是 name-to-file-number entry 的线性列表。** 它简单，但大目录会很慢。
4. **Unix inode 把元数据和块指针保存在文件对象中。** 目录项命名 inode，因此 hard link 很自然。
5. **Direct、indirect、double-indirect 和 triple-indirect pointer 构成一棵非对称树。** 小文件保持便宜，大文件仍然可以寻址。
6. **在 1 KB 块的索引例子中，file header 已在内存后，块 5 需要 1 次访问，块 23 需要 2 次，块 340 需要 3 次。**
7. **FFS 通过 block group、bitmap allocation、连续放置、保留空闲空间和旋转延迟处理改善布局。**
8. **Hard link 把名字映射到同一个文件号，symbolic link 把一个名字映射到另一个名字。** Hard link 共享文件对象，symbolic link 可能悬空。
9. **路径名遍历会反复读取目录 inode 和目录数据块。** 系统会检查整条路径上的权限。
10. **大目录需要 B-Tree 或 B+Tree 这样的索引。** 它们避免扫描每个目录项。
11. **NTFS 围绕 MFT 组织文件系统。** 小数据可以 resident 在 MFT record 中，更大数据用 extent 描述，碎片化元数据可以溢出到额外 MFT record。
12. **核心设计张力始终相同：简单元数据、快速顺序访问、高效随机访问、低碎片化、可靠恢复和紧凑表示无法同时全部最大化。**
