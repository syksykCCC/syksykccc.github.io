# Lecture 7 - 2025 / 3 / 10

### Double hashing

**Claim:** 对于一组 2-universal hashing 把 $S \sube U$ 的元素投影到 $T$，且 $|T| = |S|^2$，则存在碰撞的概率 $\le \dfrac 1 2$。

> $$ \mathbb E[\text{collision}] \le \binom{|S|}{2} \frac{1}{|T|}  \le \frac 1 2 $$

当然哈希表大小为 $O(|S|^2)$ 还是过大，希望能压缩到 $O(|S|)$。

**Claim:** 对于一组 2-universal hashing 把 $S \sube U$ 的元素投影到 $T$，且 $|T| = |S|$。设有 $b_i$ 个元素 $h(x) = i$，则 $\Pr\left[\sum\limits_{i=1}^{|S|} b_i^2 \ge 4 |S|\right] \le \dfrac 1 2$。

> 首先注意到：
> $$\mathbb E[\text{collision}] = \sum_{i=1}^{|S|} \binom {b_i} 2 = \dfrac 1 2 \left(\sum_{i=1}^{|S|} b_i^2 - |S| \right)$$
>
> 另一方面 $\mathbb E[\text{collision}] = \binom{|S|}{2} \dfrac{1}{|T|} \le \dfrac{|S|}{2}$，从而 $\mathbb E\left[\sum\limits_{i=1}^{|S|} b_i^2\right] \le 2|S|$。
>
> 从而由 Markov 不等式立刻得证。

从而可以通过第一次 hash 将值域映射到 $|S|$，对于有 $b_i$ 个冲突的组，再进行一次 hash 将值域映射到 $b_i^2$。从而我们可以在期望 $O(S)$ 次抽取哈希函数，构造一个值域为 $O(S)$ 的无冲突 hash。

### Buffon's needle

平面上一组两两距离为 $1$ 的平行线，现在随机投掷（中心点均匀随机、角度均匀随机）一根长度为 $1$ 的针，那么针与线相交的概率是多少？

$$ \frac{2}{\pi} \int_{\theta = 0}^{\pi}  \int_{d=0}^{1/2 \sin \theta}  1  \text dd  \text d \theta = \dfrac 1 {\pi} \int_{\theta=0}^{\pi} \sin \theta \text d \theta = \frac 2 \pi $$

### Median trick

**Theorem (Unbiased Estimator Theorem):** 对于两两独立的 $X_1, \cdots, X_t$，期望为 $\mu$，方差为 $\sigma^2$，$X = \dfrac 1 t \sum\limits_{i=1}^{t} X_i$，则当 $t \ge \dfrac 1 \delta \cdot \dfrac{\sigma^2}{\epsilon^2 \mu^2}$ 时，
$$ \Pr[|X - \mu| \ge \epsilon \mu] \le \dfrac{\text{Var}[X]}{\epsilon^2 \mu^2} = \dfrac{\sigma^2}{t \epsilon^2 \mu^2} \le \delta $$

现在所以，达到 $\delta$ 的错误率需要通过 $O(\frac 1 \delta)$ 次采样。现在考虑增加一部分随机性，能否通过 $O(\log \frac 1\delta)$ 的样本实现同样的错误率。

**Lemma:** 对于一枚 $\Pr[\text{Head}] \ge \dfrac 3 4$ 的硬币，在 $2s + 1$ 次相互独立投掷中，$\Pr[\#\text{Head} \le s] \le (\dfrac 3 4)^s$。

> $$ \begin{aligned}
\Pr[\#\text{Head} \le s] & \le \sum_{i=0}^{s} \binom {2s + 1}{s} (\frac 3 4)^i (\frac 1 4)^{2s+1 - i}\\
& \le  \left(\sum_{i=0}^{s}\binom{2s+1}{i} \right) (\frac 3 4)^{s} (\frac 1 4)^{s + 1}\\
& \le (\frac 3 4)^{s} \times \frac{2^{2s + 1}}{4^{s+1}} \le (\frac 3 4)^s
\end{aligned} 
$$

从而我们组间完全独立、组内两两独立的生成 $2\log_{3/4} \dfrac{1}\delta + 1$ 组、每组 $\dfrac{4\sigma^2}{\epsilon^2 \mu^2}$ 个样本。对于每组求平均值、再对所有组求中位数。从而可以在 $O(\log \frac 1 \delta)$ 次采样实现 $\delta$ 的错误率。