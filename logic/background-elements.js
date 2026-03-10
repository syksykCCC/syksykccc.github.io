(function () {
  const canvas = document.getElementById("bgLogicCanvas");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nodes = [
    { x: 0.16, y: 0.18, label: "p -> q" },
    { x: 0.34, y: 0.18, label: "p" },
    { x: 0.66, y: 0.18, label: "q -> r" },
    { x: 0.84, y: 0.18, label: "q" },
    { x: 0.25, y: 0.42, label: "q" },
    { x: 0.75, y: 0.42, label: "r" },
    { x: 0.5, y: 0.64, label: "q & r" },
    { x: 0.5, y: 0.84, label: "therefore q & r" }
  ];

  const edges = [
    [0, 4],
    [1, 4],
    [2, 5],
    [3, 5],
    [4, 6],
    [5, 6],
    [6, 7]
  ];

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

  function drawProofTree(timestamp) {
    ctx.clearRect(0, 0, width, height);

    const points = nodes.map((node, index) => {
      const sway = Math.sin(timestamp * 0.00055 + index * 0.92) * 3;
      return {
        x: node.x * width,
        y: node.y * height + sway,
        label: node.label
      };
    });

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "rgba(95, 116, 206, 0.32)";
    for (let i = 0; i < edges.length; i += 1) {
      const [a, b] = edges[i];
      const pa = points[a];
      const pb = points[b];

      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();

      const t = (timestamp * 0.00012 + i * 0.17) % 1;
      const px = pa.x + (pb.x - pa.x) * t;
      const py = pa.y + (pb.y - pa.y) * t;

      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(111, 135, 231, 0.45)";
      ctx.fill();
    }

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];

      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fill();
      ctx.strokeStyle = "rgba(93, 112, 195, 0.34)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = "rgba(45, 59, 96, 0.74)";
      ctx.font = "12px Consolas, 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.label, p.x, p.y);
    }

    if (!prefersReducedMotion) {
      animationId = window.requestAnimationFrame(drawProofTree);
    }
  }

  function start() {
    resize();

    if (prefersReducedMotion) {
      drawProofTree(0);
      return;
    }

    animationId = window.requestAnimationFrame(drawProofTree);
  }

  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && animationId !== null) {
      window.cancelAnimationFrame(animationId);
      animationId = null;
      return;
    }

    if (!document.hidden && !prefersReducedMotion && animationId === null) {
      animationId = window.requestAnimationFrame(drawProofTree);
    }
  });

  start();
})();
