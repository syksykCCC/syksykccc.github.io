# Lecture 8 - 2025 / 3 / 13

### DNF Counting

**Definition (Disjunctive Normal Form):** 称形如 $(x_1 \land x_2 \land \cdots) \lor (\overline{x}_3 \land \cdots) \lor \cdots$ 为 DNF。

类似的，CNF 就是常见的 SAT 问题，有 $\# \text{SAT}(\varphi) = 2^n-  \# \text{DNF}(\neg \varphi)$。

我们试图设计一个算法在多项式时间内估算 DNF 的解的比例的 FPRAS。

**Definition (fully polynomial randomized approximation scheme):** 针对 $f : \Sigma^* \to \N$ 的 FPRAS 是一个算法，读入 $(x, \varepsilon)$，在关于 $|x|, \varepsilon^{-1}$ 多项式时间内输出随机变量 $Z$ 满足：
$$ \Pr[(1 - \varepsilon)f(x) \le Z \le (1 + \varepsilon)f(x)] \ge \dfrac 3 4 $$

给定 DNF $\varphi_1 \lor \cdots \lor \varphi_n$，共涉及 $x_1, \cdots, x_m$。设第 $i$ 个 term 的解集为 $S_i$，显然 $S_i = 2^{m - |\varphi_i|}$，目标即为求 $|\bigcup S_i|$。具体而言，构造集合 
$$U = \{ (a, i) \mid a \in S_i \} $$

从而 $|U| = \sum\limits_{i=1}^{n} |S_i|$。我们可以在 $U$ 中均匀随机采样 $(a,i)$。我们称一个样本 $(a, i)$ 是 _special_ 的，当且仅当 $\forall j < i, a \notin S_j$。换言之，$a$ 最早出现在 $S_i$ 中。

从而
$$
\mathbb E\left[\frac{\text{\#special}}{\text{\#total}} \right] = \dfrac{|\bigcup S_i|}{|U|}
$$

由于 $\mu \ge \dfrac 1 n$，从而由 Unbiased Estimator Theorem，可以有效得到 $\dfrac 3 4$ 正确率的 $\varepsilon$ 误差估计。实际上根据 Chernoff bound，只需要 $O(n/\varepsilon^2)$ 次独立采样即可。

### Network Reliability (1)

对于一张图 $G$，有 $n$ 个点 $m$ 条边，每条边有 $p$ 的概率割断，记 $p_{\rm fail}$ 为 $G$ 不连通的概率，即“网络鲁棒性”。

**Theorem:** 存在关于 $n, \varepsilon^{-1}$ 多项式时间的 FPRAS 估测 $p_{\rm fail}$。（对于每条边隔断概率不同的情况，依然存在）

设 $c$ 为最小割的长度。

> 如果 $p^c \ge \dfrac 1 {n^4}$，则直接使用 Monte Carlo 方法，根据 Unbiased Estimator Theorem，由于 $\mu \ge p^c$，可以在 $O(\dfrac 1 {\mu^2 \varepsilon^2}) = O(n^8 \varepsilon^{-2})$ 次采样中得到估计。**后文假设该性质不成立，即 $p^c = n^{-(4+\delta)}$。**

用 $\alpha$-最小割 表示大小不超过 $\alpha c$，且仅将 $G$ 分为两部分的割。

考虑如下算法 $\text{RMinCut}$：均匀随机抽取图中一条边 $(u, v)$，将两个点缩点（保留重边），直到只剩下 $2$ 个点，返回它们之间所有的边。

**Theorem:** 设 $C \sub E$ 是任一个最小割，则 $\Pr[\text{RMinCut returns } C] \ge \binom n 2^{-1}$。

> 由于最小割大小为 $c$，所以任何点的度数都 $\ge c$，也就是 $|E(G)| \ge \dfrac {cn} 2$。
>
> 从而第 $1$ 轮选中 $C$ 中边的概率 $\le \dfrac{c}{cn/ 2} = \dfrac{2}{n}$
>
> 容易看出等价于一直没有选择 $C$ 中的边，而且缩点并不会导致新图最小割变小，从而
> $$ \begin{aligned} \Pr[C \text{ survive all rounds}] & \ge (1 - \frac 2 n)(1 - \frac {2}{n-1}) \cdots (1 - \frac 2 3) \\ & = \dfrac{2}{n(n-1)} \end{aligned} $$

**Corollary:** 任意图 $G$ 的最小割的数量不超过 $\binom{n}{2}$，因为 $\text{RMinCut}$ 输出任何一个最小割是互斥事件。


**Claim:** 只有至多 $n^{2\alpha}$ 个 $\alpha$-最小割，这些割可以在关于 $n, \varepsilon^{-1}$ 的多项式时间内列举出。

> 类似上面的证明方法，对于任意一个 $\alpha$-最小割 $C$，有
> $$ \begin{aligned} \Pr[C \text{ survive until }2\alpha \text{ vertices remain}] & \ge (1 - \frac {2\alpha} n) \cdots (1 - \frac {2\alpha} {2\alpha + 1}) \\ & = \binom{n}{2\alpha}^{-1} \end{aligned} $$
>
> 对于剩下 $2\alpha$ 个点的图，任意输出一个割，则
> $$ \Pr[C \text{ survive}] \ge \binom{n}{2\alpha}^{-1} \frac{1}{2^{2\alpha - 1}} \ge \dfrac{1}{n^{2\alpha}}$$
>
> 最后，根据 coupon-collector，可以在期望 $O(n^{2\alpha} \log n^{2\alpha})$ 次实验内，列举出所有的 $\alpha$-最小割。

从而，我们对于 $\text{poly}(n)$ 个 $\alpha$-最小割，可以用加权的 DNF Counting 的方式，估算至少一个发生的概率。具体而言，割掉 $x$ 条边的方案权值为 $p^{x} (1-p)^{m-x}$，从而一个 term 的总权值为 $p^{|\varphi _i|}$，可以构造

$$
\mathbb E\left[\frac{\sum\limits_{\text{special }(a, i)}p^{|a|} (1-p)^{m-|a|}}{\sum\limits_{(a, i)} p^{|a|} (1-p)^{m-|a|}} \right] = 
\dfrac{\sum\limits_{\text{cut } a} p^{|a|}(1-p)^{m-|a|}}{\sum\limits_{i=1}^{n} p^{|\varphi _i|}}
$$

的 $(1\pm \varepsilon)$ 估计，而右边分子正是我们想求的概率。

