/**
 * ui.js
 * -----
 * DOM rendering helpers for everything outside the SVG canvas: stat
 * cards, the terminal console, right-panel detail boxes, the
 * transmission status widget, modals, and toasts.
 */

const UI = (() => {
  const $ = (id) => document.getElementById(id);

  let renderedEventCount = 0;
  let bannerHideTimer = null;

  // ------------------------------------------------------------------
  // CONSOLE
  // ------------------------------------------------------------------
  function typeToClass(type) {
    return "log-type--" + type.replace(/\s+/g, "-");
  }

  function appendLogLine(time, type, message) {
    const body = $("consoleBody");
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-type ${typeToClass(type)}">${escapeHtml(type)}</span>
      <span class="log-msg">${escapeHtml(message)}</span>
    `;
    body.appendChild(line);
    body.scrollTop = body.scrollHeight;
    updateConsoleCount();
  }

  function logLocal(type, message) {
    const time = new Date().toTimeString().slice(0, 8);
    appendLogLine(time, type, message);
  }

  function syncConsole(events) {
    if (events.length < renderedEventCount) {
      $("consoleBody").innerHTML = "";
      renderedEventCount = 0;
    }
    for (let i = renderedEventCount; i < events.length; i++) {
      const e = events[i];
      appendLogLine(e.time, e.type, e.message);
    }
    renderedEventCount = events.length;
  }

  function clearConsole() {
    $("consoleBody").innerHTML = "";
    renderedEventCount = 0;
    updateConsoleCount();
  }

  function updateConsoleCount() {
    const n = $("consoleBody").children.length;
    $("consoleCount").textContent = n;
  }

  function toggleConsole() {
    document.body.classList.toggle("console-collapsed");
    document.getElementById("appShell").classList.toggle("console-collapsed");
  }

  // ------------------------------------------------------------------
  // STATS
  // ------------------------------------------------------------------
  function bump(el) {
    el.classList.remove("stat-bump");
    void el.offsetWidth;
    el.classList.add("stat-bump");
  }

  function renderStats(stats) {
    setStatValue("statRouters", stats.routers);
    setStatValue("statLinks", stats.links);
    setStatValue("statAvgCost", stats.average_link_cost);
    setStatValue("statSent", stats.packets_sent);
    setStatValue("statDelivered", stats.packets_delivered);
  }

  function setStatValue(id, value) {
    const el = $(id);
    if (el.textContent !== String(value)) {
      el.textContent = value;
      bump(el);
    }
  }

  function setActiveTransmission(active, label) {
    const card = $("statActiveCard");
    const val = $("statActive");
    card.classList.toggle("stat-card--active", active);
    card.classList.toggle("stat-card--pulse", active);
    val.textContent = active ? (label || "Active") : "Idle";
  }

  // ------------------------------------------------------------------
  // ROUTER DETAILS / ROUTING TABLE
  // ------------------------------------------------------------------
  function renderRouterDetails(router, degree) {
    if (!router) {
      $("routerDetails").innerHTML = `<p class="placeholder-text">Select a router on the canvas to inspect it.</p>`;
      return;
    }
    const chip = router.status === "down"
      ? `<span class="status-chip down">down</span>`
      : `<span class="status-chip active">active</span>`;
    $("routerDetails").innerHTML = `
      <div class="kv-row"><span class="kv-key">ID</span><span class="kv-val">${router.id}</span></div>
      <div class="kv-row"><span class="kv-key">Name</span><span class="kv-val">${escapeHtml(router.name)}</span></div>
      <div class="kv-row"><span class="kv-key">Position</span><span class="kv-val">${Math.round(router.x)}, ${Math.round(router.y)}</span></div>
      <div class="kv-row"><span class="kv-key">Status</span><span class="kv-val">${chip}</span></div>
      <div class="kv-row"><span class="kv-key">Connections</span><span class="kv-val">${degree}</span></div>
    `;
  }

  function renderRoutingTable(router) {
    if (!router || !router.routing_table || Object.keys(router.routing_table).length === 0) {
      $("routingTable").innerHTML = `<p class="placeholder-text">No known routes from this router yet.</p>`;
      return;
    }
    const rows = Object.values(router.routing_table)
      .sort((a, b) => a.destination.localeCompare(b.destination))
      .map(entry => `
        <tr>
          <td>${entry.destination}</td>
          <td>${entry.next_hop ?? "-"}</td>
          <td>${entry.cost}</td>
          <td>${entry.path.join(" → ")}</td>
        </tr>
      `).join("");
    $("routingTable").innerHTML = `
      <table class="route-table">
        <thead><tr><th>Dest</th><th>Next Hop</th><th>Cost</th><th>Path</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // ------------------------------------------------------------------
  // PACKET DETAILS / BINARY STREAM
  // ------------------------------------------------------------------
  function renderPacketDetails(packets) {
    if (!packets || packets.length === 0) {
      $("packetDetails").innerHTML = `<p class="placeholder-text">Send data to see the packet breakdown.</p>`;
      return;
    }
    $("packetDetails").innerHTML = packets.map(p => `
      <div class="packet-card" data-packet-card="${p.packet_id}">
        <div class="pk-top">
          <span class="pk-id">${p.packet_id}</span>
          <span class="pk-state pending" data-packet-status="${p.packet_id}">pending</span>
        </div>
        seq ${p.sequence}/${p.total} · "${escapeHtml(p.payload)}"
        <span class="pk-bin">${p.binary}</span>
      </div>
    `).join("");
  }

  function setPacketState(packetId, state) {
    const el = document.querySelector(`[data-packet-status="${packetId}"]`);
    if (el) {
      el.textContent = state;
      el.className = "pk-state " + state;
    }
  }

  function renderAsciiSteps(steps) {
    if (!steps || steps.length === 0) {
      $("binaryStream").innerHTML = `<p class="placeholder-text">Binary conversion will stream here.</p>`;
      return;
    }
    $("binaryStream").innerHTML = steps.map(s => `
      <span class="ascii-step">
        <span class="ch">${escapeHtml(s.char === " " ? "␣" : s.char)}</span>
        <span class="code">${s.ascii}</span>
        <span class="bin">${s.binary}</span>
      </span>
    `).join("");
  }

  function renderFullBinary(binary) {
    if (!binary) return;
    const box = $("binaryStream");
    const div = document.createElement("div");
    div.className = "full-binary-box";
    div.textContent = binary;
    box.appendChild(div);
  }

  // ------------------------------------------------------------------
  // TRANSMISSION STATUS WIDGET
  // ------------------------------------------------------------------
  function renderTransmissionStatus(path) {
    setActiveTransmission(true, `${path[0]} → ${path[path.length - 1]}`);
    const hops = path.map((id, i) => `<span class="tx-hop${i === 0 ? " current" : ""}" data-tx-hop="${i}">${id}</span>`).join(
      `<span style="color:var(--text-dim)">→</span>`
    );
    $("transmissionStatus").innerHTML = `
      <div class="transmission-status-box">
        <div class="tx-progress-track"><div class="tx-progress-fill" id="txProgressFill"></div></div>
        <div class="tx-hops" id="txHops">${hops}</div>
      </div>
    `;
  }

  function updateTransmissionProgress(path, hopsDone) {
    const pct = Math.round((hopsDone / (path.length - 1)) * 100);
    const fill = $("txProgressFill");
    if (fill) fill.style.width = pct + "%";
    const chips = document.querySelectorAll("#txHops .tx-hop");
    chips.forEach((chip, i) => {
      chip.classList.toggle("done", i < hopsDone);
      chip.classList.toggle("current", i === hopsDone);
    });
  }

  function clearTransmissionStatus() {
    $("transmissionStatus").innerHTML = `<p class="placeholder-text">No active transmission.</p>`;
    setActiveTransmission(false);
  }

  // ------------------------------------------------------------------
  // TRANSMISSION BANNER (floating over canvas)
  // ------------------------------------------------------------------
  function showTransmissionBanner(text, kind = "active") {
    const banner = $("transmissionBanner");
    clearTimeout(bannerHideTimer);
    banner.className = "transmission-banner glass show " + kind;
    banner.innerHTML = `<span class="pip"></span><span>${escapeHtml(text)}</span>`;
  }

  function hideTransmissionBanner() {
    const banner = $("transmissionBanner");
    bannerHideTimer = setTimeout(() => {
      banner.classList.remove("show");
    }, 300);
  }

  // ------------------------------------------------------------------
  // SEND FORM
  // ------------------------------------------------------------------
  function populateRouterSelects(routers) {
    ["sendSource", "sendDestination"].forEach(id => {
      const sel = $(id);
      const prevValue = sel.value;
      sel.innerHTML = routers.map(r => `<option value="${r.id}">${escapeHtml(r.name)} (${r.id})</option>`).join("");
      if (routers.some(r => r.id === prevValue)) sel.value = prevValue;
    });
  }

  function setSendBusy(busy) {
    const btn = $("btnSendConfirm");
    if (!btn) return;
    btn.disabled = busy;
    btn.textContent = busy ? "Transmitting…" : "Send Message ▸";
  }

  // ------------------------------------------------------------------
  // MODE BADGE / HINTS
  // ------------------------------------------------------------------
  const MODE_HINTS = {
    idle: "Choose a tool from the left to get started.",
    "add-router": "Click anywhere on the canvas to place a router.",
    "delete-router": "Click a router to remove it and its links.",
    connect: "Click two routers to create a link between them.",
    "delete-link": "Click a link to remove it.",
    "fail-link": "Click a link to simulate a failure on it.",
    move: "Drag a router to reposition it. Link costs update live.",
  };

  function setModeBadge(mode) {
    const badge = $("modeBadge");
    badge.querySelector(".mode-label").textContent = mode === "idle" ? "Idle" : mode.replace(/-/g, " ");
    badge.classList.toggle("active-mode", mode !== "idle");
    $("canvasHint").textContent = MODE_HINTS[mode] || "";
  }

  // ------------------------------------------------------------------
  // MODALS
  // ------------------------------------------------------------------
  function askRouterName() {
    return new Promise((resolve) => {
      const overlay = $("namePromptOverlay");
      const input = $("namePromptInput");
      input.value = "";
      overlay.classList.add("show");
      setTimeout(() => input.focus(), 50);

      function cleanup(value) {
        overlay.classList.remove("show");
        $("namePromptConfirm").removeEventListener("click", onConfirm);
        $("namePromptCancel").removeEventListener("click", onCancel);
        input.removeEventListener("keydown", onKey);
        resolve(value);
      }
      function onConfirm() { cleanup(input.value.trim() || null); }
      function onCancel() { cleanup(null); }
      function onKey(e) {
        if (e.key === "Enter") onConfirm();
        if (e.key === "Escape") onCancel();
      }
      $("namePromptConfirm").addEventListener("click", onConfirm);
      $("namePromptCancel").addEventListener("click", onCancel);
      input.addEventListener("keydown", onKey);
    });
  }

  function openSendModal() {
    $("sendModalOverlay").classList.add("show");
  }
  function closeSendModal() {
    $("sendModalOverlay").classList.remove("show");
  }

  function confirmDialog(message) {
    return window.confirm(message);
  }

  // ------------------------------------------------------------------
  // TOASTS
  // ------------------------------------------------------------------
  const TOAST_ICONS = {
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>`,
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
  };

  function toast(message, kind = "info") {
    const host = $("toastHost");
    const el = document.createElement("div");
    el.className = "toast glass" + (kind === "error" ? " error" : kind === "success" ? " success" : "");
    const color = kind === "error" ? "var(--red)" : kind === "success" ? "var(--green)" : "var(--accent-hi)";
    el.innerHTML = `<span class="toast-icon" style="color:${color}">${TOAST_ICONS[kind] || TOAST_ICONS.info}</span><span>${escapeHtml(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 260);
    }, 4200);
  }

  // ------------------------------------------------------------------
  // API STATUS DOT
  // ------------------------------------------------------------------
  function setApiStatus(online) {
    const dot = $("apiStatusDot");
    const text = $("apiStatusText");
    dot.classList.remove("online", "offline");
    if (online) {
      dot.classList.add("online");
      text.textContent = "Engine online";
    } else {
      dot.classList.add("offline");
      text.textContent = "Engine unreachable";
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    syncConsole, logLocal, clearConsole, toggleConsole,
    renderStats, setActiveTransmission,
    renderRouterDetails, renderRoutingTable,
    renderPacketDetails, setPacketState,
    renderAsciiSteps, renderFullBinary,
    renderTransmissionStatus, updateTransmissionProgress, clearTransmissionStatus,
    showTransmissionBanner, hideTransmissionBanner,
    populateRouterSelects, setSendBusy,
    setModeBadge, askRouterName, openSendModal, closeSendModal, confirmDialog,
    toast, setApiStatus,
  };
})();
