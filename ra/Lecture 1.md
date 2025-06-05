# Lecture 1 - 2025 / 2 / 17

### Checking matrix multiplication

输入：三个 $n\times n$ 矩阵 $A, B, C$。

输出：是否 $AB = C$。

随机选定向量 $r = (r_1, r_2, \cdots, r_n)$，其中 $r_i$ 独立同分布于 $U(S)$，$2 \le |S| < |\N|$

如果 $(AB)r \ne Cr$ 则输出 `No`，否则输出 `Yes`。

确定算法 $O(n^3)$，或者最优秀的是 $O(n^{2.376})$。

算法时间复杂度 $O(n^2)$。

**Claim:** 如果 $AB \ne C$，则 $\Pr[(AB)r = Cr] \le \dfrac{1}{|S|}$。

> 设 $D = AB - C \ne 0$，则不失一般性设 $d_{11} \ne 0$。
>
> 如果 $Dr = 0$，则 
>
> $$(Dr)_1 = \sum_{i=1}^{n} d_{1i}r_i = 0$$
> 
> 于是 
> 
> $$ r_1 = - \dfrac{1}{d_{11}} (d_{12} r_2 + \cdots + d_{1n} r_n) $$
> 
> 于是对于 $r_2, \cdots, r_n$ 的每种选择，$r_1$ 只有唯一的可能性有可能使 $Dr = 0$，于是 $\Pr[Dr = 0] \le \dfrac{1}{|S|}$。

### Checking associativity

输入：在一个大小为 $n$ 的集合 $X$ 上定义二元运算 $\circ$。

输出：是否满足结合律 $\forall i, j, k \in X, i \circ(j \circ k) = (i \circ j) \circ k$。

确定性算法 $O(n^3)$。

不妨规定 $X = \{1 ,2, \cdots, n\}$。

首先可以构造一种 $\circ$ 使得不满足条件的三元组是常数组。

> 事实上，构造 $1 \circ 2 = 1$，其余运算结果全部为 $3$，则只有 $(1 \circ 2) \circ 2 \ne 1 \circ (2 \circ 2)$。

记 $\mathcal X = 2^X$，对于 $R \in \mathcal X$，可以用 $R = r_1r_2\cdots r_n$ 表示，其中 $r_i \in \mathbb F_2$ 表示 $i$ 有没有在 $R$ 中出现。

从而 $R$ 可以写成 $\sum\limits_{i = 1}^{n} r_i \cdot i$。

我们在 $\mathcal X$ 上定义一种 $+$ 运算，并扩展 $\circ$ 运算

$$ R + S = \sum_{i=1}^{n} (r_i + s_i) \cdot i 
\\
R\circ S = \sum_{i=1}^{n}\sum_{j=1}^{n} (r_i s_j) \cdot (i\circ j)  $$

我们将算法规定为：

均匀随机选择 $R, S, T \in \mathcal X$，如果 $(R \circ S) \circ T \ne R \circ(S \circ T)$ 输出 `No`，否则输出 `Yes`。

可以看出 $\circ$ 在 $X$ 上是结合的，等价于 $\circ$ 在 $\cal X$ 上是结合的。

> $\Rightarrow$ 可以通过展开得到，$\Leftarrow$ 是因为单元素集 $\in \cal X$。

**Claim:** 如果 $\circ$ 不结合，那么 $\Pr[(R \circ S) \circ T = R \circ (S \circ T)] \le \dfrac 7 8$。

> 假设存在 $i^*, j^*, k^*$ 不结合。
>
> 任取一组 $R_0, S_0, T_0$ 使得 $i^* \notin R_0, j^* \notin S_0, k^* \notin T_0$。
> 
> 令 $R_1 = R_0 \cup \{i^*\}, S_1 = S_0 \cup \{j^*\}, T_1 = T_0 \cup \{k^*\}$。
>
> 则设 $f(\alpha, \beta, \gamma) = (\alpha \circ \beta) \circ \gamma + \alpha \circ (\beta \circ \gamma)$。
> 
> 不结合即 $f(\{i^*\}, \{j^*\}, \{k^*\}) \ne \varnothing$。
>
> 根据容斥原理 $$f(\{i^*\}, \{j^*\}, \{k^*\}) = \sum_{r,s,t\in \{0, 1\} } f(R_r, S_s, T_t) \ne \varnothing $$
> 
> 从而 $\exists r, s, t \in \{0, 1\}$ 使得 $f(R_r, S_s, T_t) \ne \varnothing$。
> 
> 由于这样的 $(R_0, S_0, T_0)$ 以及衍生出的 $8$ 个集合构成了 $\cal X^3$ 的一个划分，所以一定有 $\frac{1}{8}$ 的 $\cal X$ 的三元组是不满足结合律的。

### Testing Polynomial Identities

给定某个域下 $2$ 个 $n$ 元多项式 $P, Q$，判定是否 $P \equiv Q$。

作差后问题等价于判定 $P \equiv 0$ 是否成立。

我们在有限集 $|S|$ 上均匀随机采样 $r_1, \cdots, r_n$，并带入 $P$ 计算。

**Claim:** 如果 $P \ne 0$，则 $\Pr[P(r_1, \cdots, r_n) = 0] \le \dfrac{d}{|S|}$，其中 $d = \deg P$。

> 对于 $n$ 归纳。$n = 1$ 时显然至多 $d$ 个根，结论成立。
> 
> 设 $k$ 是 $P$ 关于 $x_1$ 的最大度数。
>
> $$ P(x_1, \cdots, x_n) = M (x_2, \cdots, x_n) x_1^k + N(x_1, \cdots, x_n) $$ 
> 
> 其中 $\deg M \le d - k$，$N$ 中 $x_1$ 的度数 $ < k$。
>
> 设 $\cal E$ 表示 $M(r_2, \cdots, r_n) = 0$。
>
> 1. 如果 $\cal E$ 发生，则对 $M$ 由归纳，$\Pr[\mathcal E] \le \dfrac{d - k}{|S|}$。
>
> 2. 如果 $\cal E$ 不发生，则当固定 $r_2, \cdots, r_n$ 时，$P$ 是关于 $x_1$ 的 $k$ 次多项式，从而能使 $P = 0$ 的 $x_1$ 不超过 $k$ 个，于是 $\Pr[P(r_1, \cdots, r_n) = 0 \mid \neg \mathcal E] \le \dfrac{k}{|S|}$。
>
> 根据 union bound 立刻得证。