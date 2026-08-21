/**
 * script.js
 * ---------
 * Application entry point. Owns frontend state (current tool mode,
 * routers, links, selection) and wires every icon button / canvas
 * interaction / keyboard shortcut to the API + view layers.
 */

const App = (() => {
  const state = {
    mode: "idle",
    routers: [],
    links: [],
    selectedRouterId: null,
    connectFirstId: null,
  };

  // ------------------------------------------------------------------
  // INIT
  // ------------------------------------------------------------------
  async function init() {
    NetworkView.init(document.getElementById("networkCanvas"), {
      getMode: () => state.mode,
      onCanvasClick: handleCanvasClick,
      onCanvasHover: handleCanvasHover,
      onRouterClick: handleRouterClick,
      onLinkClick: handleLinkClick,
      onRouterDragEnd: handleRouterDragEnd,
    });

    wireSidebarButtons();
    wireAlgorithmButtons();
    wireSendModal();
    wireNameModalCloseOnOverlay();
    wireResetButton();
    wireConsoleControls();
    wireShortcuts();

    await Loader.run(API.ping);
    await checkApiHealth();
    await refreshAll();

    setInterval(pollTelemetry, 1500);
    setInterval(checkApiHealth, 8000);
  }

  async function checkApiHealth() {
    try {
      await API.ping();
      UI.setApiStatus(true);
    } catch (err) {
      UI.setApiStatus(false);
    }
  }

  // ------------------------------------------------------------------
  // TOOL / MODE HANDLING
  // ------------------------------------------------------------------
  function wireSidebarButtons() {
    document.querySelectorAll(".icon-btn[data-mode]").forEach(btn => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });
  }

  function setMode(mode) {
    state.mode = state.mode === mode ? "idle" : mode;
    state.connectFirstId = null;
    NetworkView.clearPendingLink();
    NetworkView.clearAllSelected();
    if (state.selectedRouterId) NetworkView.setRouterSelected(state.selectedRouterId, true);
    UI.setModeBadge(state.mode);

    document.querySelectorAll(".icon-btn[data-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === state.mode);
    });

    const canvas = document.getElementById("networkCanvas");
    canvas.classList.toggle("mode-move", state.mode === "move");
  }

  function cancelMode() {
    if (state.mode !== "idle") setMode(state.mode); // toggles back to idle
    UI.closeSendModal();
    const nameOverlay = document.getElementById("namePromptOverlay");
    if (nameOverlay.classList.contains("show")) {
      document.getElementById("namePromptCancel").click();
    }
  }

  // ------------------------------------------------------------------
  // CANVAS INTERACTIONS
  // ------------------------------------------------------------------
  async function handleCanvasClick(x, y) {
    if (state.mode === "add-router") {
      const name = await UI.askRouterName();
      if (name === null) return;
      try {
        await API.createRouter(name, Math.round(x), Math.round(y));
        UI.toast(`Router "${name}" created.`, "success");
        await refreshAll();
      } catch (err) {
        UI.toast(err.message, "error");
      }
    } else if (state.mode === "idle") {
      deselectRouter();
    }
  }

  function handleCanvasHover(x, y) {
    if (state.mode === "connect" && state.connectFirstId) {
      NetworkView.showPendingLink(state.connectFirstId, x, y);
    }
  }

  async function handleRouterClick(router) {
    switch (state.mode) {
      case "delete-router": {
        if (UI.confirmDialog(`Delete router "${router.name}" and all its links?`)) {
          try {
            await API.deleteRouter(router.id);
            UI.toast(`Router "${router.name}" deleted.`, "success");
            if (state.selectedRouterId === router.id) deselectRouter();
            await refreshAll();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        }
        break;
      }
      case "connect": {
        if (!state.connectFirstId) {
          state.connectFirstId = router.id;
          NetworkView.setRouterSelected(router.id, true);
          UI.toast(`"${router.name}" selected as link source. Click another router.`, "info");
        } else if (state.connectFirstId === router.id) {
          NetworkView.setRouterSelected(router.id, false);
          state.connectFirstId = null;
          NetworkView.clearPendingLink();
        } else {
          try {
            await API.createLink(state.connectFirstId, router.id);
            UI.toast("Link created.", "success");
          } catch (err) {
            UI.toast(err.message, "error");
          }
          NetworkView.clearAllSelected();
          NetworkView.clearPendingLink();
          state.connectFirstId = null;
          await refreshAll();
        }
        break;
      }
      default: {
        selectRouter(router.id);
      }
    }
  }

  async function handleLinkClick(link) {
    if (state.mode === "delete-link") {
      try {
        await API.deleteLink(link.source, link.destination);
        UI.toast("Link removed.", "success");
      } catch (err) {
        UI.toast(err.message, "error");
      }
      await refreshAll();
    } else if (state.mode === "fail-link") {
      try {
        if (link.status === "up") {
          await API.failLink(link.source, link.destination);
          UI.toast(`Link ${link.source} <-> ${link.destination} failed.`, "error");
        } else {
          await API.restoreLink(link.source, link.destination);
          UI.toast(`Link ${link.source} <-> ${link.destination} restored.`, "success");
        }
      } catch (err) {
        UI.toast(err.message, "error");
      }
      await refreshAll();
    }
  }

  async function handleRouterDragEnd(id, x, y) {
    try {
      await API.moveRouter(id, Math.round(x), Math.round(y));
      await refreshAll();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }

  function selectRouter(id) {
    state.selectedRouterId = id;
    NetworkView.clearAllSelected();
    NetworkView.setRouterSelected(id, true);
    renderSelectedRouterPanels();
  }

  function deselectRouter() {
    state.selectedRouterId = null;
    NetworkView.clearAllSelected();
    UI.renderRouterDetails(null);
    UI.renderRoutingTable(null);
  }

  function renderSelectedRouterPanels() {
    const router = state.routers.find(r => r.id === state.selectedRouterId);
    if (!router) return;
    const degree = state.links.filter(l => l.source === router.id || l.destination === router.id).length;
    UI.renderRouterDetails(router, degree);
    UI.renderRoutingTable(router);
  }

  // ------------------------------------------------------------------
  // ALGORITHM BUTTONS
  // ------------------------------------------------------------------
  function wireAlgorithmButtons() {
    document.getElementById("btnDijkstra").addEventListener("click", () => runDijkstraView());
    document.getElementById("btnBFS").addEventListener("click", () => runTraversal("bfs"));
    document.getElementById("btnDFS").addEventListener("click", () => runTraversal("dfs"));
    document.getElementById("btnBellman").addEventListener("click", () => runBellman());
  }

  function requireSelectedSource() {
    if (!state.selectedRouterId) {
      UI.toast("Click a router on the canvas to pick a source first.", "error");
      return null;
    }
    return state.selectedRouterId;
  }

  function runDijkstraView() {
    const sourceId = requireSelectedSource();
    if (!sourceId) return;
    renderSelectedRouterPanels();
    UI.logLocal("Route Recomputed", `Dijkstra routing table for ${sourceId} shown in the right panel.`);
    UI.toast("Dijkstra routing table shown in the Routing Table panel.", "success");
  }

  async function runTraversal(kind) {
    const sourceId = requireSelectedSource();
    if (!sourceId) return;
    try {
      const res = kind === "bfs" ? await API.bfs(sourceId) : await API.dfs(sourceId);
      UI.logLocal(kind.toUpperCase(), `Traversal order from ${sourceId}: ${res.order.join(" → ")}`);
      for (const id of res.order) {
        NetworkView.pulseRouter(id, kind.toUpperCase());
        await Anim.wait(280);
      }
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }

  async function runBellman() {
    const sourceId = requireSelectedSource();
    if (!sourceId) return;
    try {
      const res = await API.bellman(sourceId);
      const summary = Object.entries(res.distances)
        .filter(([id]) => id !== sourceId)
        .map(([id, cost]) => `${id}=${cost === null ? "unreachable" : cost}`)
        .join(", ");
      UI.logLocal("BELLMAN-FORD", `From ${sourceId}: ${summary || "no other routers"} (${res.iterations} iterations).`);
      for (const id of Object.keys(res.distances)) {
        if (res.distances[id] !== null) {
          NetworkView.pulseRouter(id, "BF");
          await Anim.wait(220);
        }
      }
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }

  // ------------------------------------------------------------------
  // SEND DATA MODAL
  // ------------------------------------------------------------------
  function wireSendModal() {
    document.getElementById("btnSendData").addEventListener("click", () => {
      if (state.routers.length < 2) {
        UI.toast("Add at least two routers first.", "error");
        return;
      }
      UI.openSendModal();
    });
    document.getElementById("sendModalCancel").addEventListener("click", () => UI.closeSendModal());

    document.getElementById("btnSendConfirm").addEventListener("click", async () => {
      const source = document.getElementById("sendSource").value;
      const destination = document.getElementById("sendDestination").value;
      const message = document.getElementById("sendMessage").value;

      if (!source || !destination) {
        UI.toast("Add at least two routers first.", "error");
        return;
      }
      if (source === destination) {
        UI.toast("Source and destination must be different routers.", "error");
        return;
      }
      if (!message.trim()) {
        UI.toast("Type a message to transmit.", "error");
        return;
      }
      UI.closeSendModal();
      await PacketFlow.run(source, destination, message);
    });
  }

  function wireNameModalCloseOnOverlay() {
    ["namePromptOverlay", "sendModalOverlay"].forEach(id => {
      document.getElementById(id).addEventListener("click", (e) => {
        if (e.target.id === id) {
          if (id === "sendModalOverlay") UI.closeSendModal();
        }
      });
    });
  }

  // ------------------------------------------------------------------
  // RESET
  // ------------------------------------------------------------------
  function wireResetButton() {
    document.getElementById("btnReset").addEventListener("click", async () => {
      if (state.routers.length === 0) {
        UI.toast("Nothing to reset.", "info");
        return;
      }
      if (!UI.confirmDialog("Reset the entire topology? This deletes every router and link.")) return;
      try {
        await Promise.all(state.routers.map(r => API.deleteRouter(r.id)));
        UI.logLocal("System", "Topology reset by user.");
        UI.toast("Topology reset.", "success");
      } catch (err) {
        UI.toast(err.message, "error");
      }
      deselectRouter();
      NetworkView.clearHighlight();
      UI.clearTransmissionStatus();
      UI.renderPacketDetails([]);
      await refreshAll();
    });
  }

  // ------------------------------------------------------------------
  // CONSOLE CONTROLS
  // ------------------------------------------------------------------
  function wireConsoleControls() {
    document.getElementById("consoleHeader").addEventListener("click", (e) => {
      if (e.target.id === "clearConsole") return;
      UI.toggleConsole();
    });
    document.getElementById("clearConsole").addEventListener("click", (e) => {
      e.stopPropagation();
      UI.clearConsole();
    });
  }

  // ------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // ------------------------------------------------------------------
  function wireShortcuts() {
    Shortcuts.init({
      "a": () => setMode("add-router"),
      "c": () => setMode("connect"),
      "x": () => setMode("delete-router"),
      "v": () => setMode("delete-link"),
      "z": () => setMode("fail-link"),
      "m": () => setMode("move"),
      "j": () => runDijkstraView(),
      "b": () => runTraversal("bfs"),
      "f": () => runTraversal("dfs"),
      "n": () => runBellman(),
      "s": () => document.getElementById("btnSendData").click(),
      "r": () => document.getElementById("btnReset").click(),
    }, cancelMode);
  }

  // ------------------------------------------------------------------
  // DATA REFRESH
  // ------------------------------------------------------------------
  async function refreshTopology() {
    try {
      const [routers, links] = await Promise.all([API.listRouters(), API.listLinks()]);
      state.routers = routers;
      state.links = links;
      NetworkView.render(routers, links);
      UI.populateRouterSelects(routers);
      if (state.selectedRouterId && routers.some(r => r.id === state.selectedRouterId)) {
        NetworkView.setRouterSelected(state.selectedRouterId, true);
        renderSelectedRouterPanels();
      } else {
        state.selectedRouterId = null;
      }
    } catch (err) {
      // API offline - status dot already communicates this
    }
  }

  async function pollTelemetry() {
    try {
      const [events, stats] = await Promise.all([API.getEvents(200), API.getStats()]);
      UI.syncConsole(events);
      UI.renderStats(stats);
    } catch (err) {
      // ignore - health check handles the offline indicator
    }
  }

  async function refreshAll() {
    await refreshTopology();
    await pollTelemetry();
  }

  function findLink(a, b) {
    return state.links.find(l =>
      (l.source === a && l.destination === b) || (l.source === b && l.destination === a)
    );
  }

  return { init, refreshAll, findLink, state };
})();

document.addEventListener("DOMContentLoaded", App.init);