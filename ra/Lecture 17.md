# Lecture 17 - 2025 / 4 / 17

### Martingale

**Definition (filter):** $\emptyset = \cal F_0 \sube F_1 \sube F_2 \sube \cdots \sube F_n$ 是一个概率空间上的递增 $\sigma$-代数。

例如 $\mathcal F_n = Z_1, \cdots, Z_n$，其中 $Z_i$ 是随机变量。

**Definition (martingale):** $(X_i)$ 是关于 $(\cal F_i)$ 的鞅，如果满足
$$ \mathbb E[X_i \mid \mathcal F_{i-1}] = X_{i-1} $$


### Azuma Inequality

**Lemma:** 对于 r.v. $X$，若 $|X| \le 1, \mathbb E[X] = 0$，则 $\mathbb E[e^{tX}] \le e^{t^2/2}$。
> 根据凸性和 Taylor 展开，$ \mathbb E[e^{tX}] \le \frac{1}{2}\left(  e^t + e^{-t}\right) \le e^{t^2/2}$。

**Theorem:** 设 $(X_i)$ 是关于 $(\mathcal F_i)$ 的鞅，$Y_i = X_i - X_{i-1}$ 是“差异”序列，如果 $c_i > 0$ 使得 $|Y_i| \le c_i$，则
$$
\begin{aligned} \Pr[X_n \ge X_0 + \lambda] \\ \Pr[X_n \le X_0 - \lambda] \end{aligned} \quad \le \ \ \exp\left( -\frac{\lambda^2}{2 \sum_{i=1}^{n} c_i^2} \right)
$$

> 当 $n = 1$ 时，$|X_1 - X_0| \le c_1$，则
> $$ \begin{aligned}
\Pr[X_1 \ge X_0 + \lambda] & = \min_t \Pr[e^{t(X_1 - X_0)} \ge e^{t \lambda}]\\
& \le \min_t \frac{\mathbb E[e^{t(X_1 - X_0)}]}{e^{t\lambda}}\\
& \le \min_t \exp \left(\frac{c_1^2t^2}{2}  - t  \lambda \right)= \exp\left(-\frac{\lambda^2}{2c_1^2} \right) \qquad  \\
\end{aligned} $$ 
>
> 接下来归纳，
> $$\begin{aligned}
\Pr[X_n \ge X_0 + \lambda ] & \le \min_t \frac{\mathbb E[e^{t(X_n - X_{n-1})} \cdot e^{t(X_{n - 1} - X_0)}]}{e^{t \lambda}} \\
& = \min_t \frac{\mathbb E_{\mathcal F_{n-1}}[\mathbb E[e^{t(X_n - X_{n-1})} \mid \mathcal F_{n-1}] \cdot e^{t(X_{n - 1} - X_0)}]}{e^{t \lambda}}\\
& \le \min_t \frac{e^{c_{n}^2 t^2 /2} \cdot\mathbb E[ e^{t(X_{n - 1} - X_0)}]}{e^{t \lambda}}\\
& \le \min_t \frac{e^{c_{n}^2 t^2 /2} \cdot \exp(-\lambda^2 /2\sum_{i=1}^{n-1} c_i^2) }{e^{t \lambda}}\\
& \le \exp\left( -\frac{\lambda^2}{2 \sum_{i=1}^{n} c_i^2} \right)
\end{aligned} $$

### Doob Martingale 

**Claim:** 设 $A, (Z_i)$ 是 r.v.，则 $X_i = \mathbb E[A \mid Z_1, \cdots, Z_i]$ 是鞅，称之为 **$A$ 的 Doob 鞅**。

> 验证定义即可：
$$
\begin{aligned}
 \mathbb E[X_i \mid Z_1, \cdots, Z_{i-1}] & = \mathbb E_{Z_i}[ \mathbb E[X_i \mid Z_1, \cdots, Z_{i}] \mid Z_1, \cdots, Z_{i-1} ]\\
 & = \mathbb E_{Z_i}[\mathbb E[A \mid Z_1, \cdots, Z_{i}] \mid Z_1, \cdots, Z_{i-1} ]\\
 & = \mathbb E[A \mid Z_1, \cdots, Z_{i-1}] = X_{i-1}
\end{aligned} $$

**Definition:** $f(Z_1, \cdots, Z_n)$ 是 **$c$-Lipschitz 函数**，当且仅当改变 $f$ 的任何一个坐标值，$f$ 的变化绝对值不超过 $\pm c$。

**Lemma:** 如果 $f$ 是 $c$-Lipschitz 函数，给定 $Z_1, \cdots, Z_{i-1}$ 的条件下，$Z_i$ 与 $Z_{i+1}, \cdots, Z_n$ 相互独立，则 $f$ 关于 $Z_i$ 的 Doob 鞅 $(X_i)$ 满足 $|X_i - X_{i-1}| \le c$。
> 我们根据定义对 $|X_i - X_{i-1}|$ 进行展开
 $$ 
\begin{aligned}
 & = | \mathbb E_{Z_{i+1}, \cdots, Z_n}[f \mid Z_1, \cdots, {\color{blue}Z_i}] - \mathbb E_{{\color{red}Z_i}, \cdots, Z_{n}}[f \mid Z_1, \cdots, Z_{i-1}]|\\
& = | \mathbb E_{Z_{i+1}, \cdots, Z_n}[f \mid Z_1, \cdots, {\color{blue}Z_i}]- \mathbb E_{Z_{i+1}, \cdots, Z_n} [\mathbb E_{{\color{red}Z_i}}[f \mid Z_1, \cdots, Z_{i-1}, Z_{i+1}, \cdots, Z_n] \mid Z_1, \cdots, Z_{i-1}]|\\
& = | \mathbb E_{Z_{i+1}, \cdots, Z_n}[f(Z_1, \cdots, {\color{blue}Z_i}, \cdots, Z_n) \mid Z_1, \cdots, Z_{i-1}]\\
& \quad - \mathbb E_{Z_{i+1}, \cdots, Z_n} [\mathbb E_{{\color{red}Z_i}}[f(Z_1, \cdots, Z_n) \mid Z_1, \cdots, Z_{i-1}, Z_{i+1}, \cdots, Z_n] \mid Z_1, \cdots, Z_{i-1}]|\\
& = | \mathbb E_{Z_{i+1}, \cdots, Z_n}[f(Z_1, \cdots, {\color{blue}Z_i}, \cdots, Z_n)\\
& \quad - \mathbb E_{\color{red}Z_i}[f(Z_1,\cdots,{\color{red}Z_i}, \cdots, Z_n) \mid Z_1, \cdots, Z_{i-1}, Z_{i+1}\cdots, Z_n] \mid Z_1, \cdots, Z_{i-1}]|\\
& = | \mathbb E_{Z_{i+1}, \cdots, Z_n}[ \mathbb E_{\color{red} Z_i} [f(Z_1, \cdots, {\color{blue}Z_i}, \cdots, Z_n) - f(Z_1,\cdots,{\color{red}Z_i}, \cdots, Z_n)  \\
&\qquad \mid Z_1, \cdots, Z_{i-1}, Z_{i+1}\cdots, Z_n] \mid Z_1, \cdots, Z_{i-1}]|\\
\end{aligned} $$
> 
> 注意这里 $\color{blue} Z_i$ 是已知量，而 $\color{red} Z_i$ 是未知量，可以看作两者是独立同分布的变量。从而每一项均 $\le c$，由此结论成立。

#### Applications: Balls and Bins

$m$ 个球 $n$ 个桶，$Z_i$ 是 $i$ 号球选择的桶，$X = f(Z_1, \cdots, Z_m)$ 是空桶的个数。容易看出 $f$ 是 $1$-Lipschitz 的，从而

$$
\Pr[| X - \mathbb E[X] | \ge \lambda] \le 2 \exp\left ( - \frac{\lambda^2}{2m} \right )
$$

这是 Chernoff bound 所不能得到的结论。

#### Applications: Chromatic Number of $\mathcal G_{n, 1/2}$

染色数 $\chi(G)$ 代表最少需要的颜色数量，使得存在一组同色不相邻的方案。

对于随机图我们有两种常见的鞅。

**Edge Exposure Martingale:** 用 $Z_i = 0/1$ 表示第 $i$ 条边是否在图中出现，则 $A = f\left(Z_1, \cdots, Z_{\binom n 2}\right)$ 的 Doob 鞅是 edge exposure maringle。

**Vertex Exposure Martingle:** 用 $Z_i \in \{0, 1\}^{n-i}$ 代表是否 $i$ 和 $j$（满足 $j>i$）的边是存在的，则 $A = f(Z_1, \cdots, Z_n)$ 的 Doob 鞅是 vertex exposure martingle。

这里我们使用后者，用 $X = f(Z_1, \cdots, Z_n)$ 代表 $\chi(G)$，则容易看出 $f$ 是 $1$-Lipschitz 的。从而

$$
\Pr[| X - \mathbb E[X] | \ge \lambda] \le 2 \exp\left ( - \frac{\lambda^2}{2n} \right )
$$

注意我们不依赖任何关于 $\mathbb E[X]$ 的知识，给出了一个 concentration bound。