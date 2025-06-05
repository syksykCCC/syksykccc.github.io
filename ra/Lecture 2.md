# Lecture 2 - 2025 / 2 / 20

### Bipartite Matching

给定一个二分图 $G = (V_1, V_2, E)$，且 $|V_1| = |V_2| = n$，求 $G$ 是否包含一个完美匹配？

**Definition (Tutte matrix):** 二分图 $G$ 的 Tutte 矩阵定义为 $n \times n$ 矩阵 $A_G = [a_{ij}]$，其中如果 $(i, j) \in G$ 那么 $a_{ij} = x_{ij}$ 为一个变量，否则 $a_{ij} = 0$。

**Claim:** $G$ 包含完美匹配当且仅当 $|A_G| \ne 0$。

> 由行列式定义 
> $$ |A_G| = \sum_{\sigma} \mathrm{sgn}(\sigma) \prod_{i=1}^{n} a_{i\sigma(i)}  $$
>
> $G$ 包含完美匹配，也就是存在排列 $\sigma$ 使得 $\forall 1 \le i \le n, a_{i\sigma(i)} \ne 0$。换言之 $\prod_{i=1}^{n} a_{i\sigma(i)} \ne 0$。
>
> 根据 Tutte 矩阵的定义，每个 $\sigma$ 对应的乘积包含的变量均不相同，因此只要有一项非 $0$，就有 $|A_G| \ne 0$。反之亦然。

小知识：$n\times n$ 矩阵的行列式可以通过并行算法，在 $O(n^{3.5})$ 个处理器上用 $O(\log^2 n)$ 的时间计算。

那么利用 Lecture 1 判定多项式是否为 $0$ 的方法即可。

对于一般图？

### Finding a Perfect Matching in Parallel

**Lemma (Isolation Lemma):** 设 $S_1, S_2, \cdots, S_k \sube S$，给 $S$ 中的每个元素均匀随机赋值 $\{1, 2, \cdots, l\}$，则 
$$
\Pr[\exists \text{unique } S_i \text{ of minimal sum of weights} ] \ge \left(\dfrac{l-1}{l}\right)^{|S|} \ge 1 - \frac{|S|}{l}
$$

> 我们可以不妨设集合是没有包含关系的。
> 
> 我们记所有赋值方法 $w = \{w_x \mid x \in S\}$ 构成的集合为 $\cal W$，如果 $\forall x, w_x > 1$，那么这样的赋值方法构成的集合为 $\cal W^+$。
>
> 易知 $|\mathcal{W}| = l^{|S|}$。
> 
> 接下来我们构造一个从 $\cal W^+$ 到“最小集合唯一的赋值方式”的单射。
>
> 对于 $w \in \cal W^+$，我们任取一个此时的最小集合 $S_{*}$，构造 $w'$ 为
> $$ w'_x = \begin{cases} w_x - 1 & (x \in S_*) \\ w_x & (x \notin S_*) \end{cases} $$
> 
> 此时 $w'$ 是一个有唯一最小集合（$S_*$）的赋值方式。
> 
> 而且对于 $w'$，可以通过取出唯一最小集合 $+1$ 返回得到 $w$，因此该映射为单射。从而“最小集合唯一的赋值方式”不少于 $|\cal W^+| = (l - 1)^{|S|}$ 种。
> 
> 由于 $\cal \dfrac{|W^+|}{|W|} = \dfrac{(l-1)^{|S|}}{l^{|S|}}$，立刻得证。


于是我们给每条边 $e$ 随机赋值 $w_e \in \{1, 2, \cdots, l\}$，根据 Isolation Lemma 有很大把握认为最小权完美匹配是唯一的。假设确实唯一。

从而我们令 $x_{ij} = 2^{w_{(i, j)}}$，称带入值之后的为矩阵 $B$，则当 $|A_G| \ne 0$ 即完美匹配存在时： 

$$ \mathrm{lowbit}(|B|) = 2^{\text{minimal weights perfect match}} $$

求出一个完美匹配的并行算法：

首先计算 $2^w = \mathrm{lowbit}(|B|)$。

然后并行的对于每条边 $(i, j)$，如果 

$$2^{w_{(i, j)}} \times \mathrm{lowbit}(|B_{ij}|) = 2^w $$

那么输出 $(i, j)$。上式 $B_{ij}$ 表示余子式。

对于一般图？

### Fingerprinting

给定 $n$-bit 数 $a$ 和 $b$，判断是否相等。

假设这两个数可以快速取模，那么我们在不超过 $T$ 的素数中，随机一个素数 $p$。

由于 $|a - b|$ 的素因子个数不超过 $\log_2 |a - b| \le n$ 个，因此 $a \equiv b \pmod p$ 的概率不超过 $\dfrac{n}{\pi(T)}$。

**Theorem (Prime Number Theorem):** 用 $\pi(x)$ 表示 $\le x$ 的素数的个数，$$\forall x \ge 17, \quad \frac{x}{\ln x} \le \pi(x) \le 1.26 \frac{x}{\ln(x)} $$

我们随机生成一个不超过 $T$ 的素数，发生错误的概率不超过 $\dfrac{n \ln T}{T}$。

因此取 $T = cn \ln n$，则有错误概率 $\le \dfrac{1}{c} + o(1)$。

更紧的，有结论：$n$-bit 数的素因子数量不超过 $\pi(n)$，因此取 $T = cn$ 就能达到效果。

Fingerprinting 算法直接应用：Pattern matching。