# Lec19 - I/O：通用 I/O、磁盘与 SSD

## 学习目标
学完本讲之后，你应该能够解释为什么 I/O 是一个特殊的操作系统问题，处理器如何与 I/O 控制器通信，PIO、DMA、中断、轮询和设备驱动如何配合，以及 HDD 和 SSD 的存储设备性能有何不同。你还应该能够计算基本的磁盘延迟，并解释为什么文件系统和存储栈必须围绕底层设备的真实行为来设计。

## 1. 为什么 I/O 很难
操作系统已经建立了若干主要抽象：为进程提供的 API，为 CPU 管理提供的同步与调度，以及为内存管理提供的虚拟内存。I/O 引入的是另一种边界：系统必须和物理设备交互，而这些设备的接口、速度、失效模式和时序行为差异都很大。

没有 I/O，计算机几乎没有实际用途。但是 I/O 很难，原因主要有三点：
- 设备种类成千上万，而且每个设备都有细微差异。
- 设备可能不可靠，因为介质可能损坏，传输也可能发生错误。
- 设备可能不可预测或很慢，所以 OS 可能不知道一个操作何时结束，也不知道它到底有多昂贵。

:::remark 问题：面对成千上万种不同设备，怎样才能标准化它们的接口？
OS 通过把 **device driver（设备驱动）** 放在通用内核接口之下来标准化设备。应用程序和高层内核子系统使用 `open`、`read`、`write`、`seek`、socket 或 memory-mapped file 等统一操作。设备驱动再把这些通用操作翻译成具体设备需要的寄存器写入、队列更新、DMA 命令和中断处理。
:::

:::remark 问题：设备本身不可靠时，怎样让系统表现得更可靠？
可靠性是分层构建出来的。硬件控制器会使用 error-correcting codes、sector remapping 和内部重试逻辑等机制。内核会继续加入超时处理、错误上报、缓冲、文件系统一致性规则，有时还会加入冗余。关键思想是：原始设备不会直接暴露成一个完全可信的完美对象，而是被控制器、驱动和更高层存储软件逐层包装。
:::

:::remark 问题：如果设备行为或性能无法提前知道，系统该怎样管理它们？
OS 会把“提交请求”和“请求完成”分离。对于慢速或不可预测的设备，线程可以阻塞，非阻塞调用可以返回部分进展，异步请求可以稍后完成。在内部，OS 使用中断和轮询来获知完成状态，并使用调度器或队列避免 CPU 在设备忙碌时白白等待。
:::

设备速率可能跨越 **12 个数量级**。键盘或鼠标只产生极少量数据；磁盘、SSD、网卡、PCIe 链路、内存总线或系统总线可能以 MB/s、GB/s 甚至更高速度移动数据。因此设计规则有两面：
- 对于高速设备，OS 不能在每个字节上引入过高开销。
- 对于低速设备，OS 不能浪费 CPU 时间一直等待。

![设备传输速率](./lec19_materials/device_transfer_rates.png)

## 2. I/O 系统的整体图景
I/O 设备通常不是由 CPU 直接控制的。相反，磁盘、SSD、网卡、显示器、键盘、鼠标等可见设备背后都有 **I/O controller（I/O 控制器）** 支持。控制器是一类理解具体设备的硬件，它向处理器暴露更简单的接口。

![I/O 系统总览](./lec19_materials/io_system_overview.png)

处理器通过读写控制器状态来访问控制器。这些状态可能表现为：
- **寄存器**，例如 command、status、control 和 data register；
- **队列**，例如 request queue 或 completion queue；
- **内存区域**，例如 frame buffer 或 memory-mapped command queue。

一个典型操作通常是这样的：CPU 向控制器写入命令和参数，控制器操作设备，之后 CPU 再读取状态和结果。对于大规模传输，控制器还可以通过 DMA 直接把数据移入或移出主存。

现代 I/O 系统由许多控制器和互连结构组成。一台机器中可能包含图形控制器、桥接/内存控制器、cache、SCSI 或 SATA 控制器、扩展总线、USB、网卡、磁盘、显示器、键盘、打印机、扬声器和其他外设。体系结构故意做成层次化，因为如果所有设备都挂在一个扁平互连上，就很难同时适配带宽和延迟需求差异巨大的设备。

![现代 I/O 系统](./lec19_materials/modern_io_systems.png)

## 3. Bus、PCI 与 PCI Express
**总线（bus）** 是一组公共导线加上一套协议，用于硬件设备之间通信，并执行数据传输事务。总线支持读写等操作，通常包含控制线、地址线和数据线。

总线协议会规定一次事务需要经历的动作顺序：
1. 发起者请求访问总线。
2. 仲裁机制授予某个参与者使用权。
3. 事务接收者被识别出来。
4. 双方通过握手传递地址、长度和数据。

使用总线的原因是：它允许系统用一组导线、连接和协议连接 `n` 个设备，而不需要建立 `O(n^2)` 个直接关系。代价是串行化：传统共享总线同一时刻只能有一个事务使用，所以其他设备必须等待。

:::remark 问题：为什么高带宽链路通常靠近处理器，而低带宽链路被放到更外层？
处理器和内存系统需要低延迟和高带宽，所以它们的互连通常更宽、更快、但灵活性更低。外设更加多样，速度也常常更慢，因此外层 I/O 子系统会用带宽换取灵活性、兼容性，以及连接多种硬件的能力。
:::

**PCI（Peripheral Component Interconnect）** 最初就是一种总线。它的并行总线结构有一些限制：地址和数据信号可能要在许多请求之间复用，而且最慢的设备也必须能参与到足以说明当前发生了什么的程度，例如参与仲裁。

**PCI Express “Bus”** 已经 **no longer a parallel bus（不再是并行总线）**。它实际上是 **really a collection of fast serial channels or “lanes”（一组快速串行通道或 lane）**。设备可以使用所需数量的 lane 来达到目标带宽，低速设备也不必和高速设备共享同一条并行总线。这把模型从一条共享总线上的时间复用，变成了通过独立 lane 进行的空间复用。

Linux 设备抽象的一个成功之处在于：系统可以从 PCI 迁移到 PCI Express，即使物理互连完全改变，旧的软件侧 API 仍然可以工作。这是因为 OS 已经把设备接口语义和物理连线方式分离开了。

![PCI 架构示例](./lec19_materials/pcie_architecture.png)

一个典型 PCI 架构包含通过内存总线和 host bridge 相连的 RAM 与 CPU。再往下，PCI bridge 和 ISA bridge 连接 PCI slots、USB controller、SATA controller、root hub、webcam、keyboard、mouse、DVD-ROM、hard disk、scanner 和 legacy devices。它是一棵由 bridge 和 controller 构成的树，而不是 CPU 到每个设备的直接连接。

## 4. 处理器如何与设备通信
CPU 与 **controller（控制器）** 交互。控制器包含一组可读写寄存器，也可能包含 request queue、completion queue 或设备数据使用的内存。

![处理器与设备控制器](./lec19_materials/processor_device_controller.png)

处理器访问控制器寄存器通常有两种方式：
- **Port-Mapped I/O（端口映射 I/O）** 使用专门的 I/O 指令。在 Intel 风格架构中，类似 `out 0x21, AL` 的指令会写入一个 I/O 端口。
- **Memory-mapped I/O（内存映射 I/O）** 让寄存器或设备内存出现在物理地址空间中，于是普通 load/store 指令就能完成 I/O。

Memory-mapped I/O 特别重要，因为它让设备控制看起来像内存访问，同时 OS 仍然可以通过地址转换保护这些区域。

### 4.1 示例：Memory-Mapped Display Controller
一个 memory-mapped display controller 会把控制寄存器和显示内存映射到物理地址空间。地址可能由硬件跳线设置，也可能在启动时设置。

![内存映射显示控制器](./lec19_materials/memory_mapped_display_controller.png)

这个例子包含三类不同的映射状态：
- **frame buffer**，也叫 display memory，映射在 `0x8000F000 - 0x8000FFFF`。向这里写入字节会改变屏幕图像。
- **graphics command queue** 映射在 `0x80010000 - 0x8001FFFF`。软件可以把图形描述写进这个队列，例如描述某个场景的一组三角形。
- **command register** 映射在 `0x0007F004`，向它写入“render the scene”这类命令，可能会触发板载图形硬件开始工作。图中还显示了位于 `0x0007F000` 的 status register。

:::remark 问题：如果设备内存出现在物理地址空间中，为什么这仍然是安全的？
OS 可以用地址转换保护 memory-mapped I/O。用户程序通常不应该直接获得任意设备寄存器的映射。内核控制哪些虚拟地址映射到哪些物理设备区域，因此既能暴露安全接口，也能隐藏特权寄存器。
:::

### 4.2 机器里不只有 CPU
现代处理器集成的 I/O 相关功能比“CPU”这个词暗示的更多。Skylake 时代的 x86 芯片包含四个乱序执行核心、更深的缓冲区、Intel MPX、Intel SGX、每周期最多发射 6 个 micro-operations 的能力、GPU、负责内存和快速 I/O 的 system agent、由片上 ring bus 连接的共享 L3 cache，以及集成 I/O。

重要的集成 I/O 部分包括：
- 带有两个独立 DRAM channel 的 integrated memory controller；
- 用于图形卡的高速 PCI Express；
- 连接到 Platform Controller Hub（PCH）的 Direct Media Interface（DMI）。

**Platform Controller Hub** 通过 DMI 连接到处理器，并处理许多较低速的 I/O 类型：USB、Ethernet、Thunderbolt 3、audio、BIOS support、较低速 PCIe，以及用于磁盘的 SATA。这也是层次化 I/O 的一个例子：最快路径靠近处理器，而多样化外设功能则通过控制器集线器连接。

## 5. I/O 的操作参数
可以沿着几个维度刻画 I/O 设备。

| 参数 | 主要选择 | 示例与含义 |
|---|---|---|
| 数据粒度 | Byte vs. block | 键盘可能一次产生一个 byte 或 character；磁盘和网络通常移动 block 或 packet。 |
| 访问模式 | Sequential vs. random | 磁带天然是顺序访问；磁盘和 CD 可以随机访问，但随机访问存在固定启动开销。 |
| 监控方式 | Polling vs. interrupts | 有些设备需要持续检查状态；有些设备在需要服务时生成中断。 |
| 传输机制 | Programmed I/O vs. DMA | 小数据可以经过 CPU；大数据通常应由控制器直接搬运。 |

这些参数很重要，因为 I/O 接口不只关心支持哪些操作，还关心这些操作有多昂贵，以及 OS 应该怎样等待它们。

## 6. 数据移动：Programmed I/O 与 DMA
**Programmed I/O** 让每个字节都通过处理器传输，方式可以是专门 I/O 指令，也可以是对 memory-mapped register 的普通 load/store。它的优点是硬件简单、编程容易；缺点是消耗的 CPU 周期与数据大小成正比。

**Direct Memory Access（DMA）** 把访问内存总线的能力交给控制器，并要求控制器直接在设备与内存之间传输数据块。当设备需要移动超过很少量的数据时，DMA 通常就是标准答案。

![DMA 流程开始](./lec19_materials/dma_sequence_start.png)

![DMA 流程结束](./lec19_materials/dma_sequence_finish.png)

一次从磁盘读入内存的代表性 DMA 流程如下：
1. 设备驱动收到请求：把磁盘数据传输到地址为 `X` 的内存 buffer。
2. 驱动告诉磁盘控制器：从磁盘向地址 `X` 的 buffer 传输 `C` 个字节。
3. 磁盘控制器发起 DMA transfer。
4. 磁盘控制器把每个字节发送给 DMA controller。
5. DMA controller 把字节传输到 buffer `X`，同时递增内存地址并递减 `C`，直到 `C = 0`。
6. 当 `C = 0` 时，DMA controller 中断 CPU，通知传输完成。

这里最重要的状态变化是：CPU 只在开头和结尾深度参与。它负责设置命令并处理完成事件，但中间的大量数据移动不需要 CPU 为每个字节执行一条指令。

:::remark 问题：Programmed I/O 在什么时候仍然合理？
Programmed I/O 适合极小传输、简单设备，或者重视简单性的早期启动代码。对于大传输，它会变得浪费，因为每个字节都占用 CPU 注意力，而这些 CPU 时间本可以用于计算或调度其他进程。
:::

## 7. 如何知道 I/O 已经完成：中断与轮询
OS 需要知道 I/O 设备何时完成操作，或何时遇到错误。基本通知机制有两种。

**I/O Interrupt（I/O 中断）** 表示设备在需要服务时生成一个中断。中断很适合处理不可预测事件，但相对开销较高。

**Polling（轮询）** 表示 OS 周期性检查设备专属的 status register。设备把完成信息放在这个寄存器中。轮询每次检查的开销较低，但当 I/O 操作不频繁或不可预测时，可能浪费大量 CPU 周期。

真实设备常常同时使用两者。例如，高带宽网卡可以在第一个进入的数据包到来时触发中断，然后 OS 继续轮询后续数据包，直到硬件队列为空。这样在高负载下避免中断风暴，同时在流量刚到来时仍然能快速响应。

:::remark 问题：为什么不总是使用中断？
中断非常适合罕见或不可预测事件，但每次中断都会迫使 CPU 停下当前工作、进入内核、保存状态、运行 handler，之后再恢复。事件频率很高时，这些开销会压过真正有用的工作。如果 OS 已经预期很快会有更多完成事件，轮询可能更好。
:::

:::remark 问题：为什么不总是轮询？
只有在设备很可能已经准备好工作时，轮询才高效。如果设备大多数时间空闲，轮询就会反复检查空的 status register，白白燃烧 CPU 周期。阻塞和中断可以让 CPU 去运行其他工作。
:::

## 8. Kernel I/O Subsystem 与 Device Driver
内核通过通用子系统组织 I/O。系统调用从 system-call interface 进入内核，然后到达 process management、memory management、file systems、device control、networking 等组件。文件系统会使用 VFS 和 block-device layer；网络会使用 network subsystem 和 interface driver；终端和字符设备则使用 TTY 与 device-control 路径。

![内核设备结构](./lec19_materials/kernel_device_structure.png)

关键定义是：**Device Driver（设备驱动）：内核中与设备硬件直接交互的设备专属代码**。驱动支持标准内部接口，因此同一个内核 I/O 系统可以和许多不同设备驱动交互。特殊的设备专属配置可以通过 `ioctl()` 系统调用支持。

设备驱动通常分成两个部分：
- **top half（上半部）** 位于系统调用的调用路径上。它实现 `open()`、`close()`、`read()`、`write()` 和 `ioctl()` 等跨设备标准调用。它是内核到设备驱动的接口，会启动对设备的 I/O，并且可能让调用线程睡眠直到操作完成。
- **bottom half（下半部）** 作为中断例程运行。它接收输入、传输下一个输出块、记录完成状态，并且如果 I/O 已完成，可能唤醒睡眠线程。

### 8.1 一次 I/O 请求的生命周期
一次 I/O 请求的生命周期会跨越用户代码、内核子系统、驱动代码、中断处理和硬件。

![I/O 请求生命周期](./lec19_materials/io_request_lifecycle.png)

一个典型请求会这样演化：
1. 用户程序请求 I/O，通常是发起系统调用。
2. kernel I/O subsystem 检查请求是否已经可以被满足。如果不能，它把请求发送给设备驱动。
3. 驱动 top half 处理请求，向控制器发出命令，配置控制器使其阻塞直到被中断，并且可能让调用线程睡眠。
4. 设备硬件监控设备，并最终完成操作或检测到错误。
5. 设备控制器生成中断。
6. interrupt handler，也就是驱动 bottom half 的一部分，接收中断，必要时把数据存入 device-driver buffer，通知或解除驱动阻塞，并把状态报告给 kernel I/O subsystem。
7. 内核把数据传给用户进程，或报告完成/错误码，然后系统调用返回。

:::remark 问题：为什么要把驱动分成 top half 和 bottom half？
top half 在服务系统调用的普通内核上下文中运行，因此可以进行设置工作，也可以睡眠。bottom half 在中断上下文中运行，因此应该短小、快速，专注于确认硬件、记录完成状态、唤醒后续工作。这样的拆分让中断处理保持响应性，同时把复杂驱动逻辑留在其他位置执行。
:::

## 9. 设备的标准接口
I/O subsystem 的目标是 **provide uniform interfaces, despite wide range of different devices（即使设备差异巨大，也提供统一接口）**。一小段代码可以运行在许多不同设备上，因为驱动实现了标准接口：

```c
FILE fd = fopen("/dev/something", "rw");
for (int i = 0; i < 10; i++) {
    fprintf(fd, "Count %d\n", i);
}
close(fd);
```

![标准设备接口](./lec19_materials/device_interfaces.png)

标准设备类别包括：

| 设备类别 | 例子 | 接口风格 |
|---|---|---|
| **Block Devices（块设备）** | disk drives、tape drives、DVD-ROM | 访问数据块；命令包括 `open()`、`read()`、`write()` 和 `seek()`；可以使用 raw I/O、file-system access，也可以使用 memory-mapped file access。 |
| **Character Devices（字符设备）** | keyboards、mice、serial ports、some USB devices | 一次访问一个字符；命令包括 `get()` 和 `put()`；库可以在其上加入行编辑能力。 |
| **Network Devices（网络设备）** | Ethernet、wireless、Bluetooth | 与 block/character device 差异足够大，因此有自己的接口；Unix 和 Windows 提供 `socket` interface，把 network protocol 和 network operation 分离，并包含 `select()` 功能。 |

类 Unix 系统还会把 pipes、FIFOs、streams、queues 和 mailboxes 作为类似 I/O 的通信机制使用。

## 10. 时序接口：Blocking、Non-Blocking 与 Asynchronous
用户还需要决定如何处理时序。同一个概念上的 read 或 write，可以有不同的时序语义。

| 时序接口 | 核心思想 | read 行为 | write 行为 |
|---|---|---|---|
| **Blocking Interface: “Wait”** | 调用者等待，直到操作能够取得进展。 | `read()` 让进程睡眠，直到数据准备好。 | `write()` 让进程睡眠，直到设备准备好接收数据。 |
| **Non-blocking Interface: “Don’t Wait”** | 调用很快返回。 | 返回成功传输的字节数；也可能没有读到任何数据。 | 可能只写入一部分字节，也可能什么都没写。 |
| **Asynchronous Interface: “Tell Me Later”** | 现在提交请求，稍后报告完成。 | 调用者传入用户 buffer 指针；内核稍后填充 buffer 并通知用户。 | 调用者传入用户 buffer 指针；内核稍后取走数据并通知用户。 |

:::remark 问题：Non-blocking I/O 和 Asynchronous I/O 有什么区别？
Non-blocking I/O 问的是：“你现在能不能做一点事？”如果不能，调用立刻返回，程序之后可以再试。Asynchronous I/O 问的是：“请开始这个操作，完成时告诉我。”程序不需要手动重复提交同一个操作，而是等待完成通知。
:::

## 11. 存储设备：磁盘与 Flash Memory
存储设备都提供 block-level random access，但它们的内部行为差异很大。

**Magnetic disks（磁盘）** 有一些有用性质：
- 存储内容很少损坏；
- 容量大且成本低；
- 支持 block-level random access；
- 随机访问性能慢；
- 顺序访问性能更好。

**Flash memory（闪存）** 有另一种特征：
- 存储内容很少损坏；
- 成本处于中间水平，在这个比较中大约是磁盘的 5-20 倍，并且差距正在缩小；
- 支持 block-level random access；
- 读性能好，但随机写性能更差；
- 必须以较大的块为单位擦除；
- 存储数据的能力会随着写入次数增加而退化。

一个历史硬盘例子能说明存储硬件变化有多大。1986 年 IBM Personal Computer/AT 可以使用 30 MB 硬盘，价格约 $500，seek time 为 30-40 ms，估计传输带宽约 0.7-1 MB/s。现代硬盘的容量和带宽已经大幅提高，但 seek time 改善得远少得多，因为机械移动仍然很难。

## 12. 磁盘几何结构
磁盘上的传输单位是 **sector（扇区）**。一圈 sector 构成一条 **track（磁道）**。不同盘面上位于同一半径位置的一叠 track 构成一个 **cylinder（柱面）**。磁头会定位到 cylinder 上。

![磁盘几何结构](./lec19_materials/disk_geometry.png)

一条磁盘 track 可以只有约 1 微米宽。作为对比，可见光波长约 0.5 微米，人眼分辨率约 50 微米。一个典型 2.5 英寸磁盘可以包含约 100K 条 track。track 之间由未使用的 guard region 隔开，用来降低写入时破坏相邻 track 的概率，不过风险并不是零。

track 长度会随磁盘位置变化。外圈 track 每条包含更多 sector，因此带宽更高。磁盘通常被组织成若干区域，每个区域内的 track 拥有相同数量的 sectors/track。实际活动数据可能只使用外半径，因为磁盘面积大多位于外圈区域。非常大的磁盘可能只把一部分空间用于活跃数据，其余作为归档数据，因为不同区域的性能差异会影响访问效率。

### 12.1 Shingled Magnetic Recording
**Shingled Magnetic Recording（SMR，叠瓦式磁记录）** 像屋顶瓦片一样让 track 彼此重叠。重叠 track 可以提高密度和容量，但会限制写入，因为重写一条 track 可能干扰相邻 track。读取也需要更复杂的数字信号处理。它的权衡是：用写入灵活性换取容量。

:::remark 问题：为什么 SMR 会让写入更困难？
传统 track 周围有 guard space，因此重写一条 track 相对独立。SMR 中 track 发生重叠；修改一条 track 可能部分覆盖下一条 track 的安全区域。因此设备必须按更大的有序区域写入，或者使用内部缓冲和地址转换来隐藏这个限制。
:::

## 13. 磁盘延迟
一个关键定义是：**Cylinders（柱面）：在所有盘面上，位于某一给定磁头位置下的所有 track**。

读写磁盘数据是一个三阶段机械过程：
1. **Seek time（寻道时间）** 把磁头臂定位到正确 track 上方。
2. **Rotational latency（旋转延迟）** 等待目标 sector 旋转到读写磁头下方。
3. **Transfer time（传输时间）** 把一个 block 的 bit，通常是一个或多个 sector，移动经过读写磁头。

![磁盘延迟模型](./lec19_materials/disk_latency_model.png)

基本延迟公式是：

$$
\textbf{Disk Latency = Queueing Time + Controller time + Seek Time + Rotation Time + Xfer Time}
$$

典型磁盘数字包括：
- 3.5 英寸 Seagate 磁盘中 14 TB 空间和 8 个 platter；
- areal density 至少达到 1 Terabit per square inch；
- average seek time 约 4-6 ms；
- 笔记本/台式机磁盘转速约 3600-7200 RPM，即每圈 16-8 ms；
- 服务器磁盘转速可达 15000 RPM；
- 平均旋转延迟约为半圈，常见磁盘大约是 4-8 ms；
- transfer rate 约 50-250 MB/s，取决于 transfer size、rotation speed、recording density 和 diameter。

### 13.1 磁盘性能计算例子
假设忽略 queueing time 和 controller time，average seek time 是 5 ms，磁盘转速是 7200 RPM，transfer rate 是 50 MB/s，block size 是 4 KB。

![磁盘性能计算例子](./lec19_materials/disk_performance_example.png)

一圈旋转时间为：

$$
\frac{60000\ \text{ms/min}}{7200\ \text{rev/min}} \approx 8\ \text{ms per rotation}
$$

平均旋转延迟是半圈：

$$
8\ \text{ms} / 2 = 4\ \text{ms}
$$

以 50 MB/s 传输一个 4 KB block 的传输时间为：

$$
\frac{4096\ \text{bytes}}{50 \times 10^6\ \text{bytes/s}} = 81.92 \times 10^{-6}\ \text{s} \approx 0.082\ \text{ms}
$$

现在比较三种访问模式：

| 访问模式 | 时间计算 | 有效带宽 |
|---|---:|---:|
| 从磁盘随机位置读取随机 block | `5 ms + 4 ms + 0.082 ms = 9.082 ms` | `4096 / 9.082e-3 ~= 451 KB/s` |
| 在同一个 cylinder 中读取随机 block | `4 ms + 0.082 ms = 4.082 ms` | `4096 / 4.082e-3 ~= 1.03 MB/s` |
| 读取同一 track 上的下一个 block | `0.082 ms` | `4096 / 0.082e-3 ~= 50 MB/s` |

关键结论是：**高效使用磁盘，尤其是文件系统高效使用磁盘，核心在于尽量减少 seek delay 和 rotational delay**。原始介质带宽可以达到几十或几百 MB/s，但小随机 I/O 会因为固定机械延迟占主导而跌到几百 KB/s。

:::remark 问题：为什么顺序磁盘 I/O 比随机磁盘 I/O 快这么多？
顺序 I/O 复用了当前磁头位置，以及当前正在经过磁头的一串 sector。随机 I/O 则会在传输很小 block 之前，反复支付 seek time 和 rotational latency。当传输的 block 只有 4 KB 时，真正的数据传输时间相对于机械启动成本非常小。
:::

## 14. 磁盘控制器中的智能
磁盘控制器包含大量内部智能。它们并不只是把原始旋转介质暴露出来。

重要控制器机制包括：
- **Error-correcting codes（ECC）**：sector 内含复杂纠错码，用于隐藏相邻 track 写入造成的一些损坏。
- **Sector sparing**：把坏 sector 透明地重映射到同一 surface 上的备用 sector。
- **Slip sparing**：当出现坏 sector 时，重映射后续所有 sector，从而比孤立重映射更好地保持顺序访问行为。
- **Track skewing**：让相邻 track 之间的 sector 编号发生偏移，以便顺序操作时给磁头移动留出时间。

![Track skewing](./lec19_materials/track_skewing.png)

Track skewing 是一个细小但重要的过程细节。假设磁头刚读完 track 1 上最后一个有用 sector，接着需要移动到 track 2。磁头移动需要时间。如果 track 2 的 sector 编号从和 track 1 相同的角度位置开始，那么 sector 0 可能在磁头到达前就已经转过去了，导致额外等待几乎一整圈。Skewing 会让 track 2 的编号偏移，使下一个逻辑 sector 恰好在磁头完成移动后到达。

### 14.1 当前 HDD 例子
2020 年的 Seagate Exos X18 展示了现代 HDD 的规模：
- 18 TB hard disk；
- 9 个 platter 和 18 个 head；
- helium filled，用于减少摩擦和功耗；
- 4.16 ms average seek time；
- 4096-byte physical sectors；
- 7200 RPM；
- dual 6 Gbps SATA 或 12 Gbps SAS interface；
- 270 MB/s maximum transfer rate；
- 256 MB cache；
- 价格约 $562，也就是约 $0.03/GB。

![当前 HDD 例子](./lec19_materials/current_hdd_example.png)

与 1986 年 IBM Personal Computer/AT 例子相比，容量大约提升 600K 倍，带宽大约提升 300 倍，单位容量价格大约改善 567K 倍，而 seek latency 只改善了约 10 倍。机械定位仍然是顽固瓶颈。

## 15. Solid State Disks
Solid State Disks（SSD，固态硬盘）用非易失内存替代旋转磁介质。约 1995 年的早期 SSD 使用 battery-backed DRAM 等非易失内存。到约 2009 年，SSD 普遍使用 NAND multi-level cell flash memory，每个 cell 存储 2 或 3 bit。

在 NAND flash 中，类似 4 KB page 的 sector-sized unit 是可寻址的，但 pages 会组成更大的 memory block。一个 block 可能包含 4-64 个 page。被困住的电子用于区分逻辑 1 和 0。

SSD 没有移动部件，因此消除了 seek 和 rotational delay。典型访问可以低于 0.1-0.2 ms，并且 SSD 低功耗、轻量。主要复杂性在于有限写入周期。

## 16. SSD Reads
一个 SSD 包含 SATA 等 host interface、buffer manager 和 software queue、DRAM、flash memory controller，以及许多 NAND chips。读请求可以通过对多个 flash package 的并行访问来服务。

![SSD 读架构](./lec19_materials/ssd_read_architecture.png)

一个代表性读数字是：读取 4 KB page 约 25 microseconds。这里没有 seek 或 rotational latency。通过 SATA 传输一个 4 KB page 的时间也很小；在约 300-600 MB/s 下，传输约 10 microseconds。

对于读操作，延迟公式变成：

$$
\textbf{Latency = Queueing Time + Controller time + Xfer Time}
$$

最高读带宽可以来自顺序读，也可以来自足够并行的随机读。没有机械移动这一点彻底改变了性能模型。

## 17. SSD Writes、Erase Blocks 与 FTL
SSD 写比读复杂得多。写入数据可能需要约 200 microseconds 到 1.7 ms，而擦除一个 block 可能需要约 1.5 ms。

![SSD 写入块结构](./lec19_materials/ssd_write_blocks.png)

核心约束是：flash 只能向 block 中的空 page 写入。SSD 向 OS 暴露类似磁盘的接口，因此 OS 以 4 KB chunk 为单位读写。可是在设备内部，它可能只能以更大的 block 为单位擦除和重写，例如 256 KB。一个典型 NAND flash block 可能包含许多 4 KB page，例如一个可擦除 block 中有 64 个可写 page。

一个有用经验法则是：
- 写大约比读慢 10 倍；
- 擦除大约比写慢 10 倍。

:::remark 问题：为什么不在 4 KB page 改变时，直接擦除并重写整个 256 KB block？
这样既慢又伤设备。擦除需要毫秒级时间，而逻辑更新可能只有 4 KB。每个 block 的寿命也是有限的，可能只能被擦除和重写约 10K 次。如果控制器每次 hot logical page 更新都反复擦除同一个 physical block，高频使用的 block 会很快磨损。
:::

解决方案使用两个系统原则。

### 17.1 Layer of Indirection
SSD 维护一个 **Flash Translation Layer（FTL，闪存转换层）**。FTL 把 OS 使用的 virtual block number 映射到 flash controller 使用的 physical page number。控制器可以在 OS 不知情的情况下移动数据。

### 17.2 Copy on Write
更新时，SSD 不会在原位置覆盖旧 page，因为那样需要先擦除。相反，它把新版本写入一个 free page，然后更新 FTL mapping，让它指向新的物理位置。

![FTL 与 copy on write](./lec19_materials/ssd_ftl_cow.png)

这样就不需要为了每次小修改而擦除并重写整个 256 KB block。它还允许控制器把写入分散到不同 physical pages 上，这叫 **wear leveling（磨损均衡）**。

旧版本 page 最终必须被回收。后台 **garbage collection（垃圾回收）** 过程会识别包含 obsolete pages 的 block，必要时把仍然存活的 pages 复制到其他地方，擦除旧 block，并把它们加入 free list。

![Flash Translation Layer](./lec19_materials/flash_translation_layer.png)

:::remark 问题：如果 OS 看到的仍然是和 HDD 一样的 4 KB read/write 接口，为什么 SSD 行为仍然重要？
接口相同，但性能模型不同。随机读便宜，因为没有 seek。随机写可能昂贵，因为它会触发 copy-on-write、garbage collection、erase blocks 和 wear leveling。假设 HDD 风格成本的文件系统或数据库可能错过优化机会；反过来，如果以为写总是便宜，也可能遭遇 garbage-collection stall 和 write amplification。
:::

## 18. 当前 SSD 例子与 HDD/SSD 趋势
大型 SSD 已经能提供高容量和很强的随机读性能，但写行为和价格仍然重要。

| 设备 | 容量与接口 | 顺序性能 | 随机性能 | 价格备注 |
|---|---|---|---|---|
| Seagate Exos SSD, 2017 | 15.36 TB，dual 12 Gb/s interface | reads 860 MB/s，writes 920 MB/s | reads 102K IOPS，writes 15K IOPS | 约 $5495，即 $0.36/GB |
| Nimbus SSD, 2019 | 100 TB，dual-port 12 Gb/s interface | reads/writes 500 MB/s | reads 100K IOPS | 约 $40K，即 $0.4/GB；50 TB drive 约 $12500，即 $0.25/GB |

![HDD 与 SSD 对比](./lec19_materials/hdd_ssd_comparison.png)

SSD 价格下降速度比 HDD 更快。在图示比较中，SSD 每 TB 成本从 2013 年约 $2220/TB 下降到 2020 年约 $128/TB；HDD 每 TB 成本从约 $60/TB 下降到约 $22/TB。因此 SSD/HDD 价格比从约 37 缩小到约 5.8。

### 18.1 SSD 总结
和硬盘相比，SSD 有明显优势：
- 低延迟、高吞吐，因为它消除了 seek 和 rotational delay；
- 没有移动部件，因此轻、低功耗、安静，并且抗震；
- 读性能强，主要受 controller 和 I/O bus 限制，而不是机械运动限制。

SSD 也有重要缺点和注意事项：
- block write performance 是不对称的，因为更新可能涉及 read page、erase block 和 write page；
- controller 的 garbage-collection 算法对性能影响很大；
- drive lifetime 有限，在这个总结中 multi-level cell NAND 大约是每 page 1-10K 次写入；
- average failure rate 和 life expectancy 有限，示例值包括约 6 年 average failure rate 和 9-11 年 life expectancy；
- 容量和成本比较变化很快。

早期那种“SSD simply read at memory speeds”的说法已经不再普遍成立。SSD 在许多随机访问工作负载上远快于 HDD，但它的性能仍然由 controller、bus、queue、flash organization、erase behavior 和 garbage collection 共同塑造。

## 19. 通用设备性能模型
思考设备性能的通用方式是：

$$
\textbf{Response time (Latency) = Queue + Overhead + Transfer}
$$

如果设备有原始带宽 `BW`、传输时间 `T`，以及固定启动或开销时间 `S`，则有效带宽为：

$$
\textbf{Effective BW = BW * T/(S+T)}
$$

这个公式解释了为什么小 I/O 操作可能效率很低。当 `S` 相对 `T` 很大时，大多数时间都没有用于传输有用数据。HDD 经常遭遇这个问题，因为 seek 和 rotation 主导小随机请求。SSD 移除了 seek 和 rotation，但仍然有 queueing、controller time、transfer time、erase cost、garbage collection 和 wear-related behavior。

对于 HDD：

$$
\textbf{Latency = Queueing time + controller + seek + rotation + transfer}
$$

对于 SSD：

$$
\textbf{Latency = Queueing time + controller + transfer}
$$

但必须记住，SSD 写入中的 transfer behavior 还包含 erasure 和 wear effects。

:::remark 问题：为什么文件系统要相对于底层设备来设计？
文件系统是一层 I/O 策略。对于 HDD，它应该保持 locality、批量写入、把相关 block 分配得更近，并避免随机 seek。对于 SSD，它更应该关心 write amplification、erase-block alignment、garbage collection 和 endurance。同一个高层 file API 可以保持不变，但最佳实现取决于设备的性能与可靠性特征。
:::

## Exam Review
I/O 很难，因为设备异构、不可靠、不可预测，并且速度差异极大。OS 通过 controller、driver、queue、interrupt、polling、DMA 和通用设备接口来处理这些问题。

处理器通常与 controller 通信，而不是直接与设备通信。控制器状态表现为 registers、queues 或 memory-mapped regions。在 **Port-Mapped I/O** 中，专门 I/O 指令访问 port。在 **Memory-mapped I/O** 中，控制器寄存器或设备内存出现在物理地址空间里，并由普通 load/store 指令访问。

**Programmed I/O** 简单，但会消耗与数据大小成正比的 CPU 周期。**DMA** 让 controller 在设备和内存之间直接移动 block，因此 CPU 只负责设置 transfer 并处理完成事件，而不是复制每个字节。

完成事件可以通过 **interrupts** 或 **polling** 检测。中断适合不可预测事件，但开销高。轮询适合很快就会有完成事件的情况，但设备空闲时会浪费 CPU 时间。高性能设备常常把两者结合起来。

**Device Driver（设备驱动）** 是 **内核中与设备硬件直接交互的设备专属代码**。top half 处理 `open`、`read`、`write` 和 `ioctl` 等系统调用路径；bottom half 处理中断、记录完成状态并唤醒睡眠工作。

设备接口通常分为 **block**、**character** 和 **network** 三类。时序接口可以是 **blocking**（等待）、**non-blocking**（快速返回）或 **asynchronous**（现在提交，稍后通知）。

对于 HDD，要记住几何结构：sector、track、cylinder、head、platter。磁盘延迟是：

$$
\textbf{Disk Latency = Queueing Time + Controller time + Seek Time + Rotation Time + Xfer Time}
$$

对于 7200 RPM 磁盘，一圈约 8 ms，平均旋转延迟约 4 ms。如果 seek 是 5 ms，传输 4 KB block 需要 0.082 ms，那么随机 block 约需 9.082 ms，有效带宽只有约 451 KB/s。同一 track 上的下一个 block 可以接近 50 MB/s，因为 seek 和 rotation 被去掉了。

磁盘控制器使用 ECC、sector sparing、slip sparing 和 track skewing。Track skewing 会让相邻 track 的 sector 编号偏移，使顺序读取时磁头移动不会损失一整圈。

对于 SSD，没有 seek 或 rotational delay。读很快，但写很复杂，因为 flash 可以向空 page 写入，却只能以更大的 block 为单位擦除。SSD 使用 **Flash Translation Layer（FTL）** 间接层和 **Copy on Write**：把新版本写到 free page，更新 mapping，之后再 garbage-collect old pages。Wear leveling 会把写入分散到不同 physical pages 上。

宽泛的性能模型是：

$$
\textbf{Response time (Latency) = Queue + Overhead + Transfer}
$$

以及：

$$
\textbf{Effective BW = BW * T/(S+T)}
$$

实践上的核心教训是：同一个 API 可以向应用隐藏硬件差异，但 OS 和存储栈仍然必须理解设备真实的 latency、bandwidth、reliability 和 write behavior。
