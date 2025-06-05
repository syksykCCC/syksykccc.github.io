# Lecture 11 - 2025 / 3 / 24

### Hamilton Cycles (2)

**Claim:** 在 $G'$ 中，$\{y \in N(x)\}$ 是互相独立的事件，且每个以 $\dfrac p 2$ 的概率发生。

> 首先 $\Pr[y \in N(x)] = p \cdot (\dfrac p 4 + (\dfrac 1 2 - \dfrac p 4)) = \dfrac p 2$。
>
> 其次由于下式，立刻得到独立性：
> $$ \Pr[y \in N(x) \land x \in N(y)]  = p \cdot \dfrac p 4 = \dfrac {p^2} 4 = \Pr[y \in N(x)]\Pr[x \in N(y)] $$

**Claim:** 取 $p \ge 72 \dfrac{\ln n}{n-1}, G \in \mathcal G(n, p)$，w.h.p. _choose_ 的实现方法保证了每个点以均等的概率 $\dfrac{1}{n-1}$ 作为新的端点。

> 我们假设始终有 $N(x) \backslash \textit{OLD}(x) \ne \varnothing$（接下来会证明），那么
> 1. 对于 $y \in \textit{OLD}(x)$，有 $\Pr[\textit{choose} \text{ picks } y ] = \dfrac{|\textit{OLD}(x)|}{n-1} \cdot \dfrac{1}{|\textit{OLD}(x)|} = \dfrac{1}{n-1} $
> 2. 对于 $y \notin \textit{OLD}(x)$，类似可知也为 $\dfrac{1}{n-1}$。
> 
> 值得注意的是，这里 $G$ 也为随机性来源之一，我们是从观察者视角计算概率，也即我们只能根据 _choose history_ 对 $G$ 进行假设。

**Claim:** 在 $4 n\ln n$ 步内，w.h.p $\forall x, N(x) \backslash \textit{OLD}(x) \ne \varnothing$。
> 我们对于一个 fixed $x$，说明 $\Pr [ N(x) \backslash \textit{OLD}(x) = \varnothing ] = O(\dfrac 1 {n^2})$ 即可通过 union bound 证明原结论。
>
> 首先 $\Pr[|N(x)| \le 24 \ln n] \le \dfrac{1}{n^2}$，这是因为 $|N(x)| \sim B(n-1, \frac p 2)$，所以 $\mathbb E[|N(x)|] = 36 \ln n$。我们根据 Chernoff bound 即可得证。
> 
> 接下来 $\Pr[|\textit{OLD}(x)| \ge 24 \ln n] \le \dfrac{1}{n^2}$，这是因为，$x$ 作端点的次数 $ \sim B(4n \ln n, \frac{1}{n-1})$，而 $|\textit{OLD}(x)|$ 显然不会超过这个次数，故由 Chernoff bound 再次得证。

### Balls and Bins (1)

考虑将 $m$ 个球独立均匀放进 $n$ 个桶里，设第 $i$ 个桶里 $X_i$ 个球，那么
$$
\Pr[X_1 = k_1, \cdots, X_n = k_n] = \dfrac{1}{n^m} \dfrac{m!}{k_1!\cdots k_n!}
$$

另一方面，假设 $Y_1, \cdots, Y_n$ 是一列独立服从 $\pi(\lambda)$ 的变量，
$$
\begin{aligned}
\Pr[Y_1 = k_1, \cdots, Y_n = k_n] & = \prod_{i=1}^{n} \dfrac{e^{-\lambda} \lambda^{k_i}}{k_i!} \\
\Pr\left[\sum_{i=1}^{n} Y_i = m\right] & = \dfrac{e^{-\lambda n} (\lambda n)^{m}}{m!}
\end{aligned}
$$

从而我们有 $\Pr[X_1 = k_1, \cdots, X_n = k_n] = \Pr[Y_1 = k_1, \cdots, Y_n = k_n \mid \sum_{i=1}^{n} Y_i = m]$。

**Theorem:** 将 $n$ 个球独立均匀放进 $n$ 个桶里，最大负载量 w.h.p 是 $O(\dfrac{\ln n}{\ln \ln n})$。

> 记 $\mathcal{E}_1$ 表示某个桶的球个数 $> (1+\varepsilon)\dfrac{\ln n}{\ln \ln n}$ 我们需要证明 $ \Pr [\mathcal{E}_1] = o(1)$。
> 
> 由于 $X_1 \sim B(n, \frac{1}{n})$，有
> $$ 
\begin{aligned}
\Pr[X_1 > (1+\varepsilon)\dfrac{\ln n}{\ln \ln n}] 
& \le \left( \frac{e \ln \ln n}{(1 + \varepsilon) \ln n} \right)^{(1 + \varepsilon) \ln n /\ln \ln n}\\
& = \exp\left ( (1 + \varepsilon) \frac{\ln n}{\ln \ln n} \cdot (1  + \ln \ln \ln n - \ln (1 + \varepsilon) - \ln \ln n ) \right)\\
& = \exp( - \Theta((1 + \varepsilon) \ln n) ) = o(n^{-1})
\end{aligned}$$
>
> 从而根据 union bound 得证。