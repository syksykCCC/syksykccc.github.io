# Lecture 6 - 2025 / 3 / 6

### Probability amplification using pairwise independence

**Claim:** 随机变量 $a, b \sim U(\Z_q)$，$q$ 是质数，则 
$$ \{ ax + b \mid x \in \Z_q \} $$

是一组两两独立的随机变量，且同分布于 $U(\Z_q)$。

> 首先 $\forall x, c \in \Z_q , \Pr[ax + b = c] = \dfrac 1 q $，故 $ax + b \sim U(\Z_q)$。
>
> 考虑 $\forall x, y, c_1, c_2 \in \Z_q, x \ne y$，则 $\Pr[ax + b = c_1, ay + b = c_2] = \dfrac{1}{q^2} = \Pr[ax + b = c_1] \Pr[ay + b = c_2]$。（因为关于 $a, b$ 的方程有唯一解）从而两两独立。

假设现在已有一个随机算法 $A$，依赖 $m$ 个随机 bits，用来判断 $x \in L \sube \{0, 1\}^n$ 是否成立。而且满足：
$$
x \in L \Rightarrow \Pr[A \text{ output Yes} ] \ge \frac 1 2 \\
x \notin L \Rightarrow \Pr[A \text{ output Yes}] = 0 
$$

现在试图将这个算法泛化到任何正确性。如果独立重复 $t$ 次，可以做到 $\Pr[\cal E] \le 2^{-t}$，从而如果需要达到 $\dfrac 1 r$ 的正确率，则需要生成 $m \log r$ 个随机 bits。

**Theorem:** 对于 $r \le 2^m$，可以只生成 $2m$ 随机 bits，在 $O(rm)$ 的时间复杂度内达到 $\Pr[\cal E] \le 2^{-t}$ 的效果。

> 考虑生成 $r$ 组两两独立的长度为 $m$ 的随机 bits。形式化的说，每组随机 bits 可以看作从 $U(\{0,1\}^m) \cong U(\Z_{2^m})$ 采样的随机变量，这 $r$ 个随机变量两两独立。一个不太完美的做法可以利用上面 **Claim** 的算法，取质数 $2^m \le q \le 2^{m+1}$，通过 rejection sampling 可以通过生成期望 $O(m)$ 个随机 bits 得到 $U(\{0,1\}^m)$ 中 $r$ 组两两独立的比特串。
> 
> 然后运行算法 $A$ $r$ 次。用 $X_i = 0/1$ 代表第 $i$ 次 $A$ 的输出，输出 Yes 时 $X_i = 1$。定义 $X = \sum_{i=1}^{r} X_i$。
> 
> 当 $x\in L$ 时，发生错误的概率为 
$$\Pr[\mathcal{E}] = \Pr[X = 0] \le \Pr[|X - \mathbb E[X]| \ge \mathbb{E}[X]] \le \frac{\mathrm{Var}[X]}{\mathbb{E}[X]^2} $$
>
> 其中由于两两独立，$\text{Var}[X] = \sum\limits_{i=1}^{r} \text{Var}[X_i] \le \dfrac{r}{4}, \mathbb{E}[X] \ge \dfrac r 2$，从而 $\Pr[\mathcal{E}] \le \dfrac 1 r$。

### Derandomization using $k$-wise independence

考虑给一张完全图 $K_n$ 的边二染色，要求没有同色 $k$-clique，这里 $n = 2^{k/2}$，根据之前的概率方法，染色方案是存在的。

如果要求出一种方案，一种暴力的策略是枚举 $2^{\binom n 2}$ 种染色方案。

回顾概率证法，设 $X$ 为同色 $k$-clique 数量，
$$ \mathbb E[X] = \binom n k \dfrac{2}{2^{\binom{k}{2}}} < 1 $$

这里其实并不要求所有边的染色全部独立。事实上，只要每 $\binom k 2$ 条边的染色是相互独立的即可。

考虑一族 $\binom k 2$-wise 独立的染色方案，其中每条边的颜色边际分布是均匀的。根据上述概率证法，$\mathbb E[X]$ 不变，从而这族染色方案中一定存在一个合法方案。

推广 **Claim** 到 $a x^2 + b x + c$，不难看出，要生成服从 $U(\Z_q)$ 的 $\binom k 2$-wise 独立的随机变量，只需要采样 $\binom k 2$ 个服从 $U(\Z_q)$ 的变量。这里需要 $q \ge \binom n 2$，以保证能够生成足够数量的随机变量。

从而我们枚举 $q^\binom{k}{2}$ 种采样的可能性，然后通过固定的解码策略得到唯一对应的 $\binom k 2$-wise 独立的边染色方案。在这族方案上，$\mathbb E[X] < 1$，从而其中必有可行解。

由于 $q^\binom k 2\simeq n^{O(k^2)}$，相较于暴力做法 $2^{O(n)}$，我们将复杂度降到了多项式级别。

### Universal hashing

**Definition ($2$-universal):** 一个 $U \to T$ 的函数集 $\mathfrak{H}$ 是 $2$-universal 的当且仅当 $\forall x, y \in U, x \ne y$，有
$$ \Pr_{h \in \mathfrak{H}} [h(x) = h(y)] \le \frac{1}{|T|} $$

例如，$h_{a,b}(x) = (ax + b)\bmod q \bmod |T|$，其中 $a, b \sim U(\Z_q), q > |U|$。

> $$ \begin{aligned} \Pr[h_{a,b}(x) = h_{a,b}(y)] & \le \sum_{c_1 \equiv c_2 \pmod {|T|}} \Pr[h_{a,b}(x) = c_1] \Pr[ h_{a,b}(y)=c_2] \\ & = \frac{q^2}{|T|} \cdot \frac 1 q \cdot \frac 1 q = \dfrac 1 {|T|}\qquad \forall x \ne y
\end{aligned} $$
