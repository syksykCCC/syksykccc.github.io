# Lec13 - 调度 4：现代计算机系统中的调度

## 学习目标
学完本讲后，你应当能够解释为什么现代调度问题需要跨层设计，分析 **ZygOS** 如何降低微秒级 RPC 的尾延迟，描述 **Tiresias** 如何在不掌握完整作业信息时完成分布式深度学习作业的调度与放置，理解 **DRF** 的多资源公平性思想，并评估 **FairRide** 为什么选择“策略无关 + 近似最优效率”的共享缓存方案。

## 1. 全景视角
本讲围绕四个有代表性的系统/策略展开：
- **ZygOS**：面向微秒级数据中心 RPC 的低尾延迟调度。
- **Tiresias**：面向分布式深度学习的 GPU 集群调度。
- **DRF（Dominant Resource Fairness）**：多资源类型下的公平分配。
- **FairRide**：面对策略性用户的公平缓存共享。

它们的共同主题是：调度早已不只是“一个队列 + 一个 CPU”的问题，而是要同时处理系统开销、资源异构性和用户激励。

## 2. ZygOS：微秒级任务的低尾延迟调度
### 2.1 问题背景与基线矛盾
数据中心中的 KV 存储、内存数据库等应用，需要处理**微秒级 RPC**，而且常见 fan-out/fan-in 交互模式。核心目标是在严格 **tail latency SLO（99 分位）** 约束下提升吞吐。

已有系统存在一个典型矛盾：
- 从排队论看，单队列系统更容易减少瞬时负载不平衡。
- 从工程实践看，dataplane 系统往往开销更低，但通常是多队列。

:::remark 问题：我们能否构建一个“低开销且 work-conserving”的系统？
可以。核心思路是保留 dataplane 的低开销路径，同时加入机制让系统运行行为尽量收敛到单队列模型。
:::

### 2.2 排队论洞察与优化目标
优化指标是 **Load @ Tail-Latency SLO**。对不同模型的比较表明：
- 在固定 99 分位延迟 SLO 下，单队列模型通常能获得更高吞吐。
- 服务时间分布离散度越大，这种差距越明显。

在真实系统里，dataplane 在极低服务时间场景可能表现很好，但在高离散度或更严格尾延迟约束下，其优势并不稳定。

![ZygOS 在 10 us 服务时间下的负载-延迟曲线](./lec13_materials/zygos_latency_vs_load_10us.png)

### 2.3 ZygOS 设计要点
ZygOS 同时追求两类目标：
- **Dataplane 侧**：降低系统开销，采用 share-nothing 网络处理。
- **单队列侧**：实现 work conservation，减少队头阻塞。

其架构可分三层：
1. **Application layer**：事件驱动应用，对 work stealing 无感。
2. **Shuffle layer**：每核就绪连接列表，支持 stealing。
3. **Network layer**：尽量避免一致性与同步开销的网络处理路径。

### 2.4 执行模型：状态变化流程
执行模型可以按“状态不断迁移”的过程理解：
1. 请求先在 home core 被接收并转成就绪连接。
2. 就绪工作被放入 home core 的 shuffle queue。
3. 空闲 remote core 从该队列 steal 工作。
4. remote core 执行事件驱动应用逻辑。
5. 若需要访问 home core 的网络连接状态，则发起 **remote syscalls**。
6. home core 执行这些 syscall，并完成 TCP/IP 发送。

这条流程让 ZygOS 在维持轻量网络处理的同时，实现跨核的 work conservation。

![ZygOS 执行模型](./lec13_materials/zygos_execution_model.png)

### 2.5 评估结论
实验环境包括 10+1 台 Xeon 服务器、16-hyperthread 机器，以及 48x10GbE 交换机。

关键结果：
- 在 10 us 服务时间下，面对 fixed/exponential/bimodal 分布，ZygOS 在相同尾延迟 SLO 下达到更高吞吐。
- 在 Silo TPC-C 负载中，ZygOS 实现 **1.63x speedup over Linux**，并获得 **3.68x lower 99th latency**。

![ZygOS 的 Silo TPC-C 结果](./lec13_materials/zygos_silo_tpcc_results.png)

## 3. Tiresias：在不完整信息下调度 GPU 集群
### 3.1 目标与场景
生产环境中深度学习训练作业快速增长，且往往依赖多 GPU 的分布式训练。调度器需要同时兼顾：
- 降低全局平均 **Job Completion Time (JCT)**。
- 提高 GPU 利用率。

### 3.2 挑战一：训练时长不可预测
作业总运行时通常未知，但它又是最小化 JCT 的关键变量。

关键观察是，即使没有完整先验，仍有两类可用信息：
- **Spatial**：请求 GPU 数量。
- **Temporal**：已执行时间。

Tiresias 采用二维年龄调度：
- 从 LAS（Least-Attained Service）出发：优先执行已获服务最少的作业。
- 扩展为 **2DAS**，用“已执行 GPU 总时间”定义年龄：

$$
\text{2D attained service} = (\#\text{GPUs}) \times (\text{executed time})
$$

- 采用离散化 2D-LAS（MLFQ 风格）来降低频繁切换。

![2DAS 定义](./lec13_materials/tiresias_2das_definition.png)

:::remark 问题：在没有完整作业信息时，如何调度 DL 作业？
核心是用 attained service 代替对总时长的预测。Tiresias 将 attained service 扩展为二维（GPU 数量与已执行时间），因此不依赖完整运行时先验。
:::

### 3.3 挑战二：过度聚合放置
分布式训练存在通信开销。聚合放置能减少同步代价，但过度聚合会带来碎片化和排队延迟。

Tiresias 用 **model profile-based placement** 解决该问题：
- 根据模型通信特征判断是否应聚合放置。
- 图中示例表明：
  - 对 AlexNet、VGG 等通信代价更敏感的模型，倾向 **Consolidation = YES**。
  - 对部分 ResNet/Inception 类模型，采用 **Consolidation = NO** 更合适。

![基于模型画像的放置决策](./lec13_materials/tiresias_model_profile_placement.png)

:::remark 问题：如何在不伤害训练性能的前提下做作业放置？
不要使用“一刀切”策略。应由模型画像驱动放置，避免两种极端：不聚合导致网络争用，过聚合导致 GPU 碎片和排队时间拉长。
:::

### 3.4 端到端流程与评估结果
系统流程由 central master、discretized-2DAS 调度、画像驱动放置与 preemption 组成。

![Tiresias 端到端流程](./lec13_materials/tiresias_system_pipeline.png)

评估要点：
- Testbed：Michigan ConFlux，15 台机器，每台 4 GPU，100 Gbps RDMA。
- 测试床中平均 JCT 提升：**5.5x（相对 YARN-CS）**，并与 SRTF 接近。
- Trace-driven simulation：Microsoft 10 周 trace，2,000 GPU 集群。
- 仿真中平均 JCT 提升：**2x（相对 Gandiva）**。

![Tiresias 测试床 JCT 提升](./lec13_materials/tiresias_testbed_jct.png)

![Tiresias 追踪驱动仿真 JCT 提升](./lec13_materials/tiresias_trace_simulation_jct.png)

## 4. DRF：多资源类型下的公平分配
### 4.1 公平性的定义
在单资源场景里，直觉是每人至少获得 1/n。max-min fairness 与 weighted max-min fairness 是这一思路的推广。

在多资源场景中，本讲强调三条核心性质：
- **Share guarantee**：每个用户至少可得 1/n，但如果其需求更小则可分得更少。
- **Strategy-proofness**：用户虚报需求不会更有利。
- **Pareto efficiency**：不能在不损害他人的前提下提升某个用户。

![公平性定义](./lec13_materials/drf_fairness_properties_definition.png)

### 4.2 为什么仅有 max-min fairness 还不够
数据中心作业同时消耗 CPU、内存、磁盘和 I/O，且需求向量高度异构，因此不能只用单一资源份额来定义公平。

### 4.3 模型与自然基线
DRF 将任务需求写成向量，例如 `<2, 3, 1>`，并假设资源可分。

一个自然基线是 **Asset Fairness**：
- 让每个用户“资源份额之和”相等。

这个基线可能违反 **share guarantee**。考虑如下配置：
- 总资源：`70 CPU, 70 GB RAM`。
- User 1 每个任务需求：`<2 CPU, 2 GB>`。
- User 2 每个任务需求：`<1 CPU, 2 GB>`。

设 User 1 运行 `x` 个任务，User 2 运行 `y` 个任务。

Asset fairness 要求两名用户“份额之和”相等：

$$
\frac{2x}{70} + \frac{2x}{70} = \frac{y}{70} + \frac{2y}{70}
\Rightarrow 4x = 3y \Rightarrow y = \frac{4x}{3}
$$

资源约束为：

$$
2x + y \le 70 \quad (\text{CPU}), \qquad 2x + 2y \le 70 \quad (\text{RAM})
$$

代入 `y = 4x/3`：
- CPU 约束：`2x + 4x/3 <= 70`，得到 `x <= 21`。
- RAM 约束：`2x + 8x/3 <= 70`，得到 `x <= 15`。

因此满足 asset-fairness 等式且可行的点为 `x = 15`, `y = 20`。
- User 1 分配：`30 CPU, 30 GB`。
- User 2 分配：`20 CPU, 40 GB`。

User 1 在 CPU 和 RAM 上都只有 `30/70 = 42.86%`，低于 `50%`。

:::remark 问题：这为什么违背了 share guarantee 的直觉？
在 2 用户系统中，一个自然直觉是每个用户在有需求时应当至少拿到一半份额。这里 User 1 在两类关键资源上都只有 42.86%，甚至不如“固定切半”的独享分区（`35 CPU, 35 GB`，最多可跑 17.5 个任务）。这说明“份额求和相等”并不是多资源场景下稳健的公平定义。
:::

### 4.4 Dominant Resource Fairness（DRF）
关键定义如下：
- **A user’s dominant resource is the resource she has the biggest share of.**
- **A user’s dominant share is the fraction of the dominant resource she is allocated.**

示例：
- 总资源：`<10 CPU, 4 GB>`。
- User 1 分配：`<2 CPU, 1 GB>`。
- 因为 `1/4 > 2/10`，dominant resource 是 memory。
- dominant share 为 `25%`。

DRF 规则：
- **Apply max-min fairness to dominant shares.**
- **Equalize the dominant share of users.**

![dominant resource 与 dominant share 示例](./lec13_materials/drf_dominant_resource_and_share.png)

下面给出一个完整的 DRF 分配计算例子：
- 总资源：`<9 CPU, 18 GB>`。
- User 1 每个任务需求：`<1 CPU, 4 GB>`（dominant resource 是 memory）。
- User 2 每个任务需求：`<3 CPU, 1 GB>`（dominant resource 是 CPU）。

设 User 1 运行 `x` 个任务，User 2 运行 `y` 个任务。

DRF 要求 dominant share 相等：

$$
\frac{4x}{18} = \frac{3y}{9}
\Rightarrow \frac{2x}{9} = \frac{y}{3}
\Rightarrow 2x = 3y
\Rightarrow x = 1.5y
$$

容量约束：

$$
x + 3y \le 9 \quad (\text{CPU}), \qquad 4x + y \le 18 \quad (\text{RAM})
$$

将 `x = 1.5y` 代入 CPU 约束：

$$
1.5y + 3y = 4.5y \le 9 \Rightarrow y \le 2
$$

取 `y = 2`，得到 `x = 3`。
- User 1 分配：`<3 CPU, 12 GB>`。
- User 2 分配：`<6 CPU, 2 GB>`。
- User 1 的 dominant share（memory）为 `12/18 = 66.7%`。
- User 2 的 dominant share（CPU）为 `6/9 = 66.7%`。

因此 DRF 的结果正是“让 dominant share 对齐”。

:::remark 问题：为什么 DRF 比较 dominant share，而不是资源总份额？
因为不同用户的瓶颈资源可能不同。总份额会掩盖真实瓶颈并产生不公平；dominant share 直接刻画“谁在自己的瓶颈资源上更紧张”。
:::

### 4.5 DRF 与 CEEI，以及性质比较
另一种经济学思路是 **CEEI (Competitive Equilibrium from Equal Incomes)**：
- 先给每个用户 1/n 的每类资源。
- 再让用户在竞争市场中交易。

CEEI 在部分场景可提升利用率，但课上例子显示其可被操纵，因此 **not strategy-proof**。

:::remark 问题：为什么 CEEI 可能看起来更高效，却仍然不满足 strategy-proofness？
在 CEEI 中，用户的声明会影响市场结果与有效价格。策略性用户可以通过虚报偏好改变价格结构，再购买对自己更有利的资源组合。于是系统利用率可能提升，但“诚实上报最优”这一点被破坏了。
:::

:::remark 问题：为什么 max-min fairness 不够，必须引入 DRF？
因为多资源系统里，不同用户受不同瓶颈约束。DRF 通过 dominant share 比较用户，相比 asset-based 的均衡方式更能保持 share guarantee，并在诚实申报需求时保持策略无关性。
:::

课上性质对比表显示，DRF 能同时满足更多关键性质。

![Asset、CEEI 与 DRF 的性质对比](./lec13_materials/drf_policy_property_table.png)

## 5. FairRide：近似最优的公平缓存共享
### 5.1 动机与模型
在云环境中，缓存越来越多地被多用户共享。它能降低延迟和后端负载，但公平性会变得复杂。

传统缓存策略（LRU/LFU/LRU-K）偏向全局效率，却可能导致：
- 某个用户被挤压到极小缓存份额。
- 用户产生策略性行为。

FairRide 的简化模型定义：
- `r_{ij}`：用户 `i` 访问文件 `j` 的速率。
- `p_j`：文件 `j` 被缓存的比例。
- 用户 `i` 的命中率：

$$
HR_i = \frac{\sum_j p_j r_{ij}}{\sum_j r_{ij}}
$$

![FairRide 简化模型](./lec13_materials/fairride_simple_model.png)

### 5.2 三个目标性质
FairRide 关注三条性质：
- **Isolation Guarantee (Share Guarantee)**：用户不应比静态分配更差。
- **Strategy-Proofness**：用户作弊不能获益。
- **Pareto Efficiency**：无法“只让一方更好而不伤害他人”。

![三条目标性质](./lec13_materials/fairride_three_desired_properties.png)

### 5.3 为什么单纯 max-min fairness 在缓存里会失败
课上示例：
- 文件 A、B、C 均为 1 GB，总缓存 2 GB。
- Alice 请求：A 为 5 req/s，B 为 10 req/s。
- Bob 请求：B 为 10 req/s，C 为 5 req/s。
- 初始 max-min 风格分配下，双方命中率都约为 83.3%。

若 Bob 注入虚假访问（gaming），缓存会向其偏好倾斜，导致 Bob 真实命中率上升而 Alice 命中率下降，因此纯 max-min 并不 strategy-proof。

### 5.4 不可能性定理与 FairRide 的选择
定理指出：
- **No allocation policy can satisfy all three properties.**
- 一般情况下最多同时满足其中两条。

![三性质不可能性定理](./lec13_materials/fairride_impossibility_theorem.png)

FairRide 机制：
1. 从 max-min fairness 出发（每用户 `1/n` 基线）。
2. 共享文件成本由共享用户均摊。
3. **Only difference**：阻止未“付费”的用户继续获取额外缓存收益。
4. 使用概率阻断（通过延迟实现）：

$$
p(n_j) = \frac{1}{n_j + 1}
$$

其中 `n_j` 是正在缓存文件 `j` 的其他用户数量。

示例：`p(1)=50%`，`p(4)=20%`。

![FairRide 阻断示意](./lec13_materials/fairride_blocking_example.png)

![FairRide 对策略行为形成反激励](./lec13_materials/fairride_disincentive_strategy.png)

:::remark 问题：既然作弊很容易，阻断机制为什么有效？
因为阻断会让作弊在期望收益上变得不划算。策略用户额外注入流量后，其有效收益被抵消，最终无法提升真实效用。
:::

### 5.5 最终性质权衡
本讲最后给出的结论是：
- FairRide 保留 **isolation guarantee**。
- FairRide 保留 **strategy-proofness**。
- Pareto efficiency 为 **near-optimal**。

![FairRide 最终性质表](./lec13_materials/fairride_final_property_table.png)

## 6. 跨论文总结
- ZygOS 说明：排队论优势只有在低开销系统实现下才能兑现。
- Tiresias 说明：即使信息不完整，只要替代指标（2D attained service）和放置信号（model profile）选得对，依然能获得强性能。
- DRF 说明：多资源公平必须围绕瓶颈（dominant share）定义。
- FairRide 说明：在共享系统里，调度设计必须显式考虑用户策略行为。

## 7. 关键结论
- 现代调度是**多维问题**：尾延迟、开销、异构性、激励机制彼此耦合。
- 没有 tail-SLO 约束时，“平均吞吐最优”往往不是正确目标。
- 多资源公平需要明确数学定义，dominant share 是核心抓手。
- 在可博弈环境中，机制设计（如阻断规则）本身就是调度的一部分。

## 附录 A. Exam Review

### A.1 必背定义
- **2DAS age**：已执行 GPU 总时间。
- **Dominant resource**：用户占比最高的资源。
- **Dominant share**：用户在其 dominant resource 上的分配占比。
- **Isolation guarantee / share guarantee**：用户不应比静态份额更差。
- **Strategy-proofness**：虚报/操纵不能带来收益。
- **Pareto efficiency**：不能“只让一方更好而不伤害他人”。

### A.2 核心公式
$$
\text{2D attained service} = (\#\text{GPUs}) \times (\text{executed time})
$$

$$
HR_i = \frac{\sum_j p_j r_{ij}}{\sum_j r_{ij}}
$$

$$
p(n_j) = \frac{1}{n_j + 1}
$$

### A.3 四个系统的一句话总结
- **ZygOS**：用低开销 dataplane + work stealing，在尾延迟约束下逼近单队列行为。
- **Tiresias**：用二维 age 调度 + 模型画像放置，在缺少完整运行时信息下优化 DL 集群。
- **DRF**：通过均衡 dominant share 实现强多资源公平性。
- **FairRide**：通过概率阻断实现策略无关缓存共享，并接受 near-optimal Pareto 效率。

### A.4 高频简答题
1. 为什么在严格 tail-latency SLO 下，单队列模型可能优于多队列模型？
2. 为什么 `#GPUs × executed time` 比单独 executed time 更适合 DL 作业年龄度量？
3. 为什么 CEEI 可能提升利用率，却可能破坏 strategy-proofness？
4. 为什么 FairRide 的定理本质上是“二选三”权衡？
5. 概率阻断如何抑制策略性行为？

### A.5 常见误区
- 在多资源系统里把公平性当作单一标量目标。
- 忽略 tail latency，只优化平均延迟。
- 默认用户总是诚实，不考虑策略行为。
- 将“Pareto 最优”与“strategy-proof”混为一谈。
