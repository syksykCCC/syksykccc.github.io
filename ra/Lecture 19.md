# Lecture 19 - 2025 / 4 / 24

### Ballot

有两个竞选者 A, B，分别收到 $a, b$ 张票。假设选票按随机顺序计入，$a > b$，则 A 的选票数量一直 $>$ B 的选票数量的概率是多少。

定义 $S_k$ 为 $k$ 轮后 A, B 的选票数量之差，则 $S_n = a - b$。定义 $X_k = \dfrac{S_{n-k}}{n-k}$，即倒过来看，$X_0 = \dfrac{a-b}{a + b}$。

**Claim:** $(X_k)$ 是鞅。
> 在给定 $X_{k-1}$ 的情况下，此时 A, B 的选票数量 $a', b'$ 满足 $X_{k-1} = \dfrac{a'-b'}{a' + b'}$。因此
$$  
\begin{aligned}
\mathbb E[X_k \mid X_{k-1}] & = \frac{a'}{a' + b'} \cdot \frac{(a'-1) - b'}{a' + b' - 1} + \frac{b'}{a' + b'} \cdot \frac{a' - (b' - 1)}{a' + b' - 1}\\
& = \frac{a' (a' - 1) - b'(b' - 1)}{(a' + b')(a' + b' - 1)}\\
& = \frac{(a' - b')(a' + b' - 1)}{(a' + b')(a' + b' - 1)} = X_{k-1}
\end{aligned}
$$

定义 $T = \min\{k \mid X_k = 0\}$ 或者 $n - 1$ 如果 $k$ 不存在。

* 如果 A 一直领先，则 $T = n - 1$，故 $X_T = X_{n-1} = S_1 = 1$
* 如果存在平票的时刻，则 $X_T = 0$。

从而第一种情况的概率，即答案为 $\mathbb E[X_T]=\mathbb E[X_0] = \dfrac{a-b}{a+b}$。


### Submartingale

**Definition (sub/supmartingale):** $(X_i)$ 是关于 filter $(\mathcal F_i)$ 的**下鞅**如果
$$ \mathbb E[X_i \mid \mathcal F_{i-1}] \ge X_{i- 1} $$

反之，是**上鞅**如果
$$ \mathbb E[X_i \mid \mathcal F_{i-1}] \le X_{i- 1} $$

在满足相应条件下，关于下鞅，有 $\mathbb E[X_T] \ge \mathbb E[X_0]$；对于上鞅，有 $\mathbb E[X_T] \le \mathbb E[X_0]$。

基于此可以有一种 bound $\mathbb E[T]$ 的方式：

记 $D_i = X_i - X_{i-1}$，假设 $(X_i)$ 是一个鞅，即 $ \mathbb E[D_i \mid X_1, \cdots, X_{i-1}] = 0 $，并且有 $\mathbb E[D_i^2 \mid X_1, \cdots, X_{i-1}] \ge \sigma^2$。那么设 $Y_i = X_i^2 - \sigma^2 \cdot i$ ，从而
$$
\begin{aligned}
\mathbb E[Y_i \mid X_1, \cdots, X_{i-1}] 
& = \mathbb E[X_i^2  \mid X_1, \cdots, X_{i-1}] - \sigma^2 \cdot i \\
& = \mathbb E[D_i^2 \mid X_1, \cdots, X_{i-1}] + X_{i-1}^2 - \sigma^2 \cdot i\\
& \ge \sigma^2 + (Y_{i-1} + \sigma^2 \cdot (i-1)) - \sigma^2 \cdot i \\
& = Y_{i-1}
\end{aligned}
$$

这表明 $(Y_i)$ 是一个下鞅，从而对于一个停时 $T$，
$$
\mathbb E[Y_T] \ge \mathbb E[Y_0] \quad \Rightarrow \quad \mathbb E[T] \le \frac{\mathbb E[X_T^2] - \mathbb E[X_0^2]}{\sigma^2}
$$

现在考虑一个上鞅 $(X_i)$，定义在区间 $[0, n]$ 上，$X_0 = s$，满足：
$$
\mathbb E[D_i \mid X_1, \cdots, X_{i-1}] \le 0\\
\mathbb E[D_i^2 \mid X_1, \cdots, X_{i-1}] \ge \sigma^2
$$

**Claim:** 设 $T$ 是第一次到达 $0$ 的时刻，$\mathbb E[T] \le \dfrac{2ns - s^2}{\sigma^2} \le \dfrac{n^2}{\sigma^2}$

> 构造 $Y_i = X_i^2 - 2n X_i -\sigma^2 i$，可以验证  $Y_i$ 是一个下鞅，从而
$$ \mathbb E[Y_T] \ge \mathbb E[Y_0] \quad \Rightarrow \quad \mathbb E[T] \le \frac{2ns - s^2}{\sigma^2} \le \frac{n^2}{\sigma^2} $$


### Random 2-SAT

对于一个有 $n$ 个变量的 2-CNF $\phi$，任意选定一个起始赋值 $a_0$。如果 $\phi$ 不满足，则任取一个没满足的 clause $C_0$，任选其中的一个 literal 并翻转之。

**Claim:** 如果 $\phi$ 是可满足的，则上述随机算法在期望 $O(n^2)$ 次找到一个合法赋值。

> 任取一个合法赋值 $a^*$，用 $X_i$ 代表 $i$ 轮后的赋值 $a_i$ 和 $a^*$ 的 Hamming 距离，则当 $a_i$ 仍是不满足的赋值时，
> $$ |X_i - X_{i-1}| = 1, \quad \Pr[X_i - X_{i-1} = -1] \ge \frac 1 2 $$
> 
> 后者是因为一个错误的 clause 当中所涉及的两个变量，不妨在 $a^*$ 中的赋值是 $00$，则在 $a_{i-1}$ 中的赋值只可能是 $01, 10, 11$。对于前两者 Hamming 距离期望不变，而对于最后一种情况 Hamming 距离一定 $-1$。
>
> 因此设 $D_i = X_i - X_{i-1}$，则有
> $$ \mathbb E[D_i \mid X_1, \cdots, X_{i-1}] \le 0\\
\mathbb E[D_i^2 \mid X_1, \cdots, X_{i-1}]  = 1 $$
> 
> 从而根据前述结论，有 $\mathbb E[\text{steps to }a ^*] \le n^2$。
> 
> 注：事实上在上述迭代过程中可能中途即出现 $a_i \ne a^*$ 已经满足了 $\phi$ 的情况，此时迭代会收敛，因为找不到“错误的 clause”，但这是有助于结论的，故不做考虑。
