# Lec2 Gradient Methods and Convergence

## Goals
- Understand the basic gradient descent iteration
- Develop intuition for step-size selection
- Learn typical convergence statements for smooth convex objectives

## Gradient Descent
Standard update:

$$
x_{k+1} = x_k - \alpha_k \nabla f(x_k)
$$

where $\alpha_k$ is the step size.

:::remark 📝 Class Note
Too large a step can oscillate; too small a step converges slowly.
Backtracking line search is a practical compromise.
:::

## Convergence Sketch
For an $L$-smooth convex function, a common bound is:

$$
f(x_k) - f(x^*) = O\!\left(\frac{1}{k}\right)
$$

:::error ⛔ Common Error
Do not flip the minus sign in the update.
A plus sign moves in the ascent direction.
:::

## Summary
Gradient methods are the core baseline for large-scale optimization and many modern variants.
