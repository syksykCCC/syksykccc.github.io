# Lec1 Convex Sets and Convex Functions

## Goals
- Understand definitions of convex sets/functions
- Learn common convexity tests
- Use Jensen's inequality in simple cases

## Convex Set Definition
A set $C \subseteq \mathbb{R}^n$ is convex if for any $x,y\in C$ and $\theta\in[0,1]$,
$\theta x + (1-\theta)y \in C$.

:::remark 📝 Class Note
Geometrically, convexity means the entire line segment between two points stays inside the set.
:::

## Convex Function Example
A function $f$ is convex if

$$
f(\theta x + (1-\theta)y) \le \theta f(x) + (1-\theta)f(y)
$$

Inline formula: quadratic $f(x)=\frac{1}{2}x^\top Qx+b^\top x$ is convex when $Q\succeq 0$.

:::tip 💡 Lab Tip
Plot contour lines first, then overlay iteration points to observe optimization behavior.
:::

:::warn ⚠️ Warning
Differentiability alone does not imply convexity.
You need extra conditions, e.g. PSD Hessian.
:::

## Summary
Convexity provides the structure that makes optimization analyzable and reliable.
