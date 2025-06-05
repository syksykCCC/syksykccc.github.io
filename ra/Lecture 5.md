# Lecture 5 - 2025 / 3 / 3

### Monotone circuits for the majority function

**Definition (Boolean circuit):** $f : \{0, 1\}^n \to \{0, 1\}$，通过门进行计算，每个门即 $\{0, 1\}^2 \to \{0, 1\}$ 的函数（共 $16$ 种门）。

**Claim:** 几乎所有 $n$ 个输入的 Boolean function 需要 $\Omega(2^n/ n)$ 个门（包括输入门）。
 
> 首先 $n$ 个输入的 Boolean function 有 $2^{2^{n}}$ 种。
>
> 考虑 $S$ 个门能够表达多少种 Boolean function。首先每个门可以选择 $S^2$ 种输入，以及自身有 $16$ 种计算方法，故函数数量不超过 $ (16S^2)^S $。
>
> 将 $S$ 用 $\dfrac{2^n}{16n}$ 带入，由于
> $$ \begin{aligned} S\ln (16 S^2) = \frac{2^n}{16n} \ln\left(16 \cdot \frac{4^n}{16^2n^2}\right) & = \frac{2^n}{16n} (-\ln 16 + n\ln 4 - 2 \ln n) \\ & = 2^n \frac{\ln 2}{8} + \cdots \end{aligned}$$
>
> 另一方面 $ \ln 2^{2^n} = 2^n \ln 2 $，因此 $S < \dfrac{2^n}{16n}$ 时，$\lim\limits_{n \to \infty} \dfrac{(16 S^2)^S}{2^{2^n}} = 0$。

**Definition (monotone circuits):** 一个电路是单调的，当且仅当它的所有门都是单调函数，即：
$$ f(x_1, \cdots, x_n) = 1, \forall i, y_i \ge x_i \Rightarrow f(y_1, \cdots, y_n) = 1 $$

现在考虑众数函数 $\text{Maj}_n(x_1, \cdots, x_n)$，试图找到一个单调电路来实现它。

一个最优的实现 $\text{Maj}_3$ 的电路为（因为只用到了单调的 $\land, \lor$，故这个电路也是单调的）：
$$ (x_1 \land (x_2 \lor x_3)) \lor (x_2 \land x_3)  $$

**Theorem:** 存在一个单调电路计算 $\text{Maj}_n$，$n$ 为奇数，门的数量是 $\text{poly}(n)$，深度是 $O(\log n)$。

![](L5-1.png)

> 考虑一个随机电路 $C$，包含 $D = O(\log n)$ 层的 $\text{Maj}_3$，底层每个 $\text{Maj}_3$ 随机从 $x_1, \cdots, x_n$ 中选择 $3$ 个输入。
>
> 不妨设众数为 $1$，那么底层每个门输入 $1$ 的概率至少为 $p_0 = \dfrac{n+1}{2n} = \dfrac{1}{2} + \dfrac{1}{2n}$。
>
> 如果一个 $\text{Maj}_3$ 的每个输入有 $p$ 的概率为 $1$，那么其输出为 $1$ 的概率为
> $$ f(p) = p^3 + 3p^2(1-p) = 3p^2 - 2p^3 $$
>
> 考虑迭代过程 $p_1 = f(p_0), p_2 = f(p_1),\cdots$，目标为证明在 $O(\log n)$ 次迭代后，$p \ge 1 - 2^{-(n+1)}$，从而根据 union bound，$\Pr[\exists \bm x, C(\bm x) \ne \text{Maj}_n(\bm x) ] \le 2^n \cdot 2^{-(n+1)} = \dfrac 1 2$，根据概率方法立刻得证。
> 
> 1. 第一阶段，$\dfrac{1}{2} + \dfrac{1}{2n} \le p_t \le \dfrac 3 4$，由于步长增大，计算得
> $$ \left(p_{t+1} - \dfrac{1}{2} \right) \ge \dfrac{11}{8} \left (p_{t} - \dfrac{1}{2} \right) $$
> 
>    故在 $O(\log n)$ 步内，$p_t$ 可以达到 $\dfrac{3}{4}$。
> 
> 2. 第二阶段：$p_t \ge \dfrac{3}{4}$，设第一次达到这个要求为 $p_{t_0}$，则：
> $$ (1 - p_{t + 1}) \le 3 (1 - p_t)^2 \le 3 (1 - p_{t_0})^{2^{t+1-t_0}} \le \dfrac{3}{4^{2^{t+1 - t_0}}} $$
>
>    故在 $O(\log  n)$ 步内，$p_t$ 可以达到 $1 - \dfrac{1}{2^{n+1}}$。
>
> 从而总共只需 $D = O(\log n)$ 次迭代即可。
