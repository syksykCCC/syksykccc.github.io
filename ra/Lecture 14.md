# Lecture 14 - 2025 / 4 / 7

### Giant Component (1)

**Theorem:** 对于 $G \in \mathcal G_{n, p}$，其中 $p = \dfrac c n$，$c < 1$ 是一个常数，则 a.a.s. $G$ 的最大的连通分支大小是 $O(\log n)$ 的。

对于一个结点 $v$，通过 BFS 找出 $v$ 所在的连通块大小的过程，可以看作从 $v$ 开始的一个 branching process。

* 即根节点为 $v$，为 $v$ 采样 $\mathcal B(n-1, p)$ 个邻居（儿子）结点，假设这里是 $2$ 个 $v_1, v_2$。 
* 为 $v_1$ 采样 $\mathcal B(n-3, p)$ 个邻居（儿子结点），即忽略掉 $v, v_1, v_2$ 的影响，假设是 $3$ 个。
* 为 $v_2$ 采样 $\mathcal B(n-6, p)$ 个邻居（儿子结点），即忽略掉所有上述已知连通的点的影响……

从而“$v$ 在一个大小为 $k$ 的连通块”即“branching process 可以展出 $k$ 个结点”的概率。注意这里每次针对一个结点展开，而不是针对一层展开。

我们将上述每一步展开放缩为 $\mathcal B(n, p)$，这给出了一个上界。进而上述概率不低于“$k$ 次采样 $\mathcal B(n, p)$ 之和不低于 $k-1$ 的概率”。

$$ 1+ \mathcal B(n, p) + \cdots +  \mathcal B(n, p) \ge k$$

我们基于这一点给出一个 upper bound。

> 设 $X_i \sim \mathcal B(n, c/n)$ i.i.d $i = 1, 2, \cdots, k$，则
$$ 
\begin{aligned}
\Pr\left[ \sum_{i=1}^{k} X_i \ge (k - 1) \right] & = \Pr \left[ \sum_{i=1}^{k} X_i \ge ck + (1-c)k - 1 \right] 
\end{aligned}
$$
>
> 注意 $\mu = ck, \beta = \dfrac{(1-c)k - 1}{ck} = \Theta(1) $，根据 Chernoff bound
$$ 
\begin{aligned}
\Pr\left[ \sum_{i=1}^{k} X_i \ge (k - 1) \right] & \le \exp\left(- \frac{((1-c)k-1)^2}{c^2k^2 (2 + ((1-c)k-1)/ck)}ck \right)\\
& = \exp\left(- \frac{((1-c)k-1)^2}{((c+1)k - 1)} \right)\\
& = \exp \left(  -\frac{(1-c)^2}{c+1}k + O(1) \right)\\
\end{aligned}
$$
>
> 从而取 $k = 2\cdot\dfrac{(1+c)}{(1-c)^2}\ln n$，则有上述概率 $\le O(n^{-2})$。对所有 $n$ 个初始的 $v$ union bound，得到原命题 w.p. $1 - O(n^{-1})$ 成立。
