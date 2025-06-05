# Lecture 9 - 2025 / 3 / 17

### Network Reliability (2)

接下来，对于 $\ge \alpha c$ 个点的割，我们只需要通过说明 
$$ \Pr[\text{some cut of size } \ge c\alpha \text{ fails}] \le \varepsilon p_{\rm fail} $$ 

即可。

> 将 $\ge \alpha c$ 个点的割从小到大排序 $c_1 \le c_2 \le \cdots$。假设至少有 $n^{2\alpha}$ 个割（如若不然，直接得到总概率不超过 $n^{2\alpha}p^{c\alpha}$），那么前面这部分 fail 的概率不超过
> $$ n^{2\alpha}p^{c\alpha} \le n^{2\alpha} n^{-(4+\delta)\alpha} = n^{-(2+\delta)\alpha} \qquad (1)$$
>
> 对于任意 $\beta > 0$，我们知道 $\le \beta c$ 的割不超过 $n^{2\beta}$ 个，从而 $c_{n^{2\beta}}\ge \beta c$，换言之
> $$ c_k \ge \frac c 2 \log_n k \qquad \Rightarrow \qquad p^{c_k} \le p^{\frac c 2 \log_n k} = k^{-2 + \frac \delta 2} $$
>
> 所以 
> $$ 
\begin{aligned}
\Pr[\exists i > n^{2\alpha}, c_{i} \text{ fails}] & \le \sum_{i > n^{2\alpha}} k^{-2 + \frac \delta 2}  \le \int_{n^{2\alpha}} ^{\infty} x^{-2+\frac \delta 2} \text d x \\ & = \frac{n^{-2\alpha (1 + \frac \delta 2)}}{1 + \frac \delta 2} \le n^{-(2+\delta)\alpha}
\end{aligned} (2) $$
> 
> 结合 $(1) (2)$，$ \Pr[\text{some cut of size } \ge c\alpha \text{ fails}] \le 2 n^{-(2+\delta)\alpha} $。
>
> 取 $\alpha = 2 + \dfrac 1 2 \log_n(\dfrac 2 \varepsilon) $，立刻得到 
> $$2 n^{-(2+\delta)\alpha} \le 2 n^{-(2+\delta)(2 + \frac 1 2 \log_n(\frac 2 \varepsilon)) } \le \varepsilon n^{-(4+\delta)} \le \varepsilon p_{\rm fail}$$

综上，直接忽略这些大割，算法可以在 $O(n^{2\alpha} \log n^{2\alpha}) = O(n^4 \varepsilon^{-1} (\log n + \log \varepsilon^{-1}))$ 次调用 $\rm RMinCut$ 内，得到关于 $p_{\rm fail}$ 的 $(1 \pm \varepsilon)^2$ 估计。


### Chernoff Bounds

**Theorem:** 让 $X_1, \cdots, X_n$ 为独立 $[0, 1]$ 变量 $\mathbb E[X_i] = p_i$，$X = \sum\limits_{i=1}^{n} X_i$，$\mu = \mathbb E[X] = \sum\limits_{i=1}^{n} p_i$，$p = \dfrac \mu n$

* $\Pr[X \ge \mu + \lambda] \le \exp( -n H_p(p + \dfrac \lambda n))$，对于 $0 < \lambda < n - \mu$

* $\Pr[X \le \mu - \lambda] \le \exp( -n H_{1-p}(1-p+\dfrac \lambda n))$，对于 $0 < \lambda < \mu$

其中 $H_p(x) = x \ln \dfrac x p + (1-x) \ln \dfrac {1-x}{1-p}$ 为 KL 散度。

> 通过矩生成函数证明。

**Corollary:**

$$ \begin{aligned} \Pr[X \le \mu - \lambda] \\ \Pr[X \ge \mu + \lambda] \end{aligned} \le \exp\left( - \dfrac{2\lambda^2}{n} \right) $$

> 对指数部分求导比较即可。

**Corollary:**

* 对 $0 < \beta < 1$，$\Pr[X \le (1 -\beta) \mu] \le \exp(-\dfrac{\beta^2 \mu}{2})$
* 对 $\beta > 0$，$\Pr[X \ge (1 +\beta) \mu] \le \begin{cases} \exp(-\dfrac{\beta^2 \mu}{2 + \beta}) & \beta > 0 \\ \exp(-\dfrac{\beta^2 \mu}{3}) &  0 < \beta \le 1 \end{cases}$

**Corollary:** 对于 $X_i$ 在 $[a_i, b_i]$ 中取值时，

$$ \begin{aligned} \Pr[X \le \mu - \lambda] \\ \Pr[X \ge \mu + \lambda] \end{aligned} \le \exp\left( - \dfrac{2\lambda^2}{\sum_{i=1}^{n} (b_i - a_i)^2} \right) $$

