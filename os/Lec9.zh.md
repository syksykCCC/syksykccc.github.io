# Lec9 - 同步 4：读者/写者与管程设计权衡

## 学习目标
学完本讲后，你应当能够解释为什么读者/写者问题不能只靠一把全局锁，能够基于状态变量跟踪管程实现的执行过程，能够分析饥饿与唤醒策略的权衡，并能够比较 C/C++/Python/Java 中的管程式同步支持。

## 1. 为什么读者/写者需要专门策略

共享数据库通常包含两类操作：
- **读者（Readers）** 只读取数据，不修改数据。
- **写者（Writers）** 会读取并修改数据。

![读者/写者问题动机](./lec09_materials/readers_writers_motivation.png)

对整个数据库使用一把粗粒度锁虽然正确，但通常过于保守。它会把读者之间也串行化，而在没有写者时，多个读者本来可以安全并发。

## 2. 正确性约束与共享状态

该管程解法建立在三个核心约束之上：
- **Readers can access database when no writers.**
- **Writers can access database when no readers or writers.**
- **Only one thread manipulates state variables at a time.**

![约束与状态变量](./lec09_materials/readers_writers_constraints_and_state.png)

管程内部维护的状态如下：

| 变量 | 含义 | 初始值 |
| --- | --- | --- |
| `AR` | 活跃读者数量 | `0` |
| `WR` | 等待读者数量 | `0` |
| `AW` | 活跃写者数量 | `0` |
| `WW` | 等待写者数量 | `0` |
| `okToRead` | 读者条件变量 | 空 |
| `okToWrite` | 写者条件变量 | 空 |

## 3. Reader 过程（写者优先的入口规则）

读者入口逻辑：
1. 获取管程锁。
2. 当 `(AW + WW) > 0` 时，先把 `WR` 加一，再在 `okToRead` 上睡眠。
3. 被唤醒后，`WR` 减一，`AR` 加一，然后释放锁。
4. 在锁外执行只读数据库访问。

读者退出逻辑：
1. 重新获取锁并执行 `AR--`。
2. 若 `AR == 0 && WW > 0`，唤醒一个写者。
3. 释放锁。

![Reader 管程代码](./lec09_materials/reader_monitor_code.png)

条件 `(AW + WW) > 0` 的含义是：读者不仅在“有活跃写者”时阻塞，也会在“已有写者等待”时阻塞。这是一个有意设计的写者优先策略。

## 4. Writer 过程（受控交接）

写者入口逻辑：
1. 获取锁。
2. 当 `(AW + AR) > 0` 时，`WW++` 并在 `okToWrite` 上等待。
3. 被唤醒后，`WW--`，`AW++`，然后释放锁。
4. 在锁外执行读写数据库访问。

写者退出逻辑：
1. 重新获取锁并执行 `AW--`。
2. 若 `WW > 0`，优先唤醒一个写者。
3. 否则若 `WR > 0`，广播唤醒读者。
4. 释放锁。

![Writer 管程代码](./lec09_materials/writer_monitor_code.png)

这个唤醒顺序会在写者排队时持续给写者优先权。

## 5. 过程视角：`R1, R2, W1, R3` 的状态变化

![两个读者并发后写者到达](./lec09_materials/simulation_two_readers_active.png)

下表给出这段执行中最关键的状态迁移：

| 步骤 | 事件 | `AR` | `WR` | `AW` | `WW` |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | 初始状态 | 0 | 0 | 0 | 0 |
| 2 | `R1` 进入并开始读取 | 1 | 0 | 0 | 0 |
| 3 | `R2` 进入并开始读取 | 2 | 0 | 0 | 0 |
| 4 | `W1` 到达，无法进入，开始等待 | 2 | 0 | 0 | 1 |
| 5 | `R3` 到达，被等待写者阻塞 | 2 | 1 | 0 | 1 |
| 6 | `R2` 退出 | 1 | 1 | 0 | 1 |
| 7 | `R1` 退出，最后一个读者唤醒写者 | 0 | 1 | 0 | 1 |
| 8 | `W1` 被唤醒并开始写入（`WW--`, `AW++`） | 0 | 1 | 1 | 0 |
| 9 | `W1` 退出并广播读者 | 0 | 1 | 0 | 0 |
| 10 | `R3` 被唤醒并开始读取（`WR--`, `AR++`） | 1 | 0 | 0 | 0 |
| 11 | `R3` 退出 | 0 | 0 | 0 | 0 |

这里最重要的过程性结论是：准入规则会动态变化。一旦出现等待写者，后续新到读者即使面对“当前仍有读者在读”的状态，也不再继续放行。

## 6. 关键问题与解答

![课堂讨论问题](./lec09_materials/readers_writers_discussion_questions.png)

- **问题：在该策略下，读者会不会饥饿？**

:::remark 解答
会。这个实现是写者优先。只要写者持续到达，`WW` 长期大于零，新来的读者就会一直被挡在写者队列之后，等待时间可能无上界。
:::

- **问题：如果把读者退出改成无条件 `AR--; cond_signal(&okToWrite);` 会怎样？**

:::remark 解答
通常仍能保持正确性，因为写者侧还有 `while ((AW + AR) > 0)` 的二次检查；但效率明显变差。即使 `AR > 0` 也会反复唤醒写者，导致无效唤醒和额外上下文切换。
:::

- **问题：如果再把这个 signal 改成 broadcast 给写者，会怎样？**

:::remark 解答
会产生“惊群效应”。大量写者被同时唤醒，竞争同一把锁后又发现条件不满足再睡回去，吞吐与缓存局部性都会变差。
:::

- **问题：如果读者和写者共用一个条件变量（`okContinue`）会怎样？**

![单条件变量错误唤醒场景](./lec09_materials/single_cv_wrong_wakeup_scenario.png)

:::remark 解答
共用一个条件变量时，`signal()` 可能唤醒“错误类型”的线程（读者或写者）。在 `R1` 活跃、`W1` 与 `R2` 同时等待的场景下，如果 `R1` 只唤醒了 `R2`，`R2` 可能再次判断失败并继续睡眠，而 `W1` 仍在睡眠，系统推进就会受阻。实践中应改为 `broadcast()`，让所有等待者都重新检查谓词。
:::

## 7. 单条件变量与双条件变量的权衡

使用一个条件变量（`okContinue`）是可行的，但代价很明确：

- 收益：
  - 接口更简单，条件对象更少。
- 代价：
  - 唤醒精度降低。
  - 更依赖 `broadcast()`。
  - 高竞争下唤醒开销更大。

使用两个条件变量（`okToRead`, `okToWrite`）可以做更精准的定向唤醒，性能行为也更可控。

## 8. 能否用信号量构造管程？

![条件变量与信号量的历史语义差异](./lec09_materials/condition_variables_vs_semaphores_history.png)

用互斥锁实现“锁”部分并不难，但条件变量语义非常微妙。

核心区别是：
- **Condition variables have no history, semaphores have history.**

这会带来直接后果：
- 条件变量在“无人等待”时 `signal` 是 no-op，后续 `wait` 仍会阻塞。
- 信号量在“无人等待”时 `V` 会累加计数，后续 `P` 可能直接通过。

朴素构造还会遇到其他问题：
- `P`/`V` 是可交换（commutative）的，但条件变量行为不是。
- 直接窥探信号量等待队列不符合抽象边界。
- 在释放锁与真正执行 `P()` 阻塞之间存在竞态窗口。

理论上可以正确构造，但复杂度显著高于直接使用管程原语。

## 9. 语言级支持模式

### 9.1 C：直接但容易遗漏解锁
在 C 中手工 acquire/release 虽然直接，但前提是你覆盖了所有退出路径。非局部控制流（`setjmp/longjmp`）可能跳过 release，造成锁泄漏。

使用 cleanup label（`goto`）可以集中处理解锁逻辑，但本质仍然依赖人工纪律。

### 9.2 C++：异常路径需要结构化清理
如果持锁期间抛出异常，手工释放很容易被跳过，除非每条路径都严格包裹。

`std::lock_guard<std::mutex>` 通过 RAII 解决这个问题：作用域结束即自动释放锁，异常路径同样安全。

![C++ lock_guard RAII](./lec09_materials/cpp_lock_guard_raii.png)

### 9.3 Python：`with lock` 提供作用域释放
在 Python 中，`with lock:` 进入块时自动 acquire，离开块时自动 release，不论是正常返回还是异常离开。

### 9.4 Java：内建管程原语
`synchronized` 方法在入口自动获取对象锁，在出口自动释放对象锁，异常出口同样会正确释放。

Java 在同步区域中常用的管程相关操作是：
- `wait()` / `wait(long timeout)`
- `notify()` / `notifyAll()`

![Java synchronized 示例](./lec09_materials/java_synchronized_example.png)

## 10. 超越单机：Chubby 锁服务

![Chubby 锁服务概览](./lec09_materials/chubby_lock_service_overview.png)

在松耦合分布式系统中，锁管理往往上移到专用服务层（例如 Chubby，以及后续类似 ZooKeeper/etcd 的系统）。其设计重点是粗粒度协作，以及高可用与高可靠。

## 11. 本讲核心结论

- **管程本质是“一把锁 + 一个或多个条件变量”。**
- 读者/写者正确性依赖明确的准入策略，而不只是“有互斥锁”。
- 写者优先可以改善写者时延，但可能导致读者饥饿。
- `signal` 与 `broadcast` 的选择同时影响性能和推进性，尤其在混合等待者场景下。
- 条件变量语义不能被朴素的信号量 `P/V` 包装直接替代。
- 作用域化的锁管理（RAII / `with` / `synchronized`）通常比手工解锁更安全。

## 附录 A：Exam Review

### A.1 必背定义
- **Readers can access database when no writers.**
- **Writers can access database when no readers or writers.**
- **Monitor: a lock plus one or more condition variables.**
- **Condition Variable: a queue of threads waiting for something inside a critical section.**

### A.2 简答题模板
1. 为什么这里读者会饥饿？
   - 因为入口条件 `AW + WW > 0` 会在“存在等待写者”时阻塞所有新读者。
2. 为什么单条件变量设计常常需要 `broadcast()`？
   - 因为一次 `signal()` 可能唤醒仍无法前进的线程类型。
3. 为什么条件变量不等价于信号量？
   - 因为条件变量唤醒不保留历史，而信号量计数会保留历史。

### A.3 过程追踪检查清单
追踪读者/写者执行时，至少同时跟踪：
- 当前是谁持锁、谁刚释放锁。
- 每次等待前检查的谓词（`AW+WW` 或 `AW+AR`）。
- 线程睡眠前后 `AR/WR/AW/WW` 的精确更新。
- 本次唤醒是 `signal` 还是 `broadcast`，目标线程类别是否匹配。

### A.4 常见错误
- 忘记该策略会在“有等待写者”时阻塞新读者。
- 在条件等待处用 `if` 替代 `while`。
- 不必要地广播唤醒过多线程。
- 误以为窥探信号量队列是安全的管程实现方法。