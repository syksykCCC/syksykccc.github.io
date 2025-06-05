# Lecture 23 - 2025 / 5 / 15

### Markov Chains

**Definition:** 一个 Markov 链是一列随机变量 $(X_t)_{t=0}^{\infty}$，满足
$$ \Pr[X_t = y \mid X_{t-1} = x, X_{t-2}, \cdots, X_0] = \Pr[X_t = y \mid X_{t-1}= x] = P(x, y) $$

其中 $P(x, y)$ 是一个转移概率，$P$ 是行和为 $1$ 的矩阵。

我们有 $p_x^{(t)} = p_x^{(0)} P^t$，其中 $p_x^{(0)}$ 是从 $x$ 出发的 one-hot 初始分布。

**Definition (irreducible):** $\forall x, y$, $\exists t$ s.t. $p_x^{(t)}(y) > 0$

**Definition (aperiodic):** $\forall x, y$, $\gcd\{t \mid p_x^{(t)}(y) > 0\} = 1$

### Stationary Distribution

**Theorem (Fundamental Theorem):** 如果 $P$ 是不可约且非周期的，则存在唯一的平稳分布 $\pi$，满足 $\pi P = \pi$，且 $ p_x^{(t)}(y) \xrightarrow{t \to \infty} \pi(y) \quad \forall x, y $。这里 $\pi$ 实际上是 $P$ 特征值为 $1$ 的唯一左特征向量。

**Observation 1:** 如果 $P$ 是对称的，则 $\pi$ 是均匀分布。

**Observation 2:** 如果 $P$ 列和也为 $1$，则 $\pi$ 是均匀分布。

**Observation 3:** 如果 $P$ 关于某个分布 $\pi$ 可反的，即 $\pi(x) P(x, y) = \pi(y) P(y, x)$，则 $\pi$ 是平稳分布。

### Metropolis Process

给定一个大集合 $\Omega$ 和权重 $w : \Omega \to \R^+$，希望设计一个稳态分布为 $\pi(x) = w(x) / Z$ 的 Markov 链，其中 $Z = \sum_{x \in \Omega} w(x)$，并且我们假定 $Z$ 是不知道的，或者正是我们想求的。

大空间采样过程给定将 $\Omega$ 连接起来的无向图，以及位于 $x$ 时抽取邻居的分布 $\kappa(x, y) > 0$，并且有 $\kappa(x, y) = \kappa(y, x)$，我们构造 Markov 链如下：

* 在 $x$ 时，抽取一个邻居 $y$，概率为 $\kappa(x, y)$。
* 以概率 $\min\{1, w(y) / w(x)\}$ 接受 $y$，否则停留在 $x$。

**Claim:** 由大空间采样构造出的 Markov 链的平稳分布为 $\pi(x) = w(x) / Z$。

> 不妨设 $w(x) \ge w(y)$。当 $x, y$ 不是邻居时，$\pi(x) P(x, y) = \pi(y) P(y, x) = 0$。当 $x, y$ 是邻居时，
$$ \pi(x) P(x, y) = \frac{w(x)}{Z} \cdot \kappa(x, y) \frac{w(y)}{w(x)} = \frac{w(y)}{Z}\kappa(x, y) = \pi(y)  P(y, x)  $$
> 
> 最后一个等号是因为 $\kappa(x, y) = \kappa(y, x)$。

事实上，如果不满足 $\kappa(x, y) = \kappa(y, x)$，我们只需将接受概率修改为 $\min \{1, (w(y) \kappa(y, x)) / (w(x)\kappa(x, y)) \}$。