# Lecture 20 - 2025 / 4 / 28

### Percolation on $d$-Regular Graphs

**Theorem:** $G$ 为 $n$ 顶点的 $d$-正则图，其中 $3 \le d \le n-1$。用 $\mathcal C_1$ 代表 $G$ 上的 $p$-渗滤的最大的连通分支，其中 $p = \dfrac{1}{d-1}$，则对任意 $A > 0$：
$$
\Pr[|\mathcal C_1| \ge A n^{2/3}] \le \frac{\alpha}{A^{3/2}}
$$

其中 $\alpha$ 是一个 universal 常数。

考虑选定一个点 $v$ 开始分支过程，用 $X_t$ 表示当前“前沿”点的数量，每次展开一个“前沿”点。初始 $X_0 = 1$，于是
$$ X_t = X_{t-1} - 1 + \mathcal B\left(d-1, \frac{1}{d-1}\right) $$

可以看出 $(X_t)$ 是鞅，我们关注的是 $X_T = 0$ 的时刻。

**Lemma:** 假设 $(X_t)$ 是关于 $(\mathcal F_t)$ 的鞅，$X_0 = 1, X_t \ge 0$，定义停时 $ T = \min \{k, \min\{t \mid X_t = 0 \lor X_t \ge h\}\} $，那么如果满足

* （方差有下界）$\text{Var}[X_t \mid \mathcal F_{t-1}] \ge \sigma^2 > 0$，对于 $X_t > 0$
* （越界不太多）$\mathbb E[X_T^2 \mid X_T \ge h] \le Dh^2$ 

那么就有 $\Pr[\forall t \le k, X_t > 0] \le \dfrac{1}{h} + \dfrac{Dh}{k\sigma^2}$。

> 首先所求即 $\Pr[X_T \ne 0] \le \Pr[T \ge k] + \Pr[X_T \ge h]$。
>
> 容易根据 Markov 不等式得到 $\Pr[X_T \ge h] \le \dfrac{\mathbb E[X_T]}{h} = \dfrac{1}{h}$。
>
> 考虑 $Y_t := X_t^2 - h X_t - \sigma^2 t$，易见 $(Y_t)$ 是下鞅，从而 $ 1-h = \mathbb E[Y_0^2] \le \mathbb E[Y_T^2] \le \mathbb E[X_T^2] - h \mathbb E[X_T] - \sigma^2 \mathbb E[T]$。
>
> 注意到 $\mathbb E[X_T^2] - h \mathbb E[X_T]$ 在 $X_T < h$ 时是负的，故 $\le \Pr[X_T \ge h] \cdot (Dh^2 - h^2) \le (D-1)h$。于是立刻可以得到 $\mathbb E[T] \le Dh / \sigma^2$。
>
> 再根据 Markov 不等式，有 $\Pr[T \ge k] \le \dfrac{Dh}{k\sigma^2}$。


我们考虑将上述引理应用到 $(X_t)$ 上。易见方差 $\sigma^2 = \dfrac{d-2}{d-1} \ge \dfrac 1 2$，于是只需关注 $X_T \ge h$ 时的情况，我们针对最后一步展开。
$$ 
\begin{aligned}
\mathbb E[X_T^2 \mid X_T \ge h] & \le \mathbb E_{Z \sim \mathcal B(d-1, 1/(d-1))} [(h + Z)^2] \\
& \le h^2 + 2h + 2  \le 2h^2 \quad  (\forall h \ge 3)\\
\end{aligned}
$$

于是根据 Lemma，对于任何 $h \ge 3$，都有 $\Pr[\forall t \le k, X_t > 0] \le \dfrac{1}{h} + \dfrac{4h}{k}$，取 $h = \dfrac{\sqrt{k}}{2}$ 得到最优概率 $\dfrac{2}{\sqrt{k}}$，即设 $C(v)$ 表示从 $v$ 开始分支过程的连通分支大小，则有 $\Pr[C(v) \ge k] \le \dfrac{2}{\sqrt{k}}$。下证 Theorem。

> 如果直接对所有 $v$ 使用 union bound，则将得到 $\Pr[\exists v, C(v) \ge k] \le \dfrac{2n}{\sqrt{k}}$，这显然对于 $k = O(n^{2/3})$ 是一个不好的界限。我们可以巧妙地将分母再乘一个 $k$。
>
> 考虑用 $N_k$ 代表位于 $\ge k$ 个点的连通分支的点数，则 $\mathbb E[N_k] = n \Pr[C(v) \ge k]= \dfrac{2n}{\sqrt{k}}$。根据 Markov 不等式，有 $\Pr[N_k \ge k] \le \dfrac{2n}{k^{3/2}}$。取 $k = A n^{2/3}$，则有
$$ \Pr[|\mathcal C_1| \ge An^{2/3}] \le \frac{2}{A^{3/2}} $$

