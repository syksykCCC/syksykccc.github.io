# Lecture 16 - 2025 / 4 / 14

### Johnson & Lindenstrauss Lemma

**Theorem (JL Lemma).** 对于任何 $\R^d$ 上 $n$ 个点的集合 $X$，任何 $\varepsilon \in (0, 1)$，存在一个 $\R^d \to \R^k$ 的映射 $\varphi$，其中
\[ 
k = \left \lceil \frac{4 \ln n}{\varepsilon^2 / 2- \varepsilon^3 / 3} \right \rceil \le \left \lceil \frac{24 \ln n}{\varepsilon^2} \right \rceil
\]

使得 $\forall u, v \in X$，
\[
(1 - \varepsilon) \| u - v \|_2^2 \le \| \varphi(u) - \varphi(v) \|_2^2 \le (1 + \varepsilon) \| u - v \|_2^2
\]

> 考虑随机选择一个坐标系，并保留 $u$ 在其中的前 $k$ 个坐标（的一个倍数）作为 $\varphi(u)$。为了分析这个过程，我们可以对称的看作，对于个固定的标准正交坐标系，$u$ 在 $\mathbb S^{d-1}$ 上均匀随机采样。
>
> 于是我们生成一个随机向量 $X = (X_1, \cdots, X_d)$，其中 $X_i \sim \mathcal N(0, 1)$，可以将 $u$ 表示为 $Z = \frac{1}{\|X\|_2}(X_1, \cdots, X_d)$，降维后的向量定义为 $Y =\varphi(X)= \sqrt{\frac{k}{d}} \cdot \frac{1}{\|X\|_2}(X_1, \cdots, X_k)$。
>
> 需要分析 $L = \dfrac{X_1^2 + \cdots + X_k^2}{X_1^2 + \cdots + X_d^2}$ 的分布。根据对称性，显然有 $\mathbb E[L] = k / d$，于是 $ \mathbb E[\|Y\|_2^2] = 1$。
>
> 根据 Chernoff bound 可以得到
> * $\Pr[\|\varphi(u)\|_2^2 \ge (1 + \varepsilon)] \le \exp(-\frac{k}{2}(\frac{\varepsilon^2}{2} - \frac{\varepsilon^3}{3}))$
> * $\Pr[\|\varphi(u)\|_2^2 \le (1 - \varepsilon)] \le \exp(-\frac{k}{4}\varepsilon^2)$
> 
> 证明过程主要利用了 $\ln(1 - \varepsilon) < (-\varepsilon - \frac{\varepsilon^2}{2})$ 和 $\ln(1 + \varepsilon) < (\varepsilon - \frac{\varepsilon^2}{2} + \frac{\varepsilon^3}{3})$。 
>
> 于是，当 $k$ 满足条件时，$\Pr[|\|\varphi(u)\|_2^2 - 1| > \varepsilon] \le 2 \exp(-2 \ln n) = 2/n^2$。从而根据 union bound，对于所有 $\binom n 2$ 个点对 $(u, v)$，都保距的概率 $\ge \frac{1}{n}$。根据 probabilistic method，可以得到 JL 引理。

### Embedding into $\ell_p$ metrics

**Theorem.** 设 $(X, d)$ 是一个度量空间，$|X| = n$，则 $(X, d)$ 可以被嵌入一个 $\ell_1$ 空间，保距比为 $O(\log n)$，维度 $k = O(\log^2 n)$。

我们通过构造 $m = O(\log^2 n)$ 个随机的 $A_i \sube X$，并定义
\[
\varphi(x) = \frac{1}{m} (d(x, A_1), d(x, A_2), \cdots, d(x, A_m))
\]

其中 $d(x, A_i) = \min_{y \in A_i} d(x, y)$。我们从两个方向分别证明这个构造的合理性。

**Claim.** $\forall x, y \in X, \|\varphi(x) - \varphi(y)\|_1 \le d(x, y)$

> $$ \begin{aligned} \|\varphi(x) - \varphi(y)|_1 & = \frac{1}{m} \sum_{i=1}^m |d(x, A_i) - d(y, A_i)| \\ & \le \frac{1}{m} \sum_{i=1}^m d(x, y) = d(x, y) \end{aligned} $$
> 
> 上式中，第二个不等式是因为，不妨设 $d(x, A_i) \ge d(y, A_i)$，设 $d(y, A_i) = d(y, z)$，其中 $z \in A_i$，则有 $d(x, A_i) - d(y, A_i) \le d(x, z) - d(y, z) \le d(x, y)$。 

我们构造 $\{A_i\}$ 的方法是，对于每个 $t \in \{1, 2, \cdots, \log n\}$，构造 $r \log n$ 个随机集合 $\{A_i^{(t)}\}_{i=1}^{r \log n}$，其中每个 $x \in X$ 都独立均匀的以 $2^{-t}$ 的概率包含在 $A_i^{(t)}$ 中。因此 $A_i^{(t)}$ 的期望大小为 $\dfrac{n}{2^t}$，总共有 $r \log^2 n$ 个集合。

**Claim.** $ \exists c, \forall x, y \in X, \|\varphi(x) - \varphi(y)\|_1 \ge \dfrac{1}{c \log n} d(x, y)$ 

为了证明这个 claim，我们首先定义“球”：
$$
B(x, \rho) = \{z \in X \mid d(x, z) \le \rho\}\\
B^\circ(x, \rho) = \{z \in X \mid d(x, z) < \rho\}
$$

定义一列半径 $0 = \rho_0 < \rho_1 < \cdots$，其中 $\rho_t$ 定义为
$$
\rho_t = \min\{ \rho \mid B(x, \rho), B(y, \rho) \text{ both contain} \ge 2^t \text{ points of }X\}
$$

持续定义这样的 $\rho_t$，直到某一项 $\rho_{t^*} \ge \dfrac{1}{4} d(x, y)$ 时，修改定义这一项为 $\rho_{t^*} = \dfrac{1}{4} d(x, y)$，定义结束。可以看出 $B(x, \rho_t), B(y, \rho_t)$ 永远是不交的。

我们称 $A_i^{(t)}$ 是 _good_ 的当且仅当（两者之一）：

* $\rho_t$ 对于 $B(x, \rho_t)$ 是紧的，而 $A_i^{(t)}$ 与 $B(y, \rho_{t - 1})$ 相交但与 $B^\circ(x, \rho_{t})$ 不交。
* $\rho_t$ 对于 $B(y, \rho_t)$ 是紧的，而 $A_i^{(t)}$ 与 $B(x, \rho_{t - 1})$ 相交但与 $B^\circ(y, \rho_{t})$ 不交。

注意，一个 good 的集合将为 $\| \varphi(x) - \varphi(y)\|_1$ 贡献 $ \dfrac{1}{m} (\rho_t - \rho_{t-1})$。

> 对于任何集合 $A_i^{(t)}$，它 good 的概率有
$$
\begin{aligned}
\Pr[A_i^{(t)} \text{ is good for } x, y] & = \Pr[A_i^{(t)} \cap B^\circ(x, \rho_t) = \emptyset \land A_i^{(t)} \cap B(y, \rho_{t-1}) \neq \emptyset] \\
& \ge \Pr[A_i^{(t)} \cap B^\circ(x, \rho_t) = \emptyset] \cdot \Pr[A_i^{(t)} \cap B(y, \rho_{t-1}) \neq \emptyset]\\
& \ge \left(1 - 2^{-t} \right)^{2^t} \cdot \left(1 - (1 - 2^{-t})^{2^{t-1}} \right) \\
& \ge \frac{1}{4} \cdot \left(1 - \frac{1}{\sqrt{e}} \right) \\ 
\end{aligned}
$$
>
> 第一个不等号是因为两个事件是正相关的，最后一个不等号是因为前者单调递增，后者单调递减。
>
> 因此 $A_i^{(t)}$ 以常数概率是 good 的，对于每个固定的 $t$，$\mathbb E[\# \text{good sets}] \ge \dfrac{r \log n}{12} = \mu$，根据 Chernoff bound，$\Pr[\# \text{good sets} \le \mu / 2] \le \exp(-\mu / 8) = \exp(-r \log n / 96) \le n^{-3}$，这里取 $r = 288$。从而根据 union bound，对于所有的 $x, y, t$ 都成立的概率 $\ge 1 - \log n / n$。
>
> 因此，当上述事件发生时，
$$
\begin{aligned}
\|\varphi(x) - \varphi(y)\|_1 & = \frac{1}{m} \sum_{t=1}^{\log n} \sum_{i=1}^{r \log n} | d(x, A_i^{(t)}) - d(y, A_i^{(t)}) | \\
& \ge \frac{1}{m} \frac{r \log n}{24} \sum_{t=1}^{\log n} (\rho_t - \rho_{t-1}) \\
& = \frac{1}{m} \frac{r \log n}{24} (\rho_{t^*} - \rho_0) \\ 
& = \frac{1}{96 \log n} d(x, y)
\end{aligned}
$$

