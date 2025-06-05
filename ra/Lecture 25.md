# Lecture 25 - 2025 / 5 / 22

### Graph Colorings

给定一张无向图 $G = (V, E)$，最大度数为 $\Delta$，$k$ 种颜色。目标是随机生成一个 $k$-着色，使得同色不相邻。

考虑如下过程：

1. 随机选择结点 $v$ 和颜色 $c$
2. 如果 $v$ 可以用 $c$ 染色，即染

**Theorem:** 如果 $k \ge 4 \Delta + 1$ 则这个 Markov 链的混合时间为 $O(n \log n)$。

> 定义一个 coupling：$X_t$ 和 $Y_t$ 每次选择同样的 $v, c$，用 $D_t$ 表示 $X_t, Y_t$ 不同色的结点，$d_t = |D_t|$，目标则是计算 $d_t = 0$ 所需的时间。
>
> * 好的操作：如果 $v \in D_t$，且 $c$ 对 $X_t, Y_t$ 都合法，则 $d_{t+1} = d_t - 1$。好的操作数量 $\ge d_t(k - 2\Delta)$。
> * 坏的操作：如果 $v \in V \backslash D_t$，且 $c$ 对 $X_t, Y_t$ 当中的一个合法、另一个不合法，则 $d_{t+1} = d_t + 1$。坏的操作数量 $\le 2 d_t \Delta$。这可以通过枚举 $v$ 的异色邻居计数。
>
> 从而 $\mathbb E[d_{t+1} \mid d_t] \le d_t + d_t \dfrac{4\Delta - k}{kn} \le d_t (1 - 1/kn)$。进而 $\mathbb E[d_t \mid d_0] \le d_0 (1 - 1/kn)^t$。取 $t  = C kn \log n$，结合 $d_0 \le n$ 有 $\mathbb E[d_t] \le 1 / 2e$。

**Theorem:** 如果 $k \ge 3 \Delta + 1$ 则这个 Markov 链的混合时间为 $O(n \log n)$。

> 我们通过设计一个更好的 coupling 来证明。具体而言，$X_t$ 和 $Y_t$ 每次选择同样的 $v$，但 $X_t$ 选择颜色 $c$ 时：
> * 如果 $X_t, Y_t$ 中都可以用 $c$ 染色，则 $Y_t$ 也选择颜色 $c$。
> * 如果 $X_t, Y_t$ 中都不可以用 $c$ 染色，则 $Y_t$ 也选择颜色 $c$。
> * 如果 $X_t$ 可以用 $c$ 染色，$Y_t$ 不可以，则 $Y_t$ 尽量选择一个可以染色的颜色。
> * 如果 $X_t$ 不可以用 $c$ 染色，$Y_t$ 可以，则 $Y_t$ 尽量选择一个不可以染色的颜色。
>
> 上述定义的思路是“将 $N_X(v) \backslash N_Y(v)$ 和 $N_Y(v) \backslash N_X(v)$” 尽量配对起来，其中 $N(v)$ 表示与 $v$ 邻居的颜色集合。从而好的操作数量仍然为 $d_t(k - 2 \Delta)$，而坏的操作数量 $\le d_t \Delta$，缩小了一半。从而好坏操作的差 $\le d_t(3\Delta - k)$。

**Theorem:** 如果 $k \ge 2 \Delta + 1$ 则这个 Markov 链的混合时间为 $O(n \log n)$。

> 我们只需对上面的 coupling 进行更为精细的分析。事实上，好坏操作的差为 $$d_tk - \sum_{v \in D_t} |N_X(v) \cup N_Y(v)| - \sum_{v \in V \backslash D_t} \max\{ |N_X(v) \backslash N_Y(v)|, |N_Y(v) \backslash N_X(v)| \} $$
>
> 采用贡献法，对于每个 $v \in D_t$ 及其邻居构成的有序二元组 $(v, u)$，如果 $u \in D_t$，则这条边分别在第一个求和 $v$ 时贡献两次，如果 $u \in V \backslash D_t$，则这条边在第一个求和 $v$ 时贡献一次，在第二个求和 $u$ 时贡献一次。从而总贡献量不超过 $2 d_t \Delta$，即好坏操作的差 $\le d_t(2\Delta - k)$。

### Algorithmic LLL

**Theorem:** 对于任何 $k$-SAT 问题 $\phi$，如果每个变量至多在 $\dfrac{2^{k-d}}{k}$ 个子句出现，则该实例是可满足的，且赋值可以在多项式时间内构造得到。

解的存在性是 LLL 的经典应用，考虑如何构造。首先给 $\phi$ 随机赋值，然后每次取出一个尚未满足的子句 $C$，将其中的每个变量重新随机赋值。直到所有子句都满足为止。

```C
Solve(φ):
    Pick a random assignment of φ
    while there is an unsatisfiable clause C
        Fix(C)
Fix(C):
    Replace the variables of C with new random values
    while there is clause D that shares a variable with C that is not satisfied
        Fix(D)
```

下面从 Kolomogrov 复杂度的角度给出证明这个算法终止性证明。

> 考虑随机串是“不可压缩的”，那么进行 $F$ 次修复就需要 $Fk$ 个 bit。但是现在更换方式为记录最终赋值和修复历史 $C_1, C_2, \cdots, C_F$，可以看出通过这些信息足够恢复出所用到的所有随机 bit。因为修复一个 clause 前这个 clause 一定是完全不满足的，而最后一次被修复的信息又可通过最终赋值获得。
>
> 从而记录随机串只需要 $c + n+ F (k-d)$ 个 bit，其中 $c$ 是常数。最后一项是因为被 `Solve` 调用的 `Fix` 可以用 $m \log m$ bit 记录，$m$ 是子句数目。而递归调用的 `Fix` 涉及的 clause $D$ 是与 $C$ 有交的，因此只需要 $\log 2^{k-d} = k-d$ bit 记录。
>
> 综上 $c+n+F(k-d) \ge Fk$ 可以推出 $F$ 是多项式级别的。结合随机串高概率 Kolomogrovly random 可知结论成立。
