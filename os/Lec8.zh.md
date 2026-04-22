# Lec8 - 同步 3：锁实现、原子指令与管程

## 学习目标
学完本讲后，你应当能够解释为什么锁实现需要超越普通 load/store 的硬件支持，能够分析基于 sleep/wakeup 的锁实现中为什么会出现丢失唤醒问题，能够比较“关中断”与“test-and-set”两类锁实现，并且能够正确使用“管程 + 条件变量”（包括 Mesa 与 Hoare 语义差异）。

## 1. 回顾：为什么同步设计容易出错

### 1.1 生产者-消费者与有界缓冲区约束
生产者-消费者问题描述的是两类线程共享一个缓冲区：
- 生产者线程负责放入数据。
- 消费者线程负责取出数据。
- 当缓冲区满或空时，双方必须按规则等待。

![Too-Much-Milk 时间线类比](./lec08_materials/too_much_milk_timeline_table.png)

一个正确的有界缓冲区方案，必须把约束分开处理：
1. 生产者容量约束（满则等待）。
2. 消费者可用性约束（空则等待）。
3. 共享队列元数据访问的互斥约束。

### 1.2 错误等待策略会导致什么
如果线程在循环中反复释放/获取锁并忙等，虽然有时还能保持正确性，但会浪费 CPU，并在高竞争下表现非常脆弱。

:::remark 问题：在朴素的“锁循环等待”里，一方等待另一方时会发生什么？
等待方会持续消耗 CPU 周期却没有实际推进（busy waiting，忙等待）。在不利调度下，它还会反过来挤占真正能够改变条件的线程运行时间。
:::

### 1.3 Too-Much-Milk 回顾结论
Too-Much-Milk 案例说明并发错误经常同时具备三种特征：
- 触发窗口很窄，问题看起来“偶发”；
- 一旦触发就破坏正确性（可能多买，也可能没人买）；
- 代码表面看着“合理”，但其实很难严格证明。

更重要的结论是：同步接口必须把“等待语义”表达清楚，而且要便于验证。

## 2. 锁接口与正确性目标

锁至少应提供两个操作：
- `acquire(&lock)`：等待直到锁空闲，然后原子地拿到锁。
- `release(&lock)`：释放锁；如果有人等待，则唤醒等待者。

这两个操作在更新锁元数据时必须是原子的。否则两个等待者可能同时看到“空闲”，再同时进入，互斥性立刻失效。

## 3. 用关中断实现锁

### 3.1 朴素实现与根本问题
单处理器上的最初想法是：
- `LockAcquire { disable interrupts; }`
- `LockRelease { enable interrupts; }`

这并不适合作为通用锁机制：
- 用户态代码不能被允许全局关中断。
- 长临界区会延迟关键设备与时钟事件。
- 实时性无法保证。
- 在多处理器上扩展性很差。

![朴素关中断锁的风险](./lec08_materials/naive_disable_interrupts_risks.png)

### 3.2 更好的内核实现：只保护锁元数据操作
改进版做法是：仅在 `Acquire()/Release()` 修改锁状态的短窗口内关中断，而不是在用户临界区全程关中断。

这样既能保证“检查 + 更新”原子性，又能把全局影响范围压缩到最小。

:::remark 问题：为什么这里仍然需要关中断？
因为 `Acquire()` 在“检查锁状态”和“修改锁状态”之间不能被打断。若被打断，两个线程可能都以为自己拿到了同一把锁。
:::

### 3.3 难点：sleep 前后到底在哪儿开中断
当 `Acquire()` 发现锁忙时，需要入等待队列并进入睡眠。开中断的位置非常关键。

![开中断位置与丢失唤醒风险](./lec08_materials/enable_position_missed_wakeup.png)

如果开中断时机不对，会出现丢失唤醒：
- 入队之前开中断：`Release()` 可能看不到等待者，导致不唤醒。
- 入队之后、真正 `sleep()` 之前开中断：`Release()` 可能已经把该线程唤醒为 ready，但该线程随后仍执行 sleep，导致“唤醒丢失”。

### 3.4 sleep 之后如何正确恢复
稳妥策略是：
- 调用 `sleep()` 时保持中断关闭。
- 发生上下文切换后，由“下一个运行线程”负责重新开中断。
- 该睡眠线程将来被唤醒恢复时，再继续 `Acquire()` 并一致地恢复中断状态。

![sleep 后由调度器路径恢复中断](./lec08_materials/scheduler_reenable_after_sleep.png)

### 3.5 内核锁仿真的“状态变化”视角
整个过程涉及以下状态同步变化：
- `value`（`FREE/BUSY`），
- wait queue 成员变化，
- owner 归属变化，
- 线程 running/ready/waiting 状态迁移。

![内核锁仿真状态变化](./lec08_materials/in_kernel_lock_simulation_state_changes.png)

核心点是：锁所有权转移、队列操作和唤醒必须协同原子化，否则就会出现丢失唤醒。

## 4. 原子读-改-写指令（RMW）

### 4.1 为什么要用硬件原子指令
基于关中断的方案属于内核内部技巧，不适合直接暴露给用户级同步。在多处理器上，全局协调关中断代价高、实现复杂。

因此需要硬件提供原子读-改-写指令。

### 4.2 典型原语示例
常见 RMW 原语包括：

```c
// test&set(address): 返回旧 M[address]，并把 M[address] 原子设为 1

// swap(address, register): 原子交换内存与寄存器值

// compare&swap(address, reg1, reg2):
// 若 M[address] == reg1，则把 M[address] 设为 reg2 并返回成功；
// 否则内存不变并返回失败
```

### 4.3 最简单的 test-and-set 锁
```c
int value = 0; // FREE

Acquire() {
    while (test&set(value)); // 忙等直到不 BUSY
}

Release() {
    value = 0;
}
```

它简单、可用于多核，但等待线程会持续自旋。

### 4.4 忙等待的优缺点
- 优点：
  - 机器仍可响应中断。
  - 可用于用户态代码。
  - 可在多处理器上工作。
- 缺点：
  - 等待时持续消耗 CPU。
  - 自旋线程可能抢占持锁线程所需运行时间。
  - 高竞争下会加剧缓存一致性流量。

![忙等待与优先级反转](./lec08_materials/busy_wait_priority_inversion.png)

:::remark 问题：为什么忙等待会在“优先级反转”时导致“无进展”？
如果高优先级线程在自旋，而低优先级持锁线程被抢占，持锁线程得不到足够 CPU 去释放锁。结果是高优先级线程一直消耗 CPU，却永远拿不到锁。
:::

### 4.5 改进：test-and-set + guard + 阻塞队列
改进思路是引入短自旋保护变量 `guard`：
- 仅在获取 `guard` 的短窗口自旋。
- 若锁忙，则入队并睡眠。
- 若锁空闲，则置忙并释放 `guard`。
- 释放时若有等待者就唤醒，否则直接置空闲。

![test&set + guard 的改进锁](./lec08_materials/better_lock_test_and_set_guard.png)

这样忙等待被压缩到“保护锁元数据”的短路径。

## 5. 同步抽象栈与发展方向

同步机制是分层构建的：
- 硬件层（`load/store`、关中断、test&set、compare&swap）。
- 高层 API（locks、semaphores、monitors、send/receive）。
- 程序层共享数据协作。

![同步抽象分层](./lec08_materials/synchronization_abstraction_stack.png)

方向是：在可靠硬件原子支持上，提供更易用、更不易出错的高层抽象。

## 6. 从信号量到管程

### 6.1 为什么信号量还不够好
信号量很强大，但它把两类问题混在一起：
- 互斥控制，
- 调度等待。

双重职责会提高理解与证明成本。

### 6.2 管程定义
关键定义：

**Monitor: a lock and zero or more condition variables for managing concurrent access to shared data.**

中文理解：管程就是“一把锁 + 零个或多个条件变量”，用于管理并发访问共享数据。

### 6.3 条件变量定义与操作
另一个关键定义：

**Condition Variable: a queue of threads waiting for something inside a critical section.**

操作语义：
- `Wait(&lock)`：原子地释放锁并睡眠；返回前重新获取锁。
- `Signal()`：唤醒一个等待线程（如果存在）。
- `Broadcast()`：唤醒所有等待线程。

规则：
- 执行条件变量操作时必须持有关联锁。

![带条件变量的管程结构](./lec08_materials/monitor_with_condition_variables.png)

### 6.4 用条件变量实现同步队列
典型管程式队列逻辑：
- 生产者：加锁 -> 入队 -> `signal` 消费者条件变量 -> 解锁。
- 消费者：加锁 -> 当队列空时 `wait` -> 出队 -> 解锁。

关键点是“等待采用睡眠”，不是忙等待。

## 7. Mesa 与 Hoare 管程语义

### 7.1 为什么必须区分
考虑消费端逻辑：

```c
while (isEmpty(queue)) {
    cond_wait(&buf_CV, &buf_lock);
}
item = dequeue(queue);
```

为什么是 `while`，而不是 `if`？答案取决于调度语义。

### 7.2 Hoare 语义
Hoare 语义下：
- 发信号线程立即把锁和 CPU 交给等待线程。
- 等待线程立刻运行，条件仍然保证成立。

优点：
- 语义直观，推理干净。

代价：
- 上下文切换更多。
- 在真实系统里实现成本较高。

### 7.3 Mesa 语义
Mesa 语义下：
- 发信号线程继续持锁并继续执行。
- 等待线程仅被放入就绪队列，且无特殊优先级。
- 等等待线程真正运行时，条件可能已经再次不成立。

因此实际代码必须在唤醒后重新检查条件，也就是用 `while` 包裹 `cond_wait`。

![Mesa 管程调度语义](./lec08_materials/mesa_monitor_semantics.png)

:::remark 问题：为什么在多数真实系统中，`if (isEmpty) cond_wait(...)` 是不安全的？
因为多数系统使用 Mesa 风格。被唤醒只表示“条件可能成立过”，并不保证“你拿到 CPU 时条件仍成立”。在你恢复执行前，其他线程可能已把资源拿走，所以必须 `while` 重新检查。
:::

## 8. 用管程实现环形缓冲区（第三版）

管程版使用一把锁和两个条件变量：
- `producer_CV`：缓冲区满时，生产者在这里等待。
- `consumer_CV`：缓冲区空时，消费者在这里等待。

生产者流程：
1. 获取锁。
2. 缓冲区满则 `cond_wait(producer_CV, lock)`。
3. 入队。
4. `cond_signal(consumer_CV)`。
5. 释放锁。

消费者流程：
1. 获取锁。
2. 缓冲区空则 `cond_wait(consumer_CV, lock)`。
3. 出队。
4. `cond_signal(producer_CV)`。
5. 释放锁。

![管程版环形缓冲区第三版](./lec08_materials/circular_buffer_third_cut_monitors.png)

这个版本把职责拆分得很清楚：
- 锁负责互斥。
- 条件变量负责等待与唤醒。

## 9. 本讲核心结论
- **Atomic Operations** 是所有同步抽象的基础。
- 关中断可以保护短小的内核锁元数据操作，但不应作为通用用户级锁机制。
- 纯自旋锁实现简单，但会浪费 CPU，并可能触发优先级反转。
- 引入 `guard` 与阻塞队列可以把自旋窗口压缩到很短。
- 管程把“互斥”和“条件等待”分离，结构更清晰。
- 在 Mesa 风格系统里，条件等待必须写成 `while`，不能写成 `if`。

## 附录 A：Exam Review

### A.1 必背定义
- **Atomic Operation**：要么完整执行完成，要么完全不发生。
- **Monitor**：一把锁加上零个或多个条件变量，用于管理并发访问共享数据。
- **Condition Variable**：在临界区内等待某个条件的线程队列。

### A.2 对比清单
- 关中断锁：
  - 适合内核内部短元数据路径。
  - 不适合作为用户级通用原语。
- 朴素 test&set 锁：
  - 能保证互斥。
  - 高竞争下自旋代价高。
- guard + 阻塞队列锁：
  - 自旋窗口短。
  - 阻塞时进入睡眠。

### A.3 必会推理题
1. 为什么“开中断位置”会导致丢失唤醒？
2. 为什么多核环境会推动我们使用硬件 RMW 原语？
3. 为什么优先级反转会出现“无进展”？
4. 为什么 Mesa 语义必须 `while (condition) wait`？

### A.4 常见错误
- 长时间关中断。
- 误以为“被唤醒”就等于“条件一定仍成立”。
- 用一个同步变量承载多个独立约束。
- 忘记 `Wait` 必须“原子释放锁并睡眠”。

### A.5 快速实现模板（管程风格）
1. 获取管程锁。
2. 条件不满足则 `cond_wait`。
3. 修改共享状态。
4. 若状态变化可能解除他人阻塞，则 `signal/broadcast`。
5. 释放锁。
