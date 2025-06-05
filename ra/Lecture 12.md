# Lecture 12 - 2025 / 3 / 27

### Balls and Bins (2)

**Lemma:** 设 $\cal E$ 是关于 bin loads 的事件，且 $\Pr[\cal E]$ 关于 $m$ 递增是单调上升 / 单调下降的，则 $ \Pr_X[\mathcal E] \le 4 \Pr_Y[\mathcal E]$，其中 $X$ 为 Balls and Bins 模型，$Y$ 为 $n$ 个独立的 $\pi(m/n)$。

> 不妨设 $\Pr[\cal E]$ 单调上升，则
>
> $$ \begin{aligned}
\Pr_Y[\mathcal E] & = \sum_{k=0}^{\infty} \Pr_Y\left[\mathcal E \mid \sum_{i=1}^{n} Y_i = k\right] \Pr\left[ \sum_{i=1}^{n} Y_i = k \right] \\
& \ge \sum_{k=m}^{\infty} \Pr_Y\left[\mathcal E \mid \sum_{i=1}^{n} Y_i = m\right] \Pr\left[ \sum_{i=1}^{n} Y_i = k \right]\\
& \ge \Pr_Y\left[\mathcal E \mid \sum_{i=1}^{n} Y_i = m\right] \Pr\left[ \sum_{i=1}^{n} Y_i \ge m \right]\\
& \ge \Pr_X [\mathcal E] \cdot \frac{1}{4}
\end{aligned}  $$

最后一步用到对于 $\lambda \in \N$，对于 $X \sim \pi(\lambda)$，有 $\Pr[X \ge \lambda] \ge 1/4$。

**Corollary:** $\Pr[\forall i, X_i \le c] \le 4 \Pr[\forall i, Y_i \le c]$

<p style="color: red;">TBD</p>

### Power of 2 Choices (1)

<p style="color: red;">TBD</p>