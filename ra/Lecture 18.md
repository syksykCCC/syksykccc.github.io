# Lecture 18 - 2025 / 4 / 21

### Quick Sort

考虑随机版本的快速排序算法
```python
def QuickSort(a : list[int])
  x = random element in a
  a1 = [ y in a | y < x ]
  a2 = [ y in a | y > x ]
  QuickSort(a1)
  QuickSort(a2)
```

定义 $Q_n$ 为对于大小为 $n$ 的集合 $S$ 进行快速排序所需要的比较次数，$q_n = \mathbb E[Q_n]$，经典地，有：

$$
\begin{aligned}
q_n & = (n - 1) + \frac{1}{n} \sum_{j=1}^{n} (q_{j-1} + q_{n-j}) \\
q_n & = 2 n \ln n  - (4 -2 \gamma) n + 2 \ln n + O(1)
\end{aligned}
$$

其中 $\gamma$ 是欧拉常数，现在考虑给 $Q_n$ 一个 concentration bound。一个构造鞅的想法是记递归树上前 $k$ 层的分割结果为 $\mathcal F_k$，取 $Q_n$ 关于 $(\mathcal F_i)$ 的 Doob 鞅。但是以第 $1$ 层划分为例，划分在最边上和最中间造成的差异远超常数级别。因此 $\mathbb E[Q_n \mid\mathcal F_k]$ 并不满足 Azuma inequality 的使用条件。

回归 Azuma inequality 的证明过程，我们需要给予 $\mathbb E[e^{t(X_k - X_{k-1})} \mid \mathcal F_{k-1}]$ 一个上界。假设 $\mathcal F_{k-1}$ 中记录了第 $k-1$ 层时，各段长度为 $L_1, L_2, \cdots, L_m$，则各个段之间相互独立。定义 $T_j := \mathbb E[Q_{L_j} \mid \mathcal F_k^{(j)}] - \mathbb E[Q_{L_j}]$，则显然
$$
|T_j| = |(L_j - 1 + q_{L_1'} + q_{L_2'}) - q_{L_j}| \le L_j
$$

上式在“最不平均”的分割时贴近取等，从而

$$
\begin{aligned}
\mathbb E[e^{t(X_k - X_{k-1})} \mid \mathcal F_{k-1}] 
& = \mathbb E[e^{t\sum_{j=1}^{m} T_j}]\\
& = \prod_{j=1}^{n}\mathbb E[ e^{t T_j}]\\
& \le \prod_{j=1}^{n} \exp\left(\frac{1}{2} t^2 L_j^2\right)\\
& \le \exp\left(  \frac{1}{2} t^2 (\max_{j=1}^{m} L_j) n \right) \quad(*)
\end{aligned}
$$

第一个 $\le$ 使用了和证明 Azuma 相同的 Lemma，第二个 $\le$ 把每一项的一个 $L_j$ 放缩成了 $\max L_j$。

**Lemma:** $\forall 0 < \alpha < 1$，当 $k > \ln \dfrac{1}{\alpha}$，对于第 $k$ 层的 $L_1, L_2, \cdots, L_m$，有
$$ \Pr[\max_{j=1}^{m} L_j \ge \alpha n] \le \alpha \left( \frac{2e \ln \frac{1}{\alpha}}{k} \right)^k $$
> 看作如下过程：第 $1$ 层随机采样 $U_1 \sim \mathrm U[0, 1]$，将长度为 $n$ 的区间划分为长度为 $U_1 n$ 和 $(1-U_1) n$ 的两段，然后第二层采样 $U_2, U_3 \sim \mathrm U[0, 1]$，分别表示左、右区间的划分点，然后第三层再采样 $U_4, U_5, U_6, U_7 \sim \mathrm U[0, 1]$……
>
> 第 $k$ 层划分结束产生 $2^{k}$ 个区间，$L_j$ 的长度可以视作 $n \cdot U_1 \cdot U_{2/3} \cdots U_{2^{k-1}/\cdots/2^{k}-1}$，上式即
$$
\begin{aligned}
\Pr\left[\left(\max_{j=1}^{2^k} \prod_{i=1}^{k} n \cdot U_1 \cdots \right)\ge \alpha n\right] 
& \le 2^k \cdot \Pr\left[\prod_{i=1}^{k} U_i \ge \alpha\right] \\
& \le 2^k \cdot \Pr\left[\sum_{i=1}^k \ln U_i \ge \ln \alpha\right]
\end{aligned}
$$
>
> 注意到 $-\ln U_i \sim \mathrm{Exp}(1)$，从而 $-\sum_{i=1}^{k} \ln U_i \sim \Gamma(n, 1)$，
$$
\begin{aligned}
\Pr\left[\sum_{i=1}^k \ln U_i \ge \ln \alpha\right] 
& \le \Pr_{X \sim \Gamma(k, 1)} [-X \ge \ln \alpha]\\
& = \min_{t>0}\Pr_{X \sim \Gamma(k, 1)}[(\alpha e^{X})^t \le 1]\\
& = \min_{t>0} \mathbb E_{X \sim \Gamma(k, 1)}[(\alpha e^X)^t]\\
& = \min_{t > 0} \alpha^t (1-t)^{-k}
\end{aligned}
$$
>
> 当 $1 - t = k / \ln \dfrac{1}{\alpha}$ 时，上式为 $\alpha \left( \dfrac{e \ln \frac{1}{\alpha}}{k} \right)^k$，结合 union bound 给出的 $2^k$ 原命题得证。


接下来我们分 $3$ 个阶段分析快速排序过程：

1. 对于前 $k_1$ 层，比较次数不超过 $k_1 n$
2. 对于 $k_1+1 \sim k_2$ 层，高概率有 $k_1$ 层的 $\max L_j \le \alpha n$ $(1)$，从而 $(*) \le \exp\left(\dfrac{1}{2} t^2 \alpha n^2\right)$ 
3. 对于 $k_2$ 层，高概率有 $\max L_j < 2$ $\ (2)$，从而算法停止。
 

**Theorem:** $\forall \varepsilon > 0$，$\Pr[|Q_n - q_n| \ge \varepsilon q_n] \le n^{-(2 + o(1))\varepsilon \ln \ln n}$
> 根据上述 Lemma，事件 $(1), (2)$ 均发生的概率 $\ge$
$$ 1 - \alpha\left( \frac{2e \ln \frac 1 \alpha}{k_1} \right)^{k_1} - \frac{2}{n} \left(  \frac{2e \ln \frac{n}{2}}{k_2}\right)^{k_2} $$
>
> 假设这两个事件发生，对于 $k_1 + 1\sim k_2$ 层，根据 $(*)$，类比于 Azuma inequality 得到
$$ \Pr[|Q_n - q_n| \ge k_1 n + \lambda] \le 2 \exp\left( -\frac{\lambda^2}{2(k_2 - k_1) \alpha n^2} \right) $$
>
> 只需取得 $k_1 n + \lambda \le \varepsilon q_n$，并让上述 $3$ 个概率之和为 $n^{-(2 + o(1))\varepsilon \ln \ln n}$ 时，原命题即证毕。

接下来为琐碎的调参工作，首先希望 $k_2$ 尽量小，取 $\color{blue}k_2 = (\ln n)(\ln \ln n)$，则
$$ \frac{2}{n} \left(  \frac{2e \ln \frac{n}{2}}{k_2}\right)^{k_2} \sim \exp\left( (\ln n)(\ln\ln n)(-\ln\ln\ln n)  \right) $$

接下来为了 $k_1$ 尽量大，但必须有 $k_1 \le n^{-1} (\varepsilon q_n - \lambda) \sim \color{red} 2\varepsilon \ln n - \dfrac{\lambda}{n}$，这里希望 $2 \varepsilon \ln n$ 是主导项，需要 $\color{red}\lambda = o(\varepsilon n \ln n)$。从而可以令 $ \color{blue}k_1 = 2 \varepsilon \ln n - \dfrac{2\lambda}{n}$

$$ 2 \exp\left( -\frac{\lambda^2}{2(k_2 - k_1) \alpha n^2} \right) \sim \exp\left(- \frac{\lambda^2}{(\ln n)(\ln \ln n) n^2\alpha} \right) \qquad \rm (A) $$

同时有（注意 $\alpha < 1$） $$ \alpha\left( \frac{2e \ln \frac 1 \alpha}{k_1} \right)^{k_1} \sim \exp\left( 2\varepsilon \ln n \ln \ln \frac{1}{\alpha} \right) \qquad \rm (B) $$

$\rm (A)$ 式希望 $\lambda$ 尽可能大一些，故取 $\color{blue} \lambda = \dfrac{\varepsilon n \ln n}{\ln \ln n}$，$\rm (A)$式变为 
$$
\exp\left( \frac{\varepsilon^2 \ln n \ln \ln n}{\alpha} \right)
$$

通过权衡两式，取 $\color{blue}\alpha = \dfrac{\varepsilon^2}{\ln\ln n}$，则 $\rm (A)$ 式为 $\exp(-\ln n (\ln \ln n)^2)$，$\rm (B)$ 式为
$$ \exp(-2\varepsilon \ln n\ln \ln n + O(\ln \ln \ln n)) $$


**Corollary:** $\forall \varepsilon > 0$，$\Pr[|Q_n - q_n| \ge \varepsilon q_n] = n^{-(2 + o(1))\varepsilon \ln \ln n}$



### Optional Stopping Theorem

**Definition (Stopping time):** $(\mathcal F_i)$ 是一组 filter，一个 r.v. $T \in \{0, 1, \cdots\} \cup\{\infty\}$ 是一个 $(\mathcal F_i)$ 的**停时**如果事件 $T = i$ 是 $\mathcal F_i$-可测的。

**Theorem (Optinal stopping theorem):** $(X_i)$ 是一个鞅，$T$ 是一个关于 $(\mathcal F_i)$ 的停时，则当下面条件成立时：
1. $\Pr[T < \infty] = 1$
2. $\mathbb E[|X_T|] < \infty$
3. $\mathbb E[X_i \cdot 1\{T > i\}] \to 0$ 当 $i \to \infty$ 时。

或者更强一些，满足：
1. $\mathbb E[T] < \infty$
2. $\mathbb E[|X_i - X_{i-1}| \mid \mathcal F_i] \le c$ 对任意 $i$

则此时有 $\mathbb E[X_T] = \mathbb E[X_0]$。

### Gambler's Ruin

考虑从 $0$ 处开始随机游走，$1/2$ 概率 $+1$，$1/2$ 概率 $-1$。第一次到达 $-a$ 或 $b$ 的时候停止。

定义 $T$ 为上述停时，可以验证坐标位置 $(X_i)$ 是一组鞅，并且满足停时定理的条件，则
$$ \mathbb E[X_T] = p \cdot (-a) + (1 - p) \cdot b = 0$$

解出 $p = \dfrac{b}{a + b}$，即首先碰到 $-a$ 的概率。

接下来定义 $Y_i = X_i^2 - i$ 以分析 $\mathbb E[T]$。

**Claim:** $(Y_i)$ 是一组关于 $(X_i)$ 的鞅。

> $$\mathbb E[Y_i \mid X_1, X_2, \cdots, X_{i-1}] = \frac{1}{2} \left((X_{i-1} - 1)^2 + (X_{i-1} + 1)^2 \right)-i = X_{i-1}^2 - (i-1)=Y_{i-1}$$

从而 $\mathbb E[Y_T] = \mathbb E[X_T^2] - \mathbb E[T] = \mathbb E[Y_0] = 0$，即 $\mathbb E[T] = \mathbb E[X_T^2] = a^2 \dfrac{b}{a + b} + b^2 \dfrac{a}{a + b} = ab$。

