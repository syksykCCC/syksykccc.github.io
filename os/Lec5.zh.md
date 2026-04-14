# Lec5 - 抽象 3：IPC、Pipe 与 Socket

## 学习目标
学完本讲后，你应当能够解释为什么在进程隔离下仍然需要 IPC，正确使用 POSIX pipe（含 EOF/SIGPIPE 边界情形），精确定义协议的语法与语义，把 socket 视为“类文件端点”来建模，描述 TCP 建连（`listen`/`accept`），并比较串行、进程并发、线程并发与线程池服务器设计。

## 1. 为什么需要 IPC

### 1.1 隔离必须有，通信也必须有
进程抽象故意做隔离来保证保护性，但真实任务常常需要协作。
- 生产者进程可能要把数据交给消费者进程。
- 客户端与服务器进程必须交换请求与响应。

因此系统提供 **Interprocess Communication (IPC)**，用受控方式在隔离边界上“开孔”。

![IPC 与 socket 核心思想](./lec05_materials/ipc_socket_key_idea.png)

### 1.2 为什么不总是用普通文件通信？
用持久文件做瞬时通信虽然可行，但常常浪费：
- 数据可能不必要地经过存储路径。
- 对短生命周期交互而言，时延和开销偏高。

内核管理的内存队列可以保留 read/write 编程模型，同时更适合瞬时 IPC。

![内核内存队列 IPC](./lec05_materials/kernel_memory_queue_ipc.png)

:::remark 问题：为什么“基于文件”的通信有时会浪费？
如果目标只是短时的生产者-消费者交换，把数据落盘会引入额外成本。内存型 IPC 可以避免存储开销，同时继续通过系统调用维持安全边界。
:::

## 2. Pipe：单向 IPC 队列

### 2.1 Pipe 模型与 API
POSIX pipe 是内核里的固定大小队列，返回两个文件描述符：

```c
int pipe(int fileds[2]);
```

- `fileds[1]`：写端。
- `fileds[0]`：读端。

由于容量有限，阻塞行为是：
- 缓冲满时写者阻塞。
- 缓冲空时读者阻塞。

![UNIX pipe 阻塞规则](./lec05_materials/unix_pipe_blocking_rules.png)

### 2.2 具体示例：单进程 pipe
示例把 `"Message in a pipe.\n"` 写入 `pipe_fd[1]`，再从 `pipe_fd[0]` 读出，打印发送/接收长度，最后关闭两端。

```c
char *msg = "Message in a pipe.\n";
char buf[BUFSIZE];
int pipe_fd[2];
pipe(pipe_fd);
ssize_t writelen = write(pipe_fd[1], msg, strlen(msg)+1);
ssize_t readlen  = read(pipe_fd[0], buf, BUFSIZE);
close(pipe_fd[0]);
close(pipe_fd[1]);
```

结果：
- 接收到的字符串与发送字符串一致。
- 该例子直接展示了 queue 抽象，不依赖网络。

![单进程 pipe 代码示例](./lec05_materials/single_process_pipe_example.png)

### 2.3 `fork` 后的 pipe 继承
如果进程先 `pipe()` 再 `fork()`，父子会继承这两个 pipe fd。

![父子进程间的 pipe](./lec05_materials/pipes_between_processes.png)

为了明确通信方向，双方通常各关一端：
- Parent -> Child：父关读端，子关写端。
- Child -> Parent：父关写端，子关读端。

![父到子 close 模式](./lec05_materials/pipe_parent_to_child_close_pattern.png)

![子到父 close 模式](./lec05_materials/pipe_child_to_parent_close_pattern.png)

### 2.4 具体示例：父写子读
`fork()` 之后：
- 父进程执行 `write(pipe_fd[1], msg, msglen)`，并关闭 `pipe_fd[0]`。
- 子进程执行 `read(pipe_fd[0], buf, BUFSIZE)`，并关闭 `pipe_fd[1]`。

这样可以保证单一方向，避免未使用端导致的死锁或资源泄漏。

### 2.5 EOF 与 SIGPIPE 规则（必背）
- **最后一个写端描述符**关闭后，后续读会得到 EOF。
- **最后一个读端描述符**关闭后，写会触发 `SIGPIPE`。
- 若忽略/处理 `SIGPIPE`，`write` 返回失败并给出 `EPIPE`。

![Pipe EOF 状态变化](./lec05_materials/pipe_eof_state_transition.png)

:::remark 问题：pipe 的 EOF 到底在什么时候出现？
只有当引用该 pipe 的所有进程里都不存在写端描述符时，读端才会看到 EOF。只要还留着任意一个写端，读端更可能继续阻塞而不是返回 EOF。
:::

## 3. 协议：对通信行为的约定

### 3.1 核心定义
一个关键表述是：
- **"A protocol is an agreement on how to communicate."**

协议包含：
- **Syntax**：消息格式与发送顺序。
- **Semantics**：消息含义与收发后的动作。

协议常用状态机或消息事务图来描述。

![协议的语法与语义](./lec05_materials/protocol_syntax_semantics.png)

### 3.2 具体示例：电话交流协议
电话通话可抽象为一套有序状态：
1. 拿起电话并确认可用（拨号音/服务）。
2. 拨号并等待振铃。
3. 被叫应答（"Hello?"）。
4. 主叫自我标识并开始轮流对话。
5. 双方交替发言与停顿。
6. 互道 "Bye" 并挂断。

![人类电话协议示例](./lec05_materials/human_phone_protocol_example.png)

这个例子说明：协议设计不仅是字节传输，更是“合法顺序 + 语义解释”。

## 4. 客户端-服务器 IPC 与 Socket 抽象

### 4.1 客户端与服务器职责
- 客户端通常间歇在线，主动发请求，必须知道服务器地址。
- 服务器通常长期在线，持续监听，提供固定可发现地址。

![客户端与服务器角色](./lec05_materials/client_server_roles.png)

### 4.2 网络连接是什么
在本讲 TCP 语境中，连接是两个进程（可跨机器）之间的双向字节流，本质上可看作两条有界队列：
- A -> B 队列。
- B -> A 队列。

### 4.3 Socket 抽象
Socket 是网络连接的一端。
- 它像文件一样用 fd + `read`/`write` 访问。
- `write` 把数据加入输出队列。
- `read` 从输入队列取出数据。
- 部分文件操作不适用（如 `lseek`）。

![Socket 端点抽象](./lec05_materials/socket_endpoint_abstraction.png)

### 4.4 具体示例：Echo 服务
Echo 协议行为是：
- 客户端发送 `"hello, world"`。
- 服务器读取后把同样字节原样回写。
- 客户端再读回并打印。

代码级循环：
- Client：`fgets -> write(sockfd,...) -> read(sockfd,...) -> write(STDOUT,...)`
- Server：`read(consockfd,...) -> write(STDOUT,...) -> write(consockfd,...)`

这个示例具体展示了在同一连接流上的请求-响应过程。

## 5. 命名与 TCP 建连

### 5.1 Internet 通信命名空间
独立程序要“找到对方”，必须显式命名：
- Hostname（例如 `www.pku.edu.cn`）。
- IP 地址（IPv4/IPv6）。
- Port。

端口区间要记住：
- `0-1023`：well-known/system（绑定通常需要特权）。
- `1024-49151`：registered。
- `49152-65535`：dynamic/ephemeral。

### 5.2 TCP 建连：监听 socket 与连接 socket
服务器侧生命周期：
1. `socket()` 创建监听端点。
2. `bind()` 绑定到 host:port。
3. `listen()` 开启连接排队。
4. `accept()` 为某个客户端创建**新的连接 socket**。

![TCP listen/accept 流程](./lec05_materials/tcp_listen_accept_flow.png)

### 5.3 5 元组连接标识
一个 TCP 连接由以下 5 项唯一标识：
1. Source IP
2. Destination IP
3. Source Port
4. Destination Port
5. Protocol（TCP）

客户端端口常是临时端口；服务器端口常是知名端口。

![TCP 5 元组标识](./lec05_materials/tcp_connection_five_tuple.png)

### 5.4 端到端生命周期（概念流程）
客户端侧：
- 创建 client socket -> connect(host:port) -> write/read -> close。

服务器侧：
- 创建 server socket -> bind -> listen -> accept -> 用连接 socket 服务 -> 关闭连接 socket -> 继续监听或关闭监听 socket。

![客户端-服务器 socket 生命周期](./lec05_materials/client_server_socket_lifecycle.png)

:::remark 问题：彼此独立的程序如何知道应该互相通信？
它们依靠共享命名规则（host/IP + port）、协议约定，以及 `connect` 与 `listen/accept` 的时序配合来完成对齐。没有这些前提，两个独立进程无法安全建立通信。
:::

## 6. 服务器设计模式：保护性与并发性的取舍

### 6.1 串行服务器（`v1`）
循环是 `accept -> serve_client -> close`。
- 实现简单。
- 但一个慢连接会阻塞后续连接。

### 6.2 每连接一进程（`v2`）
`accept` 后 `fork`：
- 子进程处理请求并退出。
- 父进程关闭连接 fd 并等待。

保护性收益：
- 每个连接在独立进程/地址空间中运行。

该版本代价：
- 父进程 `wait(NULL)` 让服务行为接近串行。

![每连接一进程模型](./lec05_materials/process_per_connection_model.png)

### 6.3 进程并发服务器（`v3`）
在接收循环中去掉阻塞式 `wait(NULL)`：
- 父进程持续接受新连接。
- 多个子进程可并发服务。

![进程并发模型](./lec05_materials/process_concurrency_model.png)

### 6.4 每连接一线程模型
每次 `accept` 后创建线程：
- 比创建进程/切换进程更高效。
- 主线程可持续接收新连接。
- 代价是隔离性弱于进程模型。

![每连接一线程模型](./lec05_materials/thread_per_connection_model.png)

### 6.5 线程池模型
每连接一线程的问题是线程数量可能无界增长，导致吞吐下降。

有界线程池方案：
- Master 线程负责 `accept` 并入队。
- 固定数量 Worker 线程出队处理。
- 用“有界队列 + 有界线程”控制并发上限，稳定资源占用。

![线程池模型](./lec05_materials/thread_pool_model.png)

:::tip 实践上的对比规则
- 当故障隔离与保护性优先时，更偏向进程模型。
- 当吞吐与开销优先时，更偏向线程/线程池。
- 真实服务器中，线程池常作为可预测性能的折中方案。
:::

## 7. 小结
- IPC 提供了受保护环境之间的受控通信。
- Pipe 是单向、单队列、本机内 IPC，常依赖 fd 继承。
- Socket 是双向、可跨机的 IPC 端点，接口风格与文件 I/O 相似。
- `listen/accept` 与命名（host/IP/port）是跨机协作核心。
- 服务器架构在“简单性、隔离性、并发性”之间做取舍。

## 附录 A：Exam Review

### A.1 必背定义
- IPC、pipe、socket、protocol、server socket、connection socket。
- 协议里的 syntax 与 semantics。
- TCP 连接 5 元组。

### A.2 必背 API
- Pipe：`pipe`、`read`、`write`、`close`、`fork`。
- Socket 建连：`socket`、`bind`、`listen`、`accept`、`connect`、`close`。
- 并发：`fork`、`wait`、`pthread_create`。

### A.3 必背行为规则
- Pipe 满：写阻塞；Pipe 空：读阻塞。
- 最后写端关闭：读端得到 EOF。
- 最后读端关闭：写端触发 `SIGPIPE` / `EPIPE`。
- `accept` 返回新的连接 socket；监听 socket 继续用于后续连接。

### A.4 必背示例
- 单进程 pipe：把 `"Message in a pipe.\n"` 从写端传到读端。
- 父写子读 pipe：必须关闭相反方向的端点来固定方向。
- Echo server：把读到的负载原样返回。
- `v1` 串行简单但不并发；`v3` 去掉循环内 `wait` 后支持并发。
- 线程池用于避免“无界建线程”导致的吞吐下滑。

### A.5 自检清单
- 你能解释为什么瞬时通信下“文件式 IPC”可能浪费吗？
- 你能准确判断 pipe 在什么条件下返回 EOF 吗？
- 你能解释 listening socket 与 connected socket 的区别吗？
- 你能写出并解释 TCP 5 元组吗？
- 你能比较每连接一进程与线程池在隔离性和效率上的差异吗？
