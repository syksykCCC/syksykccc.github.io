# Lecture 21 - 2025 / 5 / 8

### Lovász Local Lemma

**Lemma:** 设 $A_1, \cdots, A_n$ 是一系列“坏事件”，$\Pr[A_i] \le p$，并且每个 $A_i$ 独立于除最多 $d$ 个其他事件 $A_j$ 之外的所有事件。如果 $ep(d+1)\le1$，则
$$ \Pr\left[ \bigcap_{i=1}^{n} \overline{A_i} \right] > 0 $$

**Claim:** 对于任意任何 $S \subseteq \{1, \cdots, n\}$，对任意 $i$，有 $\Pr\left[  A_i \mid \bigcap_{j\in S} \overline{A_j}\right] \le \dfrac{1}{d + 1}$。

> 对 $m := |S|$ 归纳，$m = 0$ 时 $\Pr[A_i] \le p \le \dfrac{1}{e(d+1)} < \dfrac{1}{d+1}$。
>
> 将 $S$ 分为 $S_1 = S \cap D_i, S_2 = S \backslash S_1$，其中 $D_i$ 为和 $A_i$ 有关的事件集合。
> 
> $$ \Pr\left[  A_i \mid \bigcap_{j\in S} \overline{A_j}\right] = \frac{\Pr\left[  A_i \cap \bigcap_{j \in S_1} \overline{A_j} \mid \bigcap_{k\in S_2} \overline{A_k}\right]}{\Pr\left[  \bigcap_{j \in S_1} \overline{A_j}  \mid \bigcap_{k\in S_2} \overline{A_k} \right]} $$
>
> 分子 $\le \Pr\left[  A_i  \mid \bigcap_{k\in S_2} \overline{A_k}\right] \le \Pr[A_i]$。
>
> 对于分母，不妨设 $S_1 = \{1, 2, \cdots, |S_1|\}$。
$$
\begin{aligned}
\Pr\left[  \bigcap_{j \in S_1} \overline{A_j}  \mid \bigcap_{k\in S_2} \overline{A_k} \right]
& = \prod_{j=1}^{|S_1|} \left( 1 - \Pr\left[A_j \mid \bigcap_{j'< j} \overline{A_{j'}} \cap \bigcap_{k \in S_2} \overline{A_k}\right] \right)\\
& \ge \left( 1 - \frac{1}{d + 1} \right)^{|S_1|} \\
& \ge \left( 1 - \frac{1}{d + 1} \right)^{d} > \frac{1}{e}
\end{aligned}
$$
>
> 从而原式 $\le \dfrac{p}{1/e} = ep \le \dfrac{1}{d+1}$，根据归纳法原命题得证。

根据 Claim，我们有
$$ 
\begin{aligned}
\Pr\left[ \bigcap_{i=1}^{n} \overline{A_i} \right] & = \prod_{i=1}^{n} \left( 1 - \Pr\left[ A_i \mid \bigcap_{j < i} \overline{A_j} \right] \right) \\
& \ge \left( 1 - \frac{1}{d + 1} \right)^n > 0
\end{aligned}
$$

从而 LLL 得证。

#### Example: $k$-SAT

**Claim:** 任何 $k$-CNF $\varphi$，如果每个变量都出现在至多 $\dfrac{2^{k-2}}{k}$ 个 clause 里，则 $\varphi$ 是可被满足的。

> $A_i := $ 第 $i$ 个 clause 不满足，则 $\Pr[A_i] = 2^{-k} = p$，同时 $d = k \cdot \dfrac{2^{k-2}}{k} = 2^{k-2}$。容易验证此时 LLL 的条件满足。
