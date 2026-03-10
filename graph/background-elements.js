(function () {
  /*
    Course visual candidates:
    1) Cloth-like mass-spring mesh
    2) Particle advection plume
    3) Collision normal field
    4) Rigid-body bounding boxes
    5) Energy curve traces

    Chosen core visual (single focus):
    Full-screen mass-spring mesh with low-frequency motion.
  */
  const canvas = document.getElementById("bgSimCanvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLS = 26;
  const ROWS = 16;
  const ITERATIONS = 4;
  const DAMPING = 0.986;
  const GRAVITY = 0.015;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationId = null;

  let points = [];
  let springs = [];
  const pins = [];

  const pointer = {
    x: 0,
    y: 0,
    power: 0
  };

  function pointIndex(col, row) {
    return row * COLS + col;
  }

  function createPoint(x, y, pinned) {
    return {
      x,
      y,
      px: x,
      py: y,
      baseX: x,
      baseY: y,
      pinned
    };
  }

  function addSpring(a, b, stiffness) {
    const pa = points[a];
    const pb = points[b];
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;

    springs.push({
      a,
      b,
      rest: Math.hypot(dx, dy),
      stiffness
    });
  }

  function buildMesh() {
    points = [];
    springs = [];
    pins.length = 0;

    const left = -width * 0.08;
    const right = width * 1.08;
    const top = -height * 0.12;
    const bottom = height * 1.08;

    for (let row = 0; row < ROWS; row += 1) {
      const v = row / (ROWS - 1);
      for (let col = 0; col < COLS; col += 1) {
        const u = col / (COLS - 1);
        const x = left + (right - left) * u;
        const y = top + (bottom - top) * v;
        const pinned = row === 0 && col % 2 === 0;

        points.push(createPoint(x, y, pinned));
        if (pinned) {
          pins.push(pointIndex(col, row));
        }
      }
    }

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const idx = pointIndex(col, row);

        if (col < COLS - 1) {
          addSpring(idx, pointIndex(col + 1, row), 0.2);
        }
        if (row < ROWS - 1) {
          addSpring(idx, pointIndex(col, row + 1), 0.24);
        }
        if (col < COLS - 1 && row < ROWS - 1) {
          addSpring(idx, pointIndex(col + 1, row + 1), 0.08);
          addSpring(pointIndex(col + 1, row), pointIndex(col, row + 1), 0.08);
        }
      }
    }
  }

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildMesh();
  }

  function applyPointerDisturbance() {
    if (pointer.power <= 0.01) {
      return;
    }

    const radius = Math.max(width, height) * 0.18;
    const radiusSq = radius * radius;

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      if (p.pinned) {
        continue;
      }

      const dx = p.x - pointer.x;
      const dy = p.y - pointer.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > radiusSq) {
        continue;
      }

      const dist = Math.sqrt(distSq) + 0.0001;
      const t = 1 - distSq / radiusSq;
      const impulse = pointer.power * t;

      p.x += (dx / dist) * impulse * 2.4;
      p.y += (dy / dist) * impulse * 1.2;
    }

    pointer.power *= 0.84;
  }

  function integrate(time) {
    const windBase = Math.sin(time * 0.00022) * 0.11;

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      if (p.pinned) {
        continue;
      }

      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x;
      p.py = p.y;

      const wave = Math.sin(p.x * 0.008 + p.y * 0.006 + time * 0.00115) * 0.09;
      p.x += vx + windBase + wave;
      p.y += vy + GRAVITY + wave * 0.35;
    }
  }

  function satisfyConstraints(time) {
    for (let i = 0; i < pins.length; i += 1) {
      const p = points[pins[i]];
      const driftX = Math.sin(time * 0.00055 + i * 0.52) * 4;
      const driftY = Math.cos(time * 0.00041 + i * 0.37) * 2.8;

      p.x = p.baseX + driftX;
      p.y = p.baseY + driftY;
      p.px = p.x;
      p.py = p.y;
    }

    const minX = -width * 0.2;
    const maxX = width * 1.2;
    const minY = -height * 0.2;
    const maxY = height * 1.2;

    for (let iter = 0; iter < ITERATIONS; iter += 1) {
      for (let i = 0; i < springs.length; i += 1) {
        const spring = springs[i];
        const pa = points[spring.a];
        const pb = points[spring.b];

        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const diff = (dist - spring.rest) / dist;
        const offsetX = dx * 0.5 * diff * spring.stiffness;
        const offsetY = dy * 0.5 * diff * spring.stiffness;

        if (!pa.pinned) {
          pa.x += offsetX;
          pa.y += offsetY;
        }
        if (!pb.pinned) {
          pb.x -= offsetX;
          pb.y -= offsetY;
        }
      }

      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        if (p.pinned) {
          continue;
        }

        if (p.x < minX) p.x = minX;
        if (p.x > maxX) p.x = maxX;
        if (p.y < minY) p.y = minY;
        if (p.y > maxY) p.y = maxY;
      }
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < springs.length; i += 1) {
      const spring = springs[i];
      const pa = points[spring.a];
      const pb = points[spring.b];
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const stretch = Math.abs(Math.hypot(dx, dy) - spring.rest) / spring.rest;
      const alpha = Math.min(0.38, 0.1 + stretch * 1.2);
      const hue = 192 + Math.sin((pa.y + pb.y) * 0.004 + time * 0.00035) * 18;

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = `hsla(${hue.toFixed(0)}, 95%, 74%, ${alpha.toFixed(3)})`;
      ctx.lineWidth = stretch > 0.05 ? 1.35 : 0.85;
      ctx.stroke();
    }

    for (let row = 0; row < ROWS; row += 2) {
      for (let col = 0; col < COLS; col += 2) {
        const p = points[pointIndex(col, row)];
        const glow = 0.12 + 0.12 * Math.sin(time * 0.0014 + col * 0.8 + row * 0.63);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.75, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(162, 244, 255, ${Math.max(0.05, glow).toFixed(3)})`;
        ctx.fill();
      }
    }
  }

  function animate(time) {
    integrate(time);
    applyPointerDisturbance();
    satisfyConstraints(time);
    draw(time);

    if (!prefersReducedMotion) {
      animationId = window.requestAnimationFrame(animate);
    }
  }

  function onPointerMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.power = 1.3;
  }

  function onTouchMove(event) {
    const touch = event.touches && event.touches[0];
    if (!touch) {
      return;
    }

    pointer.x = touch.clientX;
    pointer.y = touch.clientY;
    pointer.power = 1.4;
  }

  function start() {
    resize();

    if (prefersReducedMotion) {
      draw(0);
      return;
    }

    animationId = window.requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationId !== null) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
      return;
    }

    if (!document.hidden && !prefersReducedMotion && animationId === null) {
      animationId = window.requestAnimationFrame(animate);
    }
  });

  start();
})();
