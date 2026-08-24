
const Loader = (() => {
  const STEPS = [
    { pct: 15, text: "Booting simulation engine…" },
    { pct: 38, text: "Loading graph algorithms…" },
    { pct: 58, text: "Establishing routing tables…" },
    { pct: 78, text: "Connecting to FastAPI backend…" },
    { pct: 96, text: "Initializing SVG canvas…" },
    { pct: 100, text: "Ready." },
  ];

  async function run(pingFn) {
    const screen = document.getElementById("loadingScreen");
    const bar = document.getElementById("loaderBarFill");
    const status = document.getElementById("loaderStatus");

    const stepPromise = (async () => {
      for (const step of STEPS) {
        status.textContent = step.text;
        bar.style.width = step.pct + "%";
        await new Promise(r => setTimeout(r, 260 + Math.random() * 160));
      }
    })();

    const pingPromise = (async () => {
      try { await pingFn(); return true; } catch (_) { return false; }
    })();

    const [, online] = await Promise.all([stepPromise, pingPromise]);

    if (!online) {
      status.textContent = "Engine unreachable — start the FastAPI backend on :8000";
      status.style.color = "var(--red)";
      await new Promise(r => setTimeout(r, 1400));
    }

    screen.classList.add("hidden");
    setTimeout(() => screen.remove(), 700);
  }

  return { run };
})();
