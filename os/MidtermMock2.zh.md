# 期中考试模拟试题 2（Lec1-Lec13）

## 试卷说明

- 题型：简答题 10 题，大题 4 题。
- 本套更偏“具体接口、代码语义、状态模拟与数值计算”。
- 每题后给出折叠答案；建议先独立推演，再展开答案对照。

## 一、简答题

### 简答题 1：Base-and-Bound 的具体地址判断

某进程使用 Base-and-Bound 保护机制，`base = 0x4000`，`bound = 0x1000`，虚拟地址表示从 0 开始的 offset。请判断以下访问会发生什么：

1. 读虚拟地址 `0x0ff0`。
2. 写虚拟地址 `0x1000`。
3. 用户态执行一条只能在内核态执行的特权指令。
4. 用户态执行一次合法 `syscall`。

:::tip 答案与解析
1. `0x0ff0 < bound`，访问合法，物理地址为 `0x4000 + 0x0ff0 = 0x4ff0`。
2. `0x1000` 等于 `bound`，若 `bound` 表示合法 offset 的长度/上界，则合法范围是 `[0, 0x1000)`，因此该访问越界，硬件 trap 到内核。
3. 用户态执行特权指令会触发 trap/exception，因为硬件模式位禁止用户态执行该类操作。
4. 合法 `syscall` 是受控的 user-to-kernel 转移：硬件保存必要用户态状态，根据 syscall/trap 编号进入内核向量表指定入口，内核处理后再受控返回用户态。

关键点是：保护不能只靠软件约定，必须由硬件在每次地址翻译、特权指令执行和模式切换处强制检查。
:::

### 简答题 2：`pthread_join` 与线程退出顺序

考虑如下伪代码：

```c
pthread_create(&t1, NULL, f, "A");
pthread_create(&t2, NULL, f, "B");
pthread_join(t2, NULL);
pthread_join(t1, NULL);
printf("main done\n");
```

若 `t1` 比 `t2` 更早执行完，主线程会不会先从 `pthread_join(t2)` 返回？`f` 函数直接 `return NULL` 与调用 `pthread_exit(NULL)` 在语义上有什么关系？

:::tip 答案与解析
主线程不会因为 `t1` 已完成而从 `pthread_join(t2)` 返回。`pthread_join(t2, ...)` 等待的是指定目标线程 `t2`，即使其他线程已经结束，也不会改变这个等待目标。因此主线程必须等 `t2` 结束后才继续执行下一句 `pthread_join(t1, ...)`；此时如果 `t1` 已经结束，第二个 join 会很快返回。

线程入口函数 `f` 直接返回，通常等价于对该线程执行隐式 `pthread_exit(return_value)`。也就是说，`start_routine` 的返回值可被 join 方作为线程退出值取得。
:::

### 简答题 3：`fork` 后输出的偏序

假设下面代码使用 `write`，不考虑 `printf` 缓冲：

```c
write(1, "A", 1);
pid_t pid = fork();
if (pid == 0) {
    write(1, "B", 1);
} else {
    write(1, "C", 1);
    wait(NULL);
    write(1, "D", 1);
}
write(1, "E", 1);
```

请列出可能的输出顺序，并说明哪些偏序关系一定成立。

:::tip 答案与解析
`A` 一定最先输出，因为它发生在 `fork` 前。子进程中 `B` 一定先于子进程的 `E`。父进程中 `C` 一定先于 `wait` 后的 `D`，`D` 一定先于父进程最后的 `E`。由于父进程在输出 `D` 前 `wait(NULL)`，子进程必须已经结束，所以子进程的 `B` 和 `E` 都一定先于父进程的 `D`。

`C` 与子进程的 `B/E` 之间没有固定顺序，除非父进程已经执行到 `wait`。因此可能输出包括：

```text
ACBEDE
ABCEDE
ABECDE
```

若改用未刷新且无换行的 `printf("A")`，则还要额外考虑 stdio 缓冲在 `fork` 时被复制，可能出现重复 `A`。本题用 `write` 是为了排除这个缓冲干扰。
:::

### 简答题 4：`dup` 共享 offset 的具体推演

文件 `foo.txt` 内容为 `abcdef`。忽略错误处理，执行：

```c
int fd = open("foo.txt", O_RDONLY);
char a[3] = {0}, b[3] = {0};
read(fd, a, 2);
int fd2 = dup(fd);
read(fd2, b, 2);
lseek(fd, 0, SEEK_SET);
read(fd2, a, 1);
```

最终 `a`、`b` 中的可见字符串分别是什么？为什么？

:::tip 答案与解析
第一次 `read(fd, a, 2)` 读到 `"ab"`，共享 open file description 的 offset 从 0 变为 2。`dup(fd)` 创建新的 fd 表项 `fd2`，但它与 `fd` 指向同一个 open file description，因此共享 offset。`read(fd2, b, 2)` 从 offset 2 读，得到 `"cd"`，offset 变为 4。

随后 `lseek(fd, 0, SEEK_SET)` 修改的是同一个 open file description 的 offset，所以 `fd2` 看到的 offset 也被重置为 0。最后 `read(fd2, a, 1)` 读到 `"a"`，覆盖 `a[0]`，但 `a[1]` 原来仍是 `'b'`，`a[2]` 是 `'\0'`。

因此作为 C 字符串看，`a` 是 `"ab"`，`b` 是 `"cd"`。若只看最后一次 `read` 写入的新字节，它写入的是 `a[0] = 'a'`。
:::

### 简答题 5：pipe 的 EOF 与 `SIGPIPE`

父进程创建 pipe 后 fork 一个子进程。子进程只读，父进程只写。请回答：

1. 父进程和子进程各自应关闭哪个端点？
2. 若父进程写完并关闭写端，子进程何时看到 EOF？
3. 若子进程提前退出并关闭了最后一个读端，父进程继续写会发生什么？

:::tip 答案与解析
父写子读时，父进程应关闭读端 `pipefd[0]`，保留写端 `pipefd[1]`；子进程应关闭写端 `pipefd[1]`，保留读端 `pipefd[0]`。

只有当引用该 pipe 的所有写端描述符都关闭后，读端才会看到 EOF。若父进程关闭自己的写端，但子进程或其他继承者还意外保留着写端，子进程读端可能继续阻塞而不是返回 EOF。

若所有读端都关闭，父进程继续 `write` 会触发 `SIGPIPE`；如果该信号被忽略或捕获，`write` 通常返回失败并设置 `EPIPE`。
:::

### 简答题 6：`accept` 返回的是哪个 socket？

一个 TCP 服务端执行 `socket -> bind -> listen` 后，在循环里调用 `accept`。请解释 listening socket 和 connection socket 的区别。为什么每连接一进程模型中，父进程和子进程通常要关闭不同的 socket fd？如果父进程在循环里立刻 `wait(NULL)`，并发性会怎样变化？

:::tip 答案与解析
listening socket 是绑定到本地 host/port、负责排队新连接请求的端点；`accept` 返回的是一个新的 connection socket，用于和某个具体客户端通信。监听 socket 继续保留，用于接受后续连接。

每连接一进程模型中，`fork` 后父子都会继承 listening socket 和 connection socket。通常父进程关闭 connection socket，回到 `accept` 接收新连接；子进程关闭 listening socket，只保留 connection socket 服务当前客户端。这样能避免 fd 泄漏和连接生命周期混乱。

如果父进程在循环中立刻 `wait(NULL)`，它会等待当前子进程服务完再继续 `accept`，行为接近串行服务器；去掉阻塞式 wait 或用异步回收子进程，才能实现多个连接并发处理。
:::

### 简答题 7：关中断锁为什么不能直接暴露给用户态？

某同学提出用户级锁：

```c
Acquire() { disable_interrupts(); }
Release() { enable_interrupts(); }
```

请指出至少三点问题。内核里“短暂关中断保护锁元数据”为什么又是可接受的？

:::tip 答案与解析
这个用户级锁有多重问题：
- 用户态不能被允许执行全局关中断，否则恶意或出错程序可以阻止时钟、I/O 和内核抢占。
- 临界区若很长，会延迟设备事件和定时器，破坏响应性与实时性。
- 在多处理器上，关掉当前 CPU 的中断不能阻止其他 CPU 并发访问共享内存。
- 若线程忘记释放或崩溃，系统可能长期失去抢占能力。

内核里短暂关中断保护锁元数据是另一回事：它只包住“检查锁状态、修改状态、入等待队列”等很短的关键窗口，不覆盖用户临界区。这样能在单处理器内核路径上保证原子性，同时把对系统响应性的影响压到很小。
:::

### 简答题 8：条件变量的错误用法

下面消费者代码有什么问题？

```c
lock(&m);
if (count == 0) {
    cond_wait(&notEmpty, &m);
}
item = dequeue();
unlock(&m);
```

请从 Mesa 语义、spurious wakeup 或错误唤醒角度解释。

:::tip 答案与解析
问题是使用了 `if` 而不是 `while`。在 Mesa 管程语义中，`cond_signal` 只是把等待线程放入 ready queue，发信号者继续执行；等待线程真正醒来并重新获得锁时，条件可能已经被其他线程改变。即使没有真正的逻辑竞争，真实系统也可能存在 spurious wakeup，或者单条件变量下唤醒了错误类型线程。

正确写法应当是：

```c
lock(&m);
while (count == 0) {
    cond_wait(&notEmpty, &m);
}
item = dequeue();
unlock(&m);
```

条件变量等待的核心纪律是：等待前后都在同一把锁保护下检查谓词；醒来只表示“也许可以继续”，不表示条件必然成立。
:::

### 简答题 9：CFS 加权时间片计算

Linux CFS 中，假设 `TargetLatency = 24ms`，系统中只有两个 CPU-bound 任务：任务 A 的 `nice = 0`，任务 B 的 `nice = 5`。使用近似公式：

$$
\text{Weight}=\frac{1024}{(1.25)^{\text{nice}}}
$$

请估算两者在一个 target latency 窗口内的时间片比例与时间片长度。

:::tip 答案与解析
任务 A 的权重为：

$$
w_A = 1024
$$

任务 B 的权重为：

$$
w_B = \frac{1024}{1.25^5} \approx \frac{1024}{3.052} \approx 335.5
$$

总权重约为 `1359.5`。因此：

$$
Q_A \approx \frac{1024}{1359.5}\times 24ms \approx 18.1ms
$$

$$
Q_B \approx \frac{335.5}{1359.5}\times 24ms \approx 5.9ms
$$

比例约为 `3.05 : 1`。`nice` 越低，权重越高，获得的 CPU 份额越大；`nice` 相差 5 大约带来 3 倍权重差。
:::

### 简答题 10：死锁检测算法的一步推演

系统有两类资源，当前：

```text
Avail = [1, 0]
T1: Alloc = [1, 0], Request = [0, 1]
T2: Alloc = [0, 1], Request = [1, 0]
```

请运行向量化死锁检测算法，判断是否死锁。若把 `Avail` 改成 `[0, 0]`，结论是否变化？

:::tip 答案与解析
当 `Avail = [1, 0]` 时，`T2` 的请求 `[1,0] <= [1,0]`，所以可以模拟 `T2` 完成并释放资源，`Avail` 变为 `[1,0] + [0,1] = [1,1]`。此时 `T1` 的请求 `[0,1] <= [1,1]`，也可以完成。因此不存在死锁。

若 `Avail = [0,0]`，`T1` 需要 `[0,1]`，`T2` 需要 `[1,0]`，二者请求都不能被满足，算法无法找到任何可完成线程，`UNFINISHED` 非空，因此检测到死锁。

这也说明多实例资源下不能只看“图里有没有环”，还要看当前可用实例是否允许某个线程先完成并释放资源。
:::

## 二、大题

### 大题 1：`fork`、共享 offset 与输出顺序

文件 `data.txt` 内容为 `abcdef\n`。忽略所有错误处理，并假设 `write(1, ..., 2)` 原子输出 2 字节。

```c
int fd = open("data.txt", O_RDONLY);
char buf[3] = {0};

read(fd, buf, 2);          // R0
pid_t pid = fork();

if (pid == 0) {
    read(fd, buf, 2);      // R1
    write(1, buf, 2);      // W1
    _exit(0);
} else {
    wait(NULL);
    read(fd, buf, 2);      // R2
    write(1, buf, 2);      // W2
}
```

请回答：

1. `R0`、`R1`、`R2` 分别读到什么？
2. 为什么父子进程会共享 offset？
3. 程序最终输出什么？若去掉 `wait(NULL)`，输出和读到的内容可能如何变化？
4. 如果希望父子各自从文件开头独立读取，应该怎么改？
5. 如果 `fd` 在 `fork` 前用 `fdopen` 包成 `FILE*`，再混合使用 `fread` 与 `read`，会增加什么推理风险？

:::tip 答案与解析
1. `R0` 在 `fork` 前执行，读到 `"ab"`，open file description 的 offset 变为 2。`fork` 后父子 fd 表项都指向同一个 open file description。由于父进程 `wait(NULL)`，子进程先执行 `R1`，从 offset 2 读到 `"cd"`，offset 变为 4。父进程随后执行 `R2`，从 offset 4 读到 `"ef"`，offset 变为 6。

2. `fork` 复制的是 fd 表，但 fd 表项仍别名到同一个内核 open file description。offset 存在 open file description 中，而不是单独存在每个 fd 变量中，因此父子共享 offset。

3. 有 `wait(NULL)` 时，子进程先输出 `"cd"`，父进程后输出 `"ef"`，最终输出为：

```text
cdef
```

若去掉 `wait(NULL)`，父子会并发执行 `R1/R2`。由于共享 offset，两次读取仍会分别拿到 `"cd"` 和 `"ef"`，但哪个进程先读、哪个输出先发生不确定，可能输出 `"cdef"` 或 `"efcd"`。

4. 若希望父子独立读取，应在 `fork` 后分别重新 `open("data.txt", O_RDONLY)`，让父子拥有不同 open file description；或者在每次读取前显式 `lseek` 到目标位置，但这仍会在共享 open file description 上互相影响，需要额外同步。

5. `FILE*` 增加用户态缓冲。`fread` 可能一次从 fd 预取更多字节到流缓冲区，使底层 fd 的 offset 前进超过应用看到的字节数。随后直接 `read(fd, ...)` 会从底层 offset 继续读，和你以为的 `FILE*` 逻辑位置可能不一致。因此混用高层流与低层 fd 会让 offset、缓冲可见性和顺序推理显著复杂化。
:::

### 大题 2：审查有界缓冲区同步代码

某同学写了如下有界缓冲区代码，`N` 为缓冲区大小：

```c
Semaphore full = 0;
Semaphore empty = N;
Semaphore mutex = 1;

void put(Item x) {
    P(&mutex);
    P(&empty);
    enqueue(x);
    V(&full);
    V(&mutex);
}

Item get(void) {
    P(&mutex);
    P(&full);
    Item x = dequeue();
    V(&empty);
    V(&mutex);
    return x;
}
```

后来他又改写成管程版本：

```c
Item get(void) {
    lock(&m);
    if (count == 0) {
        cond_wait(&notEmpty, &m);
    }
    Item x = dequeue();
    count--;
    cond_signal(&notFull);
    unlock(&m);
    return x;
}
```

请回答：

1. 信号量版本在什么状态下会卡住？给出一个具体执行过程。
2. 正确的信号量 `P/V` 顺序是什么？为什么 `P` 顺序比 `V` 顺序更影响安全性？
3. 管程版本为什么在 Mesa 语义下不安全？给出一个涉及两个消费者的可能场景。
4. 若只有一个条件变量 `okContinue`，什么时候需要 `broadcast` 而不是 `signal`？
5. 如果该缓冲区用于网络服务器线程池，请说明 master/worker 分别对应生产者还是消费者，以及线程池相对“每连接一线程”的收益。

:::tip 答案与解析
1. 信号量版本的问题是先拿 `mutex`，再等待资源计数。若缓冲区已满，生产者执行 `P(&mutex)` 成功，然后执行 `P(&empty)` 时阻塞。此时消费者本来可以取走元素并 `V(&empty)`，但消费者进入 `get` 的第一步也是 `P(&mutex)`，它拿不到 `mutex`，所以无法推进条件。系统卡住。缓冲区为空时，消费者先拿 `mutex` 再阻塞在 `P(&full)` 也会造成对称问题。

2. 正确顺序是：

```c
put: P(empty) -> P(mutex) -> enqueue -> V(mutex) -> V(full)
get: P(full)  -> P(mutex) -> dequeue -> V(mutex) -> V(empty)
```

资源可用性约束必须在进入临界区前等待，互斥锁只保护实际队列状态修改。`P` 顺序错会让线程“持锁睡眠”，阻止其他线程改变条件，因此影响安全性和进展；`V` 顺序通常不会破坏互斥安全，但会影响唤醒时机、调度效率和缓存局部性。

3. 管程版本用 `if` 不安全。场景：两个消费者 `C1`、`C2` 在 `notEmpty` 上等待；生产者放入一个元素后 `broadcast` 或错误地唤醒多个消费者。`C1` 醒来先拿锁，取走唯一元素，`count` 变回 0；`C2` 随后醒来并从 `cond_wait` 返回。如果代码用 `if`，`C2` 不会重新检查 `count == 0`，会直接 `dequeue` 空缓冲区。正确写法必须用 `while (count == 0) cond_wait(...)`。

4. 单条件变量混合了生产者和消费者，`signal` 可能唤醒错误类型线程。例如缓冲区满时，多个生产者和消费者都可能等待在同一个 `okContinue` 上；状态变化后若只唤醒一个仍无法推进的生产者，真正能推进的消费者可能继续睡眠。此时常用 `broadcast`，让所有等待者重新检查自己的谓词。代价是惊群和更多上下文切换。

5. 线程池中 master 线程负责 `accept` 新连接并把连接任务放入队列，是生产者；worker 线程从队列取任务处理，是消费者。线程池限制并发线程数量，避免每连接一线程在高连接数下造成内存、调度和同步开销失控，同时保留一定并发处理能力。
:::

### 大题 3：调度手算、CFS 与死锁检测

单 CPU 系统有三个作业：

| 作业 | 到达时间 | CPU burst |
| --- | ---: | ---: |
| J1 | 0 | 8 |
| J2 | 1 | 4 |
| J3 | 2 | 1 |

RR 时间片 `q=2`，同一时刻“新到达作业先入队，再把用完时间片的当前作业放到队尾”，忽略上下文切换成本。

另有一个两资源系统：

```text
Case A:
Avail = [0, 0]
T1: Alloc = [1, 0], Request = [0, 1]
T2: Alloc = [0, 1], Request = [1, 0]

Case B:
Avail = [1, 0]
T1: Alloc = [1, 0], Request = [0, 1]
T2: Alloc = [0, 1], Request = [1, 0]
```

请回答：

1. 计算 FCFS、SRTF、RR 下每个作业的完成时间、等待时间和平均完成时间。
2. 哪个策略对平均完成时间最好？哪个策略对响应/等待公平更友好？为什么这两者不总一致？
3. 如果系统改用 CFS，`TargetLatency` 很小且可运行任务数很多，为什么还需要 minimum granularity？
4. 对 Case A 和 Case B 运行死锁检测算法，分别给出结论。
5. 若 Case A 中允许抢占一个资源或终止一个线程，这属于 deadlock prevention、avoidance 还是 recovery？代价是什么？

:::tip 答案与解析
1. **FCFS**：执行 `J1:0-8, J2:8-12, J3:12-13`。完成时间 `J1=8,J2=12,J3=13`。周转时间分别为 `8,11,11`。等待时间为周转时间减 burst，即 `J1=0,J2=7,J3=10`。平均完成/周转时间为 `(8+11+11)/3 = 10`。

**SRTF**：`J1` 先在 `0-1` 运行；`J2` 到达后剩余 4 小于 `J1` 的 7，抢占；`J3` 在 `t=2` 到达，剩余 1 最短，执行 `2-3` 完成；再执行 `J2:3-6`；最后 `J1:6-13`。完成时间 `J1=13,J2=6,J3=3`。周转时间 `13,5,1`，等待时间 `5,1,0`。平均完成/周转时间为 `19/3 ≈ 6.33`。

**RR q=2**：按题目队列规则，执行序列为 `J1:0-2, J2:2-4, J3:4-5, J1:5-7, J2:7-9, J1:9-11, J1:11-13`。完成时间 `J1=13,J2=9,J3=5`。周转时间 `13,8,3`，等待时间 `5,4,2`。平均完成/周转时间为 `8`。

2. 在这个负载下，SRTF 平均完成时间最好，因为它让短作业尽早完成，避免被长作业压在后面。RR 的平均完成时间不如 SRTF，但它让作业轮流获得 CPU，等待更均匀，响应性更好。平均完成时间与等待公平不总一致：偏向短作业能降低平均值，却可能让长作业饥饿；轮转能改善公平，却可能拖慢所有长作业的完成。

3. CFS 希望在 `TargetLatency` 内让每个任务都获得服务。若可运行任务很多，简单等分会得到极小时间片，导致上下文切换开销和缓存/TLB 扰动过高。minimum granularity 给单次运行时间设下界，避免系统把大量时间花在切换上。

4. Case A 中 `Avail=[0,0]`，`T1` 请求 `[0,1]` 不满足，`T2` 请求 `[1,0]` 也不满足，无法找到可完成线程，检测为死锁。Case B 中 `Avail=[1,0]`，`T2` 请求 `[1,0]` 可满足，模拟 `T2` 完成释放 `[0,1]` 后 `Avail=[1,1]`，再满足 `T1` 请求。因此 Case B 无死锁。

5. 允许死锁发生后再抢占资源或终止线程，属于 **deadlock recovery**。代价是可能破坏共享状态一致性，终止线程可能丢失工作或留下部分更新；抢占某些资源在语义上不可行；若没有改变策略，恢复后系统还可能再次进入同类死锁。
:::

### 大题 4：现代调度系统的数值与机制推理

某云平台包含微秒级 RPC 服务、GPU 训练集群、多资源作业调度器和共享缓存。请回答：

1. 一个 RPC 请求在 home core 收到后，ZygOS 允许 remote core steal 并执行业务逻辑。若 remote core 需要发送 TCP 响应，为什么要通过 remote syscall 回到 home core？这保留了什么低开销性质，又补上了什么调度性质？
2. Tiresias 中有三个训练作业：`A: 4 GPU, 已运行 20 min`，`B: 8 GPU, 已运行 5 min`，`C: 1 GPU, 已运行 60 min`。按 2DAS 从小到大排序。若 A 是通信密集模型，C 是通信不敏感模型，放置策略应如何不同？
3. DRF 场景：总资源 `<18 CPU, 18 GB>`；用户 1 每任务需求 `<2 CPU, 1 GB>`，用户 2 每任务需求 `<1 CPU, 3 GB>`。计算 DRF 分配的任务数。
4. FairRide 场景：文件 X/Y/Z 大小都为 1，总缓存为 2。User 1 真实访问 `X=6,Y=6`，User 2 真实访问 `X=6,Z=6`。诚实时共享缓存 X，Y/Z 各缓存一半。若 User 2 作弊让 Z 完整缓存，并继续搭便车访问 X，普通 max-min 和 FairRide 下 User 2 的真实命中分别是多少？
5. 为什么 CEEI、DRF、FairRide 都是在讨论“公平”，但关注点并不相同？

:::tip 答案与解析
1. ZygOS 的网络处理路径希望保持 share-nothing dataplane：连接状态和 TCP/IP 发送路径尽量留在 home core，减少跨核共享状态和同步开销。remote core steal 工作后可以执行业务逻辑，从而让空闲核心参与处理，补上 work-conserving 和负载均衡性质；但当它需要访问 home core 的网络连接状态并发送响应时，通过 remote syscall 让 home core 完成对应系统调用和 TCP/IP 发送。这样同时保留低开销网络路径与接近单队列的调度行为。

2. 2DAS 为 `#GPU * executed time`：

```text
A = 4 * 20 = 80 GPU-min
B = 8 * 5  = 40 GPU-min
C = 1 * 60 = 60 GPU-min
```

从小到大排序为 `B, C, A`。这说明只看已运行时间会误判：C 虽然跑了 60 分钟，但只占 1 张 GPU；B 只跑 5 分钟，却已经占了 40 GPU-min。

放置上，通信密集的 A 更适合 consolidation，让多个 GPU 尽量靠近以减少同步和网络开销；通信不敏感的 C 可以更分散放置，以减少 GPU 碎片和排队延迟。Tiresias 的重点是不采用“一刀切”聚合，而是用 model profile 决定放置。

3. 用户 1 的 dominant resource 是 CPU，dominant share 为 `2x/18 = x/9`；用户 2 的 dominant resource 是 memory，dominant share 为 `3y/18 = y/6`。DRF 令二者相等：

$$
\frac{x}{9}=\frac{y}{6}\Rightarrow 2x=3y\Rightarrow x=1.5y
$$

资源约束：

$$
2x+y\le18,\qquad x+3y\le18
$$

代入 `x=1.5y` 得：

$$
4y\le18,\qquad 4.5y\le18
$$

第二个约束更紧，所以 `y=4`，`x=6`。分配为用户 1 运行 6 个任务、用户 2 运行 4 个任务。用户 1 分得 `<12 CPU, 6 GB>`，CPU dominant share 为 `12/18=2/3`；用户 2 分得 `<4 CPU, 12 GB>`，memory dominant share 为 `12/18=2/3`。

4. 诚实时，User 2 的命中为 `X:6*1 + Z:6*0.5 = 9 hits/s`。若 User 2 作弊使 Z 完整缓存，并且普通 max-min 不阻断搭便车访问 X，则 User 2 真实命中为：

```text
X: 6 + Z: 6 = 12 hits/s
```

作弊有利。

FairRide 中，User 2 访问 X 但不是 X 的缓存付费者；若 X 由 User 1 缓存，`n_X=1`，阻断概率 `p=1/(1+1)=1/2`，允许概率也是 `1/2`。因此 User 2 对 X 的期望命中贡献变为 `6*1/2=3`，Z 的贡献为 6，总命中：

```text
3 + 6 = 9 hits/s
```

等于诚实时收益，作弊不再带来收益。

5. CEEI 用“等收入竞争均衡”表达公平，关注市场式资源交易和效率，但可能被策略性申报操纵。DRF 面向多资源作业，关注 dominant share、share guarantee、strategy-proofness 和 Pareto efficiency 的组合。FairRide 面向共享缓存，用户可能通过虚假访问改变缓存状态，所以它把公平问题转化为机制设计：保留 isolation guarantee 与 strategy-proofness，同时接受 near-optimal 而非完全 Pareto efficiency。
:::
