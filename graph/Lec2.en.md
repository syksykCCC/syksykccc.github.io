# Lec2 - Constraints, Collisions, and Stable Integration

This lecture focuses on three topics: constraint formulation, collision response, and stable integration for real-time simulation.

## 1. Constraint Projection (Position-Based View)
For a constraint $C(x)=0$, a typical correction step is:

$$
x_i' = x_i + w_i\,\Delta x_i,
\quad
\Delta x_i = -\lambda\,\nabla_{x_i}C(x)
$$

Here $w_i$ is often the inverse mass, controlling how much each particle moves.

:::tip 💡 Implementation Tip
Start with distance constraints + pin constraints, then add volume and bending constraints.
:::

## 2. Collision and Contact
A minimal loop:
1. Detect penetration.
2. Correct position along contact normal.
3. Update velocity for restitution and friction.

Inline example: normal impulse can be approximated by $j=-(1+e)\,v_n/\sum w$.

:::warn ⚠️ Caution
If you only correct positions and ignore velocities, penetration may reappear next frame as jitter.
:::

## 3. Stable Integration and Lab Metrics
Semi-implicit Euler is a common practical choice:

$$
v_{t+\Delta t}=v_t+\Delta t\,M^{-1}f_t,
\quad
x_{t+\Delta t}=x_t+\Delta t\,v_{t+\Delta t}
$$

Useful logs:
- iteration count vs. constraint error
- frame rate vs. penetration depth
- damping vs. visual realism

:::remark 📝 Remark
"Stable" means a balance among controllable numerics, believable visuals, and acceptable performance.
:::

:::error ⛔ Frequent Pitfall
A flipped collision normal can pull objects into colliders, and parameter tuning will not fix it.
:::
