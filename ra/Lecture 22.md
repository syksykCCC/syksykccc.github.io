# Lecture 22 - 2025 / 5 / 12

### Packet Routing

<p style="color: red;">TBD</p>

### Asymmetric LLL

**Lemma (General LLL):** 设 $A_1, \cdots, A_n$ 是一系列坏事件，$D_i \sube \{A_1, \cdots, A_n\}$ 是 $A_i$ 相关的事件集合，如果存在实数 $x_1, \cdots, x_n \in [0, 1)$ 使得对所有的 $i$，有 $\Pr[A_i] \le x_i \prod_{j \in D_i} (1 - x_j)$，则 $\Pr[\bigcap_{i=1}^{n} \overline{A_i}] \ge \prod_{i=1}^{n} (1 - x_i) > 0$。

通过带入 $x_i = 2\Pr[A_i]$，有

**Corollary (Asymmetric LLL):** 同上，如果 $\sum_{j \in D_i} \Pr[A_j] \le 1/4$，则 $\Pr[\bigcap_{i=1}^{n} \overline{A_i}] \ge \prod_{i=1}^{n} (1 - 2 \Pr[A_i]) > 0$。

### Frugal Graph Coloring

<p style="color: red;">TBD</p>
