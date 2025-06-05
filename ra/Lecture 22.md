# Lecture 22 - 2025 / 5 / 12

### Packet Routing

考虑给定一张无向图 $G$，第 $i$ 个数据包想从 $s_i \to t_i$，沿着固定的路径 $P_i$。但是每条边每个时刻只能通过一个数据包。我们想要设计一个调度方案，使得传输完所有数据包的总时间最少。

定义 $c_e$ 为经过 $e$ 的路径数量，$c = \max\{ c_e \}$，$d$ 为所有路径 $P_i$ 长度的最大值。显然答案必须 $\ge \max\{c, d\}$。

**Theorem:** 存在一种调度方案满足时间为 $O(c + d)$ 且只有常数大小的缓冲区。

**Theorem':** 存在一种调度方案满足时间为 $O((c + d) 2^{O(\log^\star (c + d))})$ 且只有 $O((\log d)2^{O(\log^\star(c+d))})$ 大小的缓冲区。这里 $\log^\star$ 的意思是通过不断取 $\ln$ 直到变成常数规模所需要的次数。

不失一般性设 $c = d$。考虑尝试安排数据包 $i$ 在起点等待 $Z_i$ 时间，然后直接不等待地沿着路径 $P_i$ 完成传输。这里 $Z_i$ 是独立均匀从 $\{1, 2, \cdots, \alpha d\}$ 中抽取，$\alpha > 1$ 是待确定常数，显然这种做法的时间开销是 $(1 + \alpha)d$，正确性待证。

**Claim:** 将时间切分为 $\ln d$ 长度的帧，可以将问题分割为若干子问题，其中每个数据包想从这个帧内的起点到这个帧内的终点。以正概率每个子问题中的边的冲突次数（经过的路径数量）为 $\ln c$。

> 对于每条边 $e$ 定义坏事件 $A_e$ 代表在某个帧内经过 $e$ 的路径数量超过 $\ln c$。
>
> 注意到 $A_e$ 只和 $A_{e'}$ 相关，其中 $e, e'$ 存在公共经过的数据包。由于只有至多 $c$ 个数据包经过 $e$，每个数据包经过的路径长度至多 $d$，因此 $A_e$ 至多依赖 $cd = d^2$ 个坏事件。
>
> 接下来分析 $\Pr[A_e]$。对于任何一个数据包，因为帧的长度是 $\ln d$，所以对于一个特定的帧，在其中任何数据包经过 $e$ 的概率仅为 $\ln d / \alpha d$。于是该帧内经过 $e$ 的总边数 $\sim \mathcal B(c, \ln d / \alpha d)$，因此 $\Pr[A_e] = (1 + \alpha)d\cdot \Pr[\mathcal B(c, \ln d / \alpha d) > \ln c]$，即对所有 $<(1 + \alpha)d$ 个帧 union bound。 
>
> 根据 Chernoff bound，
$$ \Pr[A_e] \le (1 + \alpha) d\cdot \left(\frac{ce\ln d}{d\alpha\ln c}\right)^{\ln d}  = (1 + \alpha) d^{2 - \ln \alpha}$$
>
> 因此只需要取 $\alpha$ 足够大，即可满足 $\Pr[A_e] < 1 / e(d^2 + 1)$。

利用这一性质，可以将问题拆分为 $(1 + \alpha) d / \ln d$ 个子问题，参数分别为 $\ln c$ 和 $\ln d$，然后分别递归解决。通过不断取 $\ln$，最终问题会变成常数规模，于是我们可以构造一个确定的调度方案。最终通过合并解决原问题。由于递归层数是 $O(\log^\star (c + d))$ 的，每层总长度会伸长 $1 + \alpha$ 倍，因此总时间为 $d2^{O(\log^\star (c + d))}$，同时不同帧之间不会影响，因此缓冲区大小为 $O((\log d) 2^{O(\log^\star(c+d))})$。

### Asymmetric LLL

**Lemma (General LLL):** 设 $A_1, \cdots, A_n$ 是一系列坏事件，$D_i \sube \{A_1, \cdots, A_n\}$ 是 $A_i$ 相关的事件集合，如果存在实数 $x_1, \cdots, x_n \in [0, 1)$ 使得对所有的 $i$，有 $\Pr[A_i] \le x_i \prod_{j \in D_i} (1 - x_j)$，则 $\Pr[\bigcap_{i=1}^{n} \overline{A_i}] \ge \prod_{i=1}^{n} (1 - x_i) > 0$。

通过带入 $x_i = 2\Pr[A_i]$，有

**Corollary (Asymmetric LLL):** 同上，如果 $\sum_{j \in D_i} \Pr[A_j] \le 1/4$，则 $\Pr[\bigcap_{i=1}^{n} \overline{A_i}] \ge \prod_{i=1}^{n} (1 - 2 \Pr[A_i]) > 0$。

### Frugal Graph Coloring

**Definition:** 称 $G$ 的一个合法染色是 $\beta$-frugal 的，如果对于任何 $v \in G$ 的邻居，都没有一种颜色出现了多于 $\beta$ 次。

**Theorem:** 如果 $G$ 的最大度数 $\Delta \ge \beta^\beta$，则 $G$ 有一种用 $16 \Delta^{1 + 1/\beta}$ 种颜色的 $\beta$-frugal 染色。

> 对于 $\beta = 1$，有 $16 \Delta^2$ 种颜色，这是容易做到的。
>
> 对于 $\beta \ge 2$，对 $G$ 随机均匀 $Q := 16 \Delta^{1 + 1/\beta}$ 染色。下面证明有正数概率是满足条件的即可。有两类坏事件：
> 1. $A_{uv}$：相邻的两点 $u, v$ 染成同一种颜色。
> 2. $B_{u_1, u_2, \cdots, u_{\beta + 1}}$：某一个点的邻居 $u_1, u_2, \cdots, u_{\beta + 1}$ 染成了同一种颜色。 
>
> 容易看出 $\Pr[A_{uv}] = 1/Q, \Pr[B_{u_1, \cdots, u_{\beta + 1}}] = 1 / Q^\beta$。对于 A 类事件，它与至多 $2\Delta$ 个 A 类事件、$2\Delta \binom{\Delta}{\beta}$ 个 B 类事件相关；对于 B 类事件，它与至多 $(\beta + 1) \Delta$ 个 A 类事件、$(\beta + 1) \Delta \binom{\Delta}{\beta}$ 个 B 类事件相关。可见 B 类事件的相关性更强，我们对其验证 Asymmetric LLL 的使用条件：
$$
\begin{aligned}
& \left( (\beta + 1) \Delta \cdot \frac{1}{Q} \right) + \left( (\beta + 1) \Delta \binom{\Delta}{\beta} \cdot \frac{1}{Q^\beta} \right) \\
\le \ & \frac{(\beta + 1) \Delta}{Q} + \frac{(\beta + 1) \Delta^{\beta + 1}}{\beta! Q^\beta} \\
\le \ & \frac{\beta + 1}{16 \Delta^{1/\beta}} + \frac{\beta + 1}{\beta ! 16^\beta } \le \frac{\beta + 1}{16 \beta} + \frac{\beta + 1}{\beta ! 16^\beta } < 1/4
\end{aligned}
$$
>
> 因此满足 Asymmetric LLL 的使用条件，得证。