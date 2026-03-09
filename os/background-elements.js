(function () {
  const osLayer = document.getElementById("bgOsElements");
  const terminalLayer = document.getElementById("bgTerminalLayer");

  if (!osLayer || !terminalLayer) {
    return;
  }

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const terminalProfiles = [
    {
      title: "tty0",
      lines: [
        "$ ps -eo pid,comm,state",
        "1 init S",
        "42 kthreadd S",
        "128 notes-site R"
      ]
    },
    {
      title: "tty1",
      lines: [
        "$ top -bn1 | head -5",
        "Tasks: 137 total",
        "CPU: 8.2% user",
        "Mem: 3.1G / 8G"
      ]
    },
    {
      title: "tty2",
      lines: [
        "$ cat /proc/loadavg",
        "0.27 0.31 0.38",
        "$ uname -r",
        "6.x.x-kernel"
      ]
    },
    {
      title: "tty3",
      lines: [
        "$ strace ./lab",
        "openat(...) = 3",
        "mmap(...) = 0x7f...",
        "futex(...) = 0"
      ]
    },
    {
      title: "tty4",
      lines: [
        "$ make -j4",
        "[CC] scheduler.o",
        "[CC] vm.o",
        "[LD] kernel.bin"
      ]
    }
  ];

  function randomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function createTerminalPanel(index, count) {
    const profile = terminalProfiles[index % terminalProfiles.length];
    const panel = document.createElement("article");
    panel.className = "bg-terminal";

    const baseX = ((index + 0.5) / count) * 100;
    const jitterX = (Math.random() - 0.5) * 7;
    const baseY = 20 + Math.random() * 60;

    panel.style.setProperty("--x", `${baseX + jitterX}%`);
    panel.style.setProperty("--y", `${baseY}%`);
    panel.style.setProperty("--scale", `${0.98 + Math.random() * 0.35}`);
    panel.style.setProperty("--alpha", `${0.3 + Math.random() * 0.22}`);
    panel.style.setProperty("--duration", `${16 + randomInt(20)}s`);
    panel.style.setProperty("--delay", `${-randomInt(16)}s`);

    panel.innerHTML = `
      <header class="bg-terminal-head">
        <span class="dot dot-red"></span>
        <span class="dot dot-amber"></span>
        <span class="dot dot-green"></span>
        <span class="bg-terminal-title">${profile.title}</span>
      </header>
      <div class="bg-terminal-body">
        ${profile.lines.map((line) => `<p>${line}</p>`).join("")}
        <p><span class="cursor">_</span></p>
      </div>
    `;

    return panel;
  }

  function buildTerminalPanels() {
    terminalLayer.innerHTML = "";

    const width = window.innerWidth || 1200;
    const panelCount = prefersReducedMotion
      ? 2
      : width < 700
        ? 2
        : width < 1100
          ? 3
          : 4;

    for (let i = 0; i < panelCount; i += 1) {
      terminalLayer.appendChild(createTerminalPanel(i, panelCount));
    }
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(buildTerminalPanels, 220);
  });

  buildTerminalPanels();
})();
