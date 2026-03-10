# Lec1 - Discrete Modeling for Physical Simulation

Goal: convert continuous physical systems into computable discrete forms, and understand first-order numerical stability constraints.

## 1. Mass-Spring Abstraction
- Discretize deformable objects into nodes and edges.
- Each edge acts as a spring with rest length $L_0$ and stiffness $k$.
- A common spring force model is $F_{ij}=-k(\|x_i-x_j\|-L_0)\hat{d}_{ij}$.

$$
m_i \frac{d^2x_i}{dt^2}=\sum_{j\in \mathcal N(i)} F_{ij}+F_i^{ext}
$$

:::tip 💡 Modeling Intuition
Validate topology first, then tune parameters. Wrong connectivity cannot be fixed by parameter tuning.
:::

## 2. Time Discretization
Use time steps $t, t+\Delta t, t+2\Delta t$.

- Explicit Euler: simple, but unstable for stiff systems.
- Semi-implicit Euler: update velocity first, then position; usually more robust.

```text
v_{t+\Delta t} = v_t + \Delta t * a_t
x_{t+\Delta t} = x_t + \Delta t * v_{t+\Delta t}
```

:::warn ⚠️ Stability Note
Large $k$ with large $\Delta t$ often introduces high-frequency oscillation and divergence.
:::

## 3. Suggested Lab Logging
- Keep mesh topology fixed, vary one variable each run.
- Track max displacement, energy trend, and penetration behavior.
- Save key frames for post-analysis.

:::remark 📝 Remark
Good discretization preserves the right dynamics under a realistic compute budget.
:::

:::error ⛔ Frequent Pitfall
Mixing units across gravity, damping, and spring force can make motion look plausible but physically invalid.
:::
