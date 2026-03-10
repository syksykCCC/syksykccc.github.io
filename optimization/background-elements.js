(function () {
  const canvas = document.getElementById("bgContourCanvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationId = null;

  function resize() {
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawContourLine(cx, cy, rx, ry, level, t) {
    const steps = 120;
    ctx.beginPath();

    for (let i = 0; i <= steps; i += 1) {
      const a = (i / steps) * Math.PI * 2;
      const wobble = Math.sin(a * 3 + t * 0.0005 + level * 0.65) * (4 + level * 0.25);
      const wobbleY = Math.cos(a * 2 + t * 0.0004 + level * 0.52) * (3 + level * 0.2);

      const x = cx + Math.cos(a) * (rx + wobble);
      const y = cy + Math.sin(a) * (ry + wobbleY);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    const alpha = Math.max(0.1, 0.38 - level * 0.02);
    ctx.strokeStyle = `rgba(20, 160, 202, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  function drawDescentPath(cx, cy, t) {
    const points = [
      { x: width * 0.14, y: height * 0.8 },
      { x: width * 0.24, y: height * 0.66 },
      { x: width * 0.34, y: height * 0.57 },
      { x: width * 0.45, y: height * 0.49 },
      { x: width * 0.56, y: height * 0.43 },
      { x: cx, y: cy }
    ];

    ctx.setLineDash([7, 7]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 167, 79, 0.5)";
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const progress = (t * 0.0001) % 1;
    const segPos = progress * (points.length - 1);
    const idx = Math.floor(segPos);
    const local = segPos - idx;
    const a = points[idx];
    const b = points[Math.min(idx + 1, points.length - 1)];

    const px = a.x + (b.x - a.x) * local;
    const py = a.y + (b.y - a.y) * local;

    ctx.beginPath();
    ctx.arc(px, py, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 177, 93, 0.8)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(18, 170, 208, 0.86)";
    ctx.fill();
  }

  function draw(timestamp) {
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.67 + Math.sin(timestamp * 0.00025) * 12;
    const cy = height * 0.34 + Math.cos(timestamp * 0.00022) * 8;

    for (let level = 0; level < 12; level += 1) {
      const rx = 80 + level * 28;
      const ry = 52 + level * 18;
      drawContourLine(cx, cy, rx, ry, level, timestamp);
    }

    drawDescentPath(cx, cy, timestamp);

    if (!prefersReducedMotion) {
      animationId = window.requestAnimationFrame(draw);
    }
  }

  function start() {
    resize();
    if (prefersReducedMotion) {
      draw(0);
      return;
    }
    animationId = window.requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationId !== null) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
      return;
    }

    if (!document.hidden && !prefersReducedMotion && animationId === null) {
      animationId = window.requestAnimationFrame(draw);
    }
  });

  start();
})();
