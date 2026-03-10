# Lec2 - Fundamentals of Physics Simulation

This lecture lays out the common pipeline behind simulation in computer graphics: choose a physical model, discretize space, discretize time, and solve the resulting equations numerically. The same pipeline reappears later in cloth, fluids, rigid bodies, and deformation.

## 1. The Big Picture

Computer graphics is not only modeling and rendering. A large part of modern graphics also depends on simulation and animation, which is why physical laws, constraints, and numerical methods become core tools.

The summary below is a good mental map for the whole lecture.

![Overview of the three building blocks](./lec02_materials/fundamentals-overview.png)

### 1.1 Three building blocks of a simulator

- **Mathematical model.** Write the governing equations, usually from physical laws plus geometric constraints.
- **Spatial discretization.** Decide how the state is stored in memory: particles, meshes, grids, or hybrids.
- **Time integration.** Replace continuous evolution by step-by-step updates over $\Delta t$.
- **Numerical solver.** Solve the linear or nonlinear equations produced by the previous two choices.

### 1.2 Why numerical simulation is unavoidable

For a single particle, some systems admit closed-form solutions. For example, projectile motion under gravity can be written analytically as

$$ x(t)=v_0\cos\theta\, t,\qquad y(t)=H+v_0\sin\theta\, t-\frac12 g t^2. $$

For continua or large coupled systems, exact solutions are usually unavailable or too expensive. That is why we approximate the physics with discrete states and numerical updates.

## 2. Mathematical Models: ODEs and PDEs

### 2.1 From particles to fields

For a particle or material point, Newton's law gives

$$ m_p \frac{d^2 \mathbf{x}_p(t)}{dt^2} = \mathbf{f}(\mathbf{x}_p,t). $$

If we separate motion description from its cause, we get two questions that appear throughout simulation:

- **Kinematics: How things move?**
- **Dynamics: Why things move?**

For a particle moving in a velocity field,

$$ \frac{d\mathbf{x}_p(t)}{dt}=\mathbf{v}(\mathbf{x}_p,t),\qquad \frac{d^2\mathbf{x}_p(t)}{dt^2}=\frac{\mathbf{f}(\mathbf{x}_p,t)}{m_p}. $$

### 2.2 Two viewpoints: Lagrangian and Eulerian

![Lagrangian and Eulerian viewpoints](./lec02_materials/lagrangian-vs-eulerian.png)

- **Lagrangian viewpoint.** Track identifiable material points. The state is typically position and velocity, so the mathematics is often an ODE.
- **Eulerian viewpoint.** Fix attention on locations in space and evolve fields such as density, pressure, or velocity. The mathematics is often a PDE.

A good rule of thumb is: Lagrangian methods follow particles; Eulerian methods follow distributions.

:::remark 📝 Question: Why do ODEs usually go with the Lagrangian view, while PDEs often go with the Eulerian view?
A Lagrangian state depends mainly on time once a particle identity is fixed, so ordinary time derivatives are enough. An Eulerian field varies over both space and time, so spatial derivatives such as $\nabla u$ or $\Delta u$ naturally appear, which leads to PDEs.
:::

### 2.3 **Nth-order ODEs**

The slide gives the general form

$$ \mathbf{x}^{[n]} = f\!\left(t,\mathbf{x},\dot{\mathbf{x}},\ddot{\mathbf{x}},\ldots,\mathbf{x}^{[n-1]}\right). $$

To solve an $n$th-order ODE, we need $n$ initial conditions:

$$ \mathbf{x}(t_0)=\mathbf{x}_0,\quad \dot{\mathbf{x}}(t_0)=\dot{\mathbf{x}}_0,\quad \ldots,\quad \mathbf{x}^{[n-1]}(t_0)=\mathbf{x}^{[n-1]}_0. $$

A standard trick is to rewrite a higher-order ODE as a first-order system. For the mass-spring oscillator,

$$ m\frac{dv}{dt}=-kx,\qquad \frac{dx}{dt}=v. $$

Define

$$ \mathbf{y}=\begin{bmatrix} v \\ x \end{bmatrix},\qquad A=\begin{bmatrix} m & 0 \\ 0 & 1 \end{bmatrix},\qquad \mathbf{f}(\mathbf{y})=\begin{bmatrix} -kx \\ v \end{bmatrix}. $$

Then the system becomes

$$ A\dot{\mathbf{y}}=\mathbf{f}(\mathbf{y}),\qquad \dot{\mathbf{y}}=A^{-1}\mathbf{f}(\mathbf{y}). $$

### 2.4 Initial-value and boundary-value problems

For ODEs, the common case is an **initial value problem**: all required conditions are given at one time $t_0$.

The lecture also points out a trickier case: conditions may be distributed over different locations or different times. That viewpoint connects naturally to **boundary value problems**, which are even more central in PDEs.

### 2.5 **Partial differential equations (PDEs)**

A PDE involves derivatives with respect to multiple independent variables, typically space and time. A canonical example is the diffusion or heat equation:

$$ \frac{\partial u}{\partial t}=\frac{\partial^2 u}{\partial x_1^2}+\frac{\partial^2 u}{\partial x_2^2}+\cdots+\frac{\partial^2 u}{\partial x_n^2}=\nabla\cdot\nabla u=\Delta u. $$

PDE solutions are defined not only by initial conditions but also by boundary conditions on the spatial domain.

:::remark 📝 Question: Why do PDE problems care so much about boundary conditions?
Because spatial derivatives do not determine what happens at the edge of the domain. The same PDE can produce different solutions under Dirichlet, Neumann, or mixed boundary conditions, so the boundary behavior is part of the model, not an implementation detail.
:::

## 3. Spatial Discretization

### 3.1 Common representations

The lecture emphasizes three standard choices.

- **Particles.** Simple and easy to trace through time, but they do not partition space, so spatial queries and integration can be harder.
- **Meshes.** Easy to map data to a moving surface or volume boundary, but mesh generation and remeshing are hard.
- **Grids.** Structurally simple and computationally efficient, but they track moving shapes poorly and struggle with non-grid-aligned boundaries.
- **Hybrids.** Combine multiple structures and inherit both their advantages and their mapping cost.

### 3.2 Particle systems

A particle system stores per-particle mass, position, velocity, and force. In matrix form we stack all particle states into long vectors:

$$ \mathbf{x}=\begin{bmatrix}\mathbf{x}_0\\ \vdots\\ \mathbf{x}_{n-1}\end{bmatrix}\in\mathbb{R}^{3n},\qquad \mathbf{v}=\begin{bmatrix}\mathbf{v}_0\\ \vdots\\ \mathbf{v}_{n-1}\end{bmatrix}\in\mathbb{R}^{3n}. $$

Masses become a stacked scalar vector $\mathbf{m}$ or a diagonal matrix $M$, so Newton's law is written as

$$ \mathbf{f}=M\frac{d\mathbf{v}}{dt},\qquad \frac{d\mathbf{v}}{dt}=M^{-1}\mathbf{f}. $$

Particle systems often need neighborhood queries, so data structures such as grid hash tables or KD-trees become practical necessities.

### 3.3 Meshes

A mesh keeps the same state variables as particles at the vertices, but also stores connectivity:

- Triangle list: index triples such as $(0,1,2)$.
- Edge list: unique vertex pairs.
- Neighboring triangle list: adjacency information across edges.

This extra topology is exactly what makes meshes useful for surfaces, shells, and tetrahedral solids.

### 3.4 Regular grids and staggered grids

![Regular grid and staggered grid](./lec02_materials/regular-vs-staggered-grid.png)

On a regular grid, scalar quantities such as temperature, pressure, or concentration are usually stored at cells or grid nodes.

On a staggered grid, different vector components are stored at different geometric locations. In 2D MAC-style layout, horizontal velocity lives on vertical faces and vertical velocity lives on horizontal faces. This reduces checkerboard artifacts and makes discrete divergence operators more reliable.

### 3.5 Interpolation

When a value is known only at sample points, interpolation reconstructs a value inside the cell or element.

**Linear interpolation (1D):**

$$ f(t)=(1-t)f_1+t f_2. $$

**Bilinear interpolation (2D):**

$$ f(s,t)=(1-s)(1-t)f_1+s(1-t)f_2+st f_3+(1-s)t f_4. $$

**Trilinear interpolation (3D):**

$$ \begin{aligned} f(s,t,u)=&(1-s)(1-t)(1-u)f_1+s(1-t)(1-u)f_2 \\ &+st(1-u)f_3+(1-s)t(1-u)f_4 \\ &+(1-s)(1-t)u f_5+s(1-t)u f_6 \\ &+stu f_7+(1-s)t u f_8. \end{aligned} $$

### 3.6 Barycentric coordinates

![Barycentric coordinates](./lec02_materials/barycentric-coordinates.png)

For a triangle with vertices $\mathbf{x}_0,\mathbf{x}_1,\mathbf{x}_2$, any coplanar point $\mathbf{p}$ can be written as

$$ \mathbf{p}=b_0\mathbf{x}_0+b_1\mathbf{x}_1+b_2\mathbf{x}_2,\qquad b_0+b_1+b_2=1. $$

The slide uses area ratios:

$$ b_0=\frac{A_0}{A},\qquad b_1=\frac{A_1}{A},\qquad b_2=\frac{A_2}{A}. $$

with oriented sub-triangle areas

$$ A_0=\frac12 \big((\mathbf{x}_1-\mathbf{p})\times(\mathbf{x}_2-\mathbf{p})\big)\cdot \mathbf{n}, $$

$$ A_1=\frac12 \big((\mathbf{x}_2-\mathbf{p})\times(\mathbf{x}_0-\mathbf{p})\big)\cdot \mathbf{n}, $$

$$ A_2=\frac12 \big((\mathbf{x}_0-\mathbf{p})\times(\mathbf{x}_1-\mathbf{p})\big)\cdot \mathbf{n}. $$

Applications include Gouraud shading, texture mapping, and collision detection.

:::warn ⚠️ Attention
The slide writes the inside test as $0<b_i<1$ for $i=0,1,2$, which excludes the triangle boundary. If you want points on edges or vertices to count as inside, replace the strict inequalities by $b_i\ge 0$ together with $b_0+b_1+b_2=1$.
:::

### 3.7 Differential operators

For a scalar function $f(x)\in\mathbb{R}$,

$$ df = \frac{df}{dx}\,dx. $$

For a scalar field $f(\mathbf{x})\in\mathbb{R}$ with $\mathbf{x}=(x,y,z)$,

$$ df=\frac{\partial f}{\partial x}dx+\frac{\partial f}{\partial y}dy+\frac{\partial f}{\partial z}dz=\nabla f(\mathbf{x})\cdot d\mathbf{x}, $$

and

$$ \nabla f(\mathbf{x})=\begin{bmatrix}\partial f/\partial x \\ \partial f/\partial y \\ \partial f/\partial z\end{bmatrix}. $$

The gradient points in the steepest ascent direction and is perpendicular to level sets or iso-surfaces.

If $\mathbf{f}(\mathbf{x})=[f(\mathbf{x}),g(\mathbf{x}),h(\mathbf{x})]^T\in\mathbb{R}^3$, the Jacobian is

$$ J(\mathbf{f})=\begin{bmatrix}\partial f/\partial x & \partial f/\partial y & \partial f/\partial z \\ \partial g/\partial x & \partial g/\partial y & \partial g/\partial z \\ \partial h/\partial x & \partial h/\partial y & \partial h/\partial z\end{bmatrix}. $$

### 3.8 Nabla, divergence, curl, Hessian, and Laplacian

![Examples of gradient, divergence, and curl](./lec02_materials/nabla-operator.png)

The Nabla operator is

$$ \nabla = \begin{bmatrix}\partial/\partial x & \partial/\partial y & \partial/\partial z\end{bmatrix}. $$

For a scalar field $f$ and vector field $\mathbf{u}=(u,v,w)$,

$$ \nabla f=\begin{bmatrix}\partial f/\partial x \\ \partial f/\partial y \\ \partial f/\partial z\end{bmatrix},\qquad \nabla\cdot \mathbf{u}=\frac{\partial u}{\partial x}+\frac{\partial v}{\partial y}+\frac{\partial w}{\partial z}, $$

$$ \nabla\times \mathbf{u}=\begin{bmatrix}\partial w/\partial y-\partial v/\partial z \\ \partial u/\partial z-\partial w/\partial x \\ \partial v/\partial x-\partial u/\partial y\end{bmatrix}. $$

For second-order derivatives of a scalar field,

$$ H = J(\nabla f)=\begin{bmatrix}\partial^2 f/\partial x^2 & \partial^2 f/\partial x\partial y & \partial^2 f/\partial x\partial z \\ \partial^2 f/\partial y\partial x & \partial^2 f/\partial y^2 & \partial^2 f/\partial y\partial z \\ \partial^2 f/\partial z\partial x & \partial^2 f/\partial z\partial y & \partial^2 f/\partial z^2\end{bmatrix} $$

and the Laplacian is

$$ \Delta f=\nabla\cdot\nabla f=\frac{\partial^2 f}{\partial x^2}+\frac{\partial^2 f}{\partial y^2}+\frac{\partial^2 f}{\partial z^2}=\operatorname{trace}(H). $$

The same operator is what reappears in the heat equation.

## 4. Time Integration

### 4.1 From continuous dynamics to discrete updates

The continuous equations

$$ \frac{d\mathbf{x}_p(t)}{dt}=\mathbf{v}(\mathbf{x}_p,t),\qquad \frac{d\mathbf{v}_p(t)}{dt}=\frac{\mathbf{f}(\mathbf{x}_p,t)}{m_p} $$

become integral relations over one time step:

$$ \mathbf{x}_p(t_n)-\mathbf{x}_p(t_{n-1})=\int_{t_{n-1}}^{t_n}\mathbf{v}_p(t)\,dt, $$

$$ \mathbf{v}_p(t_n)-\mathbf{v}_p(t_{n-1})=\frac{1}{m_p}\int_{t_{n-1}}^{t_n}\mathbf{f}(\mathbf{x}_p,t)\,dt. $$

A time integrator is simply a rule that approximates these integrals.

### 4.2 Explicit Euler

The lecture starts with the simplest approximation:

$$ \mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_n\Delta t,\qquad \mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_n\Delta t. $$

This is cheap and easy, but it is only first-order accurate and can be badly unstable.

![Explicit Euler instability for the spring system](./lec02_materials/explicit-euler-instability.png)

For the undamped spring oscillator with $\omega^2=k/m$, write the state as $\mathbf{y}_n=[x_n,v_n]^T$. Explicit Euler gives

$$ \mathbf{y}_{n+1}=\begin{bmatrix}1 & \Delta t \\ -\omega^2\Delta t & 1\end{bmatrix}\mathbf{y}_n. $$

The eigenvalues are $1\pm i\omega\Delta t$, whose magnitude is

$$ \left|1\pm i\omega\Delta t\right|=\sqrt{1+\omega^2\Delta t^2}>1. $$

So the amplitude grows at every step: the method is **unconditionally unstable** for the undamped oscillator.

:::remark 📝 Question: Why does explicit Euler explode even when $\Delta t$ is very small?
A smaller $\Delta t$ slows down the blow-up, but it does not remove it. The update matrix still has eigenvalues with magnitude greater than $1$, so energy keeps drifting upward step after step.
:::

### 4.3 Implicit Euler

Implicit Euler moves the unknown state to the right-hand side:

$$ \mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1}\Delta t,\qquad \mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_{n+1}\Delta t. $$

For the same spring system,

$$ x_{n+1}=x_n+v_{n+1}\Delta t,\qquad v_{n+1}=v_n-\omega^2 x_{n+1}\Delta t. $$

Solving these two equations gives

$$ x_{n+1}=\frac{x_n+v_n\Delta t}{1+\omega^2\Delta t^2},\qquad v_{n+1}=\frac{v_n-\omega^2 x_n\Delta t}{1+\omega^2\Delta t^2}. $$

The extra denominator shrinks the state every step, which explains the slide's conclusion: implicit Euler is **unconditionally stable** for the undamped spring, although it also introduces artificial numerical damping.

![Implicit Euler stability for the spring system](./lec02_materials/implicit-euler-stability.png)

The price is that implicit methods require solving equations. In linear problems that may be a matrix solve; in nonlinear problems it may require Newton or quasi-Newton iterations.

### 4.4 Symplectic Euler (semi-explicit Euler)

Symplectic Euler mixes one explicit substep with one implicit-looking substep:

$$ \mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_n\Delta t,\qquad \mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1}\Delta t. $$

It is still a simple method, but it usually behaves much better on Hamiltonian systems because it controls long-term energy drift more gracefully than explicit Euler.

:::tip 💡 Interpretation
For oscillatory systems, symplectic Euler does not exactly conserve energy, but it tends to keep the trajectory on a distorted closed orbit instead of spiraling outward like explicit Euler or damping too aggressively like implicit Euler. For the harmonic oscillator, the method stays bounded when $\omega\Delta t<2$.
:::

### 4.5 Mid-point method

The mid-point method uses information at $t_{n+1/2}$:

$$ \mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1/2}\Delta t,\qquad \mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_{n+1/2}\Delta t. $$

A common explicit version computes the midpoint by a half Euler step:

1. Compute midpoint quantities with step $\Delta t/2$.
2. Use those midpoint quantities for the full update.

For example,

$$ \mathbf{x}_{n+1}=\mathbf{x}_n+\left(\mathbf{v}_n+\frac{\Delta t}{2m}\mathbf{f}_n\right)\Delta t. $$

The local truncation error is $O(\Delta t^3)$, so the method is second-order accurate.

:::remark 📝 Question: Does taking many Euler substeps turn Euler into a higher-order method?
No. Smaller Euler substeps reduce the error constant, but the method is still first-order. Higher order comes from matching more terms in the Taylor expansion, not just from repeating the same first-order rule many times.
:::

### 4.6 Runge-Kutta and leap-frog methods

The lecture places the mid-point method inside the Runge-Kutta family. In particular, it is a **second-order Runge-Kutta method**.

A standard explicit RK4 step forms a weighted average of four slope evaluations:

$$ \mathbf{x}_{n+1}=\mathbf{x}_n+\Delta t\left(\frac16\dot{\mathbf{x}}_1+\frac13\dot{\mathbf{x}}_2+\frac13\dot{\mathbf{x}}_3+\frac16\dot{\mathbf{x}}_4\right), $$

$$ \mathbf{v}_{n+1}=\mathbf{v}_n+\Delta t\left(\frac16\dot{\mathbf{v}}_1+\frac13\dot{\mathbf{v}}_2+\frac13\dot{\mathbf{v}}_3+\frac16\dot{\mathbf{v}}_4\right). $$

Leap-frog interleaves velocity and position on half steps:

$$ \mathbf{v}_{n+1/2}=\mathbf{v}_{n-1/2}+\mathbf{a}(t_n)\Delta t,\qquad \mathbf{x}_{n+1}=\mathbf{x}_n+\Delta t\,\mathbf{v}_{n+1/2}. $$

It needs only one force evaluation per step and still achieves second-order accuracy, which is why it is popular in particle and molecular style simulations.

### 4.7 How to evaluate a time integrator

The lecture lists four criteria.

- **Error / truncation error.** What Taylor terms are discarded?
- **Stability.** Do errors or energy grow during repeated stepping?
- **Convergence / consistency.** Does the numerical solution approach the exact one as $\Delta t\to 0$?
- **Accuracy versus speed.** How much error reduction do we get per unit cost?

The key Taylor viewpoint is

$$ f(x+h)=f(x)+f'(x)h+\frac{f''(x)}{2}h^2+\cdots, $$

so an $n$th-order method keeps terms up to order $n$ and leaves a truncation error of higher order.

:::remark 📝 Question: What is the practical difference between stability, convergence, and accuracy?
Stability asks whether repeated steps amplify mistakes. Convergence asks whether the method approaches the true solution as the step size shrinks. Accuracy asks how fast that error decreases for a given step size. A method can be consistent but still useless in practice if it is unstable for the step sizes you can afford.
:::

## 5. Numerical Solvers

Once space and time are discretized, the remaining job is usually to solve algebraic systems.

- **Linear systems.** Jacobi iteration, Gauss-Seidel, Conjugate Gradient, and Multigrid are typical tools.
- **Nonlinear systems.** Newton's method, quasi-Newton methods, and BFGS are standard choices.
- **Why they matter.** Implicit integration, pressure projection, deformation, contact, and constraints all eventually produce solve problems.

There is no universally optimal solver. The best choice depends on structure: sparsity, symmetry, conditioning, linearity, and the size of the system.

## 6. Exam Review

### 6.1 High-value definitions

- **Lagrangian viewpoint.** Track material points and update their states over time.
- **Eulerian viewpoint.** Track field values at fixed spatial locations.
- **Gradient.** Direction of steepest increase of a scalar field.
- **Divergence.** Net outflow density of a vector field.
- **Curl.** Local rotational tendency of a vector field.
- **Laplacian.** Divergence of the gradient, equal to the trace of the Hessian for a scalar field.
- **Stability.** Bounded behavior of numerical errors under repeated stepping.
- **Consistency / convergence.** Error goes to zero as $\Delta t\to 0$.
- **Implicit method.** The next state appears inside the update equation and must be solved for.

### 6.2 Short-answer templates

- **Why use spatial discretization?** Because continuous media have infinitely many degrees of freedom, so we must approximate them with finite particles, meshes, grids, or hybrids before storing or computing anything.
- **Why are boundary conditions essential for PDEs?** Because spatial derivatives alone do not determine what happens on the boundary of the domain.
- **Why is explicit Euler poor for stiff oscillatory systems?** Because it is first-order and can be unconditionally unstable, so energy grows instead of remaining bounded.
- **Why use symplectic Euler instead of explicit Euler?** Because it is nearly as cheap but usually has much better long-term qualitative behavior on oscillatory systems.
- **Why do implicit methods need solvers?** Because the unknown next state appears on both sides of the update and must be computed by solving linear or nonlinear equations.

### 6.3 Common confusions

- **Small step size does not automatically fix instability.**
- **More Euler substeps do not change Euler's order.**
- **Meshes and particle systems may store similar vertex data, but meshes add topology.**
- **A regular grid and a staggered grid are not the same storage layout for vector fields.**
- **The Laplacian is not the same as the full Hessian; it is only the trace.**

### 6.4 Self-checklist

- Can I explain when a model becomes an ODE and when it becomes a PDE?
- Can I compare particles, meshes, and grids without using a table?
- Can I write linear, bilinear, trilinear, and barycentric interpolation formulas?
- Can I define $\nabla f$, $\nabla\cdot \mathbf{u}$, $\nabla\times \mathbf{u}$, $H$, and $\Delta f$?
- Can I derive explicit Euler, implicit Euler, and symplectic Euler from the same continuous equations?
- Can I state what stability, convergence, and accuracy each mean in one sentence?

