# Lecture 3 - 2025 / 2 / 24

## Primality Testing

费马素数测试：随机选择 $a \in \{1 ,2, \cdots, n-  1\}$，如果 $\gcd(a, n) \ne 1$ 直接输出 $n$ 不是素数，否则如果 $a^{p - 1} \equiv 1 \pmod n$，则输出 `Yes`，否则为 `No`。

**Definition (Carmichael number):** 对于所有 $1 \le a < n$，都有 $a^{p-1} \equiv 1 \pmod n$，则 $n$ 为 Carmichael 数。

**Theorem:** 如果 $n$ 是合数且不是 Carmichael 数，则 $\Pr[\text{Error in Fermat test}] \le \dfrac{1}{2}$。

> 后文称 $G = \{a \mid (a, n) = 1\} = \Z_n^*$。
>
> 令 $H = \{a \in G \mid a ^{n - 1} \equiv 1 \pmod n\}$，显然有 $H \lneq G$，从而根据拉格朗日定理，$\Pr[\text{Error in Fermat test}] \le \dfrac{|H|}{|G|} \le \dfrac 1 2$。

现在考虑 Carmichael 数，首先我们处理掉 $n = p^k$ 的情况。

**Claim:** 可以在 $O(\log^2 n)$ 的时间内，判断一个数是不是 $p^k$。

> 首先 $k < O(\log n)$，所以每次二分 $p$ 即可。

**Lemma:** 对于素数 $p$，一定不存在 $x\not\equiv \pm 1 \pmod p$，$x^2 \equiv 1 \pmod p$。

> $(x - 1)(x + 1) \equiv 0 \pmod p$

我们试图通过寻找非平凡 $1$ 的平方根的方式来判定素数。

记 $n - 1 = 2^w O$。随机选择 $a \in G$。

* 首先根据 Carmichael，$a^{2^w O} \equiv 1 \pmod n$。
* 计算 $a^{2^{w-1} O} \bmod n$，如果是 $-1$，输出 `Yes`，如果是 $1$，继续；否则输出 `No`。
* 计算 $a^{2^{w-2} O} \bmod n$，如果是 $-1$，输出 `Yes`，如果是 $1$，继续；否则输出 `No`。
* ……
* 如果 $a^{O} \equiv 1 \pmod n$ 依然成立，输出 `Yes`。

显然素数一定能通过这个测试。对于合数，如果 $a$ 能够成功淘汰它，则称 $a$ 为一个 witness。

**Claim:** 对于存在两个不同素因子 $p_1, p_2$ 的合数 $n$，$\Pr[a \text{ is a non-witness}] \le \dfrac{1}{2}$。

> 第一步构造一个包含所有 non-witness 的 $G$ 的子群。
> 
> 记 $s^* \in \{O, 2O, \cdots, 2^w O\}$ 为最大的满足，$\exists x \in G, x^{s^*} \equiv -1 \pmod n$ 的数。
> 
> $s^*$ 一定是良定义的，因为 $(-1)^O \equiv -1 \pmod n$。
>
> 构造 $H = \{ a \in G \mid a^{s^*} \equiv \pm 1 \pmod n \} \le G$。易见所有 non-witness 都包含于 $H$。下面说明 $H \lneq G$，即可由拉格朗日定理得到 $\Pr[a \text{ is a non-witness}] \le \dfrac{|H|}{|G|} = \dfrac{1}{2}$。
>
> 考虑中国剩余定理，取出一个 $(x^*)^{s^*} \equiv -1 \pmod n $，我们构造满足如下方程的 $a \in G$。
>
> $$ \begin{cases} a\equiv x^* \pmod {p_1^{k_1}} \\ a \equiv 1 \pmod {p_2^{k_2}} \end{cases} $$
>
> 由于 $a\notin H, a \in G$，从而 $H$ 是真子群，原命题得证。

## Probabilistic Method

**Theorem (Ramsey):** 对于 $n \le 2^{k/2}$ 个点的图，存在而染色方案，使得任意 $k$ 完全子图都不是同色的。

**Theorem (Max Cut):** 对于图 $G = (V, E)$，存在一个割的大小 $\ge \dfrac{|E|}{2}$。

### Independent Set

**Claim:** 对于图 $G = (V, E)$，存在独立集大小 $\ge \sum\limits_v \dfrac{1}{\deg (v) + 1}$。

> 随机对点赋实数值，如果一个点是自己和邻居的最小值，就将其选入独立集。
>
> 可以看出不会选到相邻的点。$v$ 被选入的概率是 $\dfrac{1}{\deg(v) + 1}$，从而期望即右式。

### Crossing Number

**Definition (crossing number):** 把 $G = (V, E)$ 嵌入平面，交叉数 $c(G)$ 为最少的边的交点数量。

**Theorem (Euler's formula):** 对于平面图，$|V| + |R| = |E| + 2$。同时 $|R| \ge \dfrac{2|E|}{3}$ 从而 $|E| \le 3|V| - 6$。

**Claim:** $c(G) \ge |E| - 3|V| + 6$

> 容易验证，最佳的嵌入方式满足：
> * 边不自交
> * 两条边至多一个交点
> * 有公共点的边不交
>
> 于是，对于原图每一组相交的 $(a, b), (c,d)$，构造新的点 $v$，断开原来的边并将 $(a, v), (b, v), (c, v), (d, v)$ 连边。
>
> 新图为平面图，$|E'| = |E| + 2 c(G)$，$|V'| = |V| + c(G)$，从而
> $$ |E| + 2c(G) \le 3 |V| + 3c(G) - 6 \Rightarrow c(G) \ge |E| - 3|V| + 6$$

用概率方法加强这个结论。我们以 $p$ 的概率保留一个点，$1-p$ 的概率把点删去。

从而每条边有 $p^2$ 的概率保留下来，每个原来的交点有 $p^4$ 的概率被保留下来。

从而 
$$ 
p^4 c(G) \ge \mathbb E[c(G)] \ge \mathbb E[|E| - 3|V| + 6] = p^2 |E| - 3p|V| + 6\\
$$

$$
c(G) \ge \dfrac{p^2 |E| - 3p|V| + 6}{p^4} \ge \dfrac{p |E| - 3|V|}{p^3}
$$

**Claim:** 对任何 $|E| \ge 4|V|$ 的图 $G$，有 $c(G) \ge \dfrac{|E|^3}{64 |V|^2}$。

> 取 $p = \dfrac{4|V|}{|E|}$ 即可。