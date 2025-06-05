# Lecture 24 - 2025 / 5 / 19

### Mixing Time

**Definition (Vartiation Distance):** 对于两个 $\Omega$ 上的分布 $\mu, \xi$，定义
$$ \| \mu - \xi \| = \frac{1}{2} \sum_{x \in \Omega} | \mu(x) - \xi (x) | = \max_{A \sube \Omega} |\mu(A) - \xi(A)| $$

**Definition:** 对于一个不可约无周期的 Markov 链，定义时间 $t$ 的距离为 $\Delta(t) = \max_{x \in \Omega} \| \pi - p_x^{(t)} \|$。

**Definition (Mixing Time):** 定义 $\tau_{\rm mix}$ 为混合时间：$\tau_{\rm mix} = \min \{ t \mid \Delta(t) \le 1 / 2e \}$。

**Fact:** $\Delta(\tau_{\rm mix} \lceil \ln \epsilon^{-1} \rceil) \le \epsilon$

> 通过 coupling 的方式可以证明 $\Delta(kt) \le (2\Delta(t))^k$。

**Definition (Strong Stationary Time):** 停时 $T$ 是一个强稳定时间，如果停下来时可以保证收敛 $\Pr[X_t = y \mid T = t] = \pi(y)$。

**Claim:** $\Delta(t) \le \Pr[T >t]$

> 虽然 $\Delta(t)$ 是一个固定的数，但我们可以对它求期望
$$
\begin{aligned}
\mathbb E[\Delta(t)] & = \Pr[T > t] \cdot \mathbb E[\Delta(t) \mid T > t] + \Pr[T \le t] \cdot \mathbb E[\Delta(t) \mid T \le t] \\
& \le \Pr[T > t] \cdot 1 + \Pr[T \le t] \cdot 0 = \Pr[T > t]
\end{aligned}
$$

#### Example: Top-in-at-Random

考虑一种洗牌方式：每次把最顶上的牌插入随机位置。

**Claim:** 这种洗牌方式的混合时间为 $O(n \log n)$。

> 用 $T$ 表示原本最底下的牌被随机插入的时刻，则 $T$ 是一个强稳定时间。可见 $T = T_1 + T_2 + \cdots + T_{n-1} + 1$，其中 $T_i$ 表示从位置 $i$ 变动到 $i+1$ 所需要的时间。每个 $T_i$ 的分布是几何分布，期望为 $n/i$，故 $\mathbb E[T] = O(n \log n)$。根据 Markov 不等式，$\tau_{\rm mix} \le O(n \log n)$。

#### Example: Riffle Shuffle

考虑一种洗牌方式：每次把牌按照 $\mathcal B(n, 1/2)$ 分成两堆，然后随机均匀交叉。它的逆过程是，随机将每张牌标记为 $0 / 1$，然后将 $0$ 的牌挪到上面，$1$ 的牌挪到下面。

**Claim:** 这种洗牌方式的混合时间 $\le 2 \log_2 n + O(1)$。

> 将每轮的编号串联为一个二进制串，用 $T$ 表示每张牌被唯一标号确定的时间，也即给每张牌随机抽样 $[0, 2^T)$ 内的编号，能够做到不重复的时间。
>
> 根据生日悖论，$n$ 个人从 $cn^2$ 大小的集合抽取生日，有生日冲突的概率渐进趋向 $1 - \exp(-1/2c)$。因此，只需 $1 - \exp(-1/2c) \le 1/2e$ 且 $2^t \ge cn^2$，则有 $\tau_{\rm mix} \le 2 \log_2 n + O(1)$。
>
> 另一种看法是，对于固定的两张牌 $(x, y)$，无法被分开的概率为 $2^{-t}$，根据 union bound，只需要 $t = O(\log n)$ 即可使得 $n^2 2^{-t} \le 1/2e$。 

### Coupling

**Definition (Coupling):** 设 $(X_t), (Y_t)$ 为一个 Markov 链的两个样本，称它们是一个耦合，如果
1. 边际上 $X_t$ 和 $Y_t$ 的分布相同，即 $\Pr[X_t = y] = \Pr[Y_t = y]$；
2. $X_t = Y_t$ 时，$X_{t+1} = Y_{t+1}$。

**Definition (Meeting Time):** $T_{xy}$ 是从 $x, y$ 开始的两个 Markov 链的耦合的第一次相遇时间。即 $T_{xy} = \min\{ t \mid X_t = Y_t, X_0 = x, Y_0 = y \}$。

**Claim:** $\Delta(t) \le \max_{x, y} \Pr[T_{xy} \ge t]$

> 首先注意到，对于任何两个 r.v. $X, Y$，都有 $\Pr[X \ne Y] \ge \| P_X - P_Y \|$。
>
> 从而 $\Delta(t) = \max_x \| P_x^{(t)} - \pi \| \le \max_{x, y} \| P_x^{(t)} - P_y^{(t)} \| \le \max_{x, y} \Pr[X_t \ne Y_t \mid X_0 = x, Y_0 = y] \le \max_{x, y} \Pr[T_{xy} \ge t] $。其中第一个不等号是因为 $\pi$ 可以写作 $P_y^{(t)}$ 的线性组合 $\pi = \sum_y \pi(y) P_y^{(t)}$：
$$
\pi(x) = (\pi P^t)(x) = \sum_{y} \pi(y) P^t(y, x) = \sum_{y} P_y^{(t)}(x) \pi(y) 
$$

**Corollary:** $\tau_{\rm mix} \le 2e \max_{x, y} \mathbb E[T_{xy}]$

> 根据 Markov 不等式，$\Pr[T_{xy} \ge t] \le \mathbb E[T_{xy}] / t$，因此 $\Delta(t) \le \max_{x, y} \mathbb E[T_{xy}] / t$。当 $t = 2e \max_{x, y} \mathbb E[T_{xy}]$ 时，$\Delta(t) \le 1 / 2e$。

#### Example: Random Transposition Shuffle

考虑一种洗牌方式：每次随机选择两个位置交换。这个洗牌方式的等价描述是，选择一个位置和一张牌 $c$，将 $c$ 交换到位置 $i$。

**Claim:** 这种洗牌方式的混合时间为 $O(n^2)$。

> 用 Coupling 来分析，用 $D_t$ 表示 $X_t, Y_t$ 不同的位置，目标是分析多久之后 $D_t = 0$。
>
> 考虑一次选中 $(i, c)$，
> * 如果 $c$ 已经匹配了，则 $D_t$ 不会改变
> * 如果 $c$ 没有匹配，则 $D_t$ 不会上深，且如果 $i$ 位置之前不匹配，将会至少减少 $1$。
>
> 因此，如果当前 $D_t = d$，则 $\Pr[D_t \text{ decreases}] \ge (d/n)^2$。于是 $\mathbb E[T_{xy}] \le \sum_{d=1}^{n} (n/d)^2 = O(n^2)$。

注：实际上为 $\Theta(n \log n)$。
