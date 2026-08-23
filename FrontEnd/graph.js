/**
 * graph.js
 * --------
 * Owns the SVG canvas: drawing routers/links from state, and turning
 * raw pointer events into semantic callbacks (onCanvasClick,
 * onRouterClick, onLinkClick, onRouterDrag...) that script.js wires
 * up to actual API calls. Visual-only helpers (glow states, path
 * highlighting, pulses) are also exposed here for animation.js /
 * packet.js to call into.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const NetworkView = (() => {
  let svg, linksLayer, packetLayer, routersLayer, previewLayer;
  let handlers = {};
  let draggingId = null;
  let dragMoved = false;
  let dragOffset = { x: 0, y: 0 };
  let currentRouters = [];
  let currentLinks = [];

  function init(svgEl, opts) {
    svg = svgEl;
    linksLayer = svg.querySelector("#linksLayer");
    packetLayer = svg.querySelector("#packetLayer");
    routersLayer = svg.querySelector("#routersLayer");
    previewLayer = svg.querySelector("#previewLayer");
    handlers = opts || {};

    svg.addEventListener("click", onSvgClick);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointerleave", onPointerUp);
  }

  function svgPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  function onSvgClick(evt) {
    if (evt.target === svg || evt.target.tagName === "svg") {
      const p = svgPoint(evt);
      handlers.onCanvasClick && handlers.onCanvasClick(p.x, p.y);
    }
  }

  function onPointerMove(evt) {
    const p = svgPoint(evt);
    handlers.onCanvasHover && handlers.onCanvasHover(p.x, p.y);

    if (!draggingId) return;
    dragMoved = true;
    const x = p.x - dragOffset.x;
    const y = p.y - dragOffset.y;
    updateRouterPosition(draggingId, x, y);
  }

  function onPointerUp() {
    if (draggingId) {
      const router = currentRouters.find(r => r.id === draggingId);
      if (router && dragMoved) {
        handlers.onRouterDragEnd && handlers.onRouterDragEnd(draggingId, router._liveX, router._liveY);
      }
      draggingId = null;
    }
  }

  function updateRouterPosition(id, x, y) {
    const router = currentRouters.find(r => r.id === id);
    if (!router) return;
    router._liveX = x;
    router._liveY = y;
    const g = routersLayer.querySelector(`[data-router-id="${id}"]`);
    if (g) g.setAttribute("transform", `translate(${x}, ${y})`);

    currentLinks.forEach(link => {
      if (link.source === id || link.destination === id) {
        const lineEl = linksLayer.querySelector(`[data-link-line="${link.id}"]`);
        const hitEl = linksLayer.querySelector(`[data-link-hit="${link.id}"]`);
        const labelEl = linksLayer.querySelector(`[data-link-label="${link.id}"]`);
        const src = currentRouters.find(r => r.id === link.source);
        const dst = currentRouters.find(r => r.id === link.destination);
        if (!src || !dst) return;
        const sx = src._liveX ?? src.x, sy = src._liveY ?? src.y;
        const dx = dst._liveX ?? dst.x, dy = dst._liveY ?? dst.y;
        if (lineEl) { lineEl.setAttribute("x1", sx); lineEl.setAttribute("y1", sy); lineEl.setAttribute("x2", dx); lineEl.setAttribute("y2", dy); }
        if (hitEl) { hitEl.setAttribute("x1", sx); hitEl.setAttribute("y1", sy); hitEl.setAttribute("x2", dx); hitEl.setAttribute("y2", dy); }
        if (labelEl) { labelEl.setAttribute("x", (sx + dx) / 2); labelEl.setAttribute("y", (sy + dy) / 2 - 8); }
      }
    });
  }

  function render(routers, links) {
    currentRouters = routers.map(r => ({ ...r, _liveX: r.x, _liveY: r.y }));
    currentLinks = links;
    renderLinks();
    renderRouters();
  }

  function renderLinks() {
    linksLayer.innerHTML = "";
    currentLinks.forEach(link => {
      const src = currentRouters.find(r => r.id === link.source);
      const dst = currentRouters.find(r => r.id === link.destination);
      if (!src || !dst) return;

      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("data-link-group", link.id);

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", src.x); line.setAttribute("y1", src.y);
      line.setAttribute("x2", dst.x); line.setAttribute("y2", dst.y);
      line.setAttribute("class", "link-line hoverable" + (link.status === "down" ? " down" : ""));
      line.setAttribute("data-link-line", link.id);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", (src.x + dst.x) / 2);
      label.setAttribute("y", (src.y + dst.y) / 2 - 8);
      label.setAttribute("class", "link-cost-label");
      label.setAttribute("data-link-label", link.id);
      label.textContent = `${link.cost}`;

      const hit = document.createElementNS(SVG_NS, "line");
      hit.setAttribute("x1", src.x); hit.setAttribute("y1", src.y);
      hit.setAttribute("x2", dst.x); hit.setAttribute("y2", dst.y);
      hit.setAttribute("class", "link-hit");
      hit.setAttribute("data-link-hit", link.id);
      hit.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onLinkClick && handlers.onLinkClick(link);
      });
      hit.addEventListener("pointerenter", () => handlers.onLinkHover && handlers.onLinkHover(link, true));
      hit.addEventListener("pointerleave", () => handlers.onLinkHover && handlers.onLinkHover(link, false));

      g.appendChild(line);
      g.appendChild(label);
      g.appendChild(hit);
      linksLayer.appendChild(g);
    });
  }

  function renderRouters() {
    routersLayer.innerHTML = "";
    currentRouters.forEach(router => {
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "router-node" + (router.status === "down" ? " down" : ""));
      g.setAttribute("data-router-id", router.id);
      g.setAttribute("data-state", "idle");
      g.setAttribute("transform", `translate(${router.x}, ${router.y})`);

      const halo = document.createElementNS(SVG_NS, "circle");
      halo.setAttribute("r", "26");
      halo.setAttribute("class", "router-halo");

      const glowRing = document.createElementNS(SVG_NS, "circle");
      glowRing.setAttribute("r", "18");
      glowRing.setAttribute("class", "router-glow-ring");

      const core = document.createElementNS(SVG_NS, "circle");
      core.setAttribute("r", "17");
      core.setAttribute("class", "router-core");

      // simple router glyph (radiating antenna lines) drawn inside the core
      const icon = document.createElementNS(SVG_NS, "g");
      icon.setAttribute("class", "router-icon");
      icon.innerHTML = `
        <path d="M -7 4 L 7 4" />
        <path d="M -5 8 L 5 8" />
        <circle cx="0" cy="-3" r="2.4" />
        <path d="M 0 -5.4 L 0 -9" />
      `;

      const spinner = document.createElementNS(SVG_NS, "circle");
      spinner.setAttribute("r", "22");
      spinner.setAttribute("class", "router-spinner");
      spinner.setAttribute("data-spinner", "1");
      spinner.setAttribute("stroke-dasharray", "10 90");

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("y", "34");
      label.setAttribute("class", "router-label");
      label.textContent = router.name;

      const sub = document.createElementNS(SVG_NS, "text");
      sub.setAttribute("y", "47");
      sub.setAttribute("class", "router-sub");
      sub.textContent = router.id;

      const statusLabel = document.createElementNS(SVG_NS, "text");
      statusLabel.setAttribute("y", "-30");
      statusLabel.setAttribute("class", "router-status-label");
      statusLabel.setAttribute("data-status-label", "1");
      statusLabel.textContent = "";

      g.appendChild(halo);
      g.appendChild(spinner);
      g.appendChild(glowRing);
      g.appendChild(core);
      g.appendChild(icon);
      g.appendChild(label);
      g.appendChild(sub);
      g.appendChild(statusLabel);

      g.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        if (handlers.getMode && handlers.getMode() === "move") {
          const p = svgPoint(e);
          dragOffset = { x: p.x - router.x, y: p.y - router.y };
          draggingId = router.id;
          dragMoved = false;
        }
      });

      g.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onRouterClick && handlers.onRouterClick(router);
      });

      routersLayer.appendChild(g);
    });
  }

  // ------------------------------------------------------------------
  // VISUAL HELPERS
  // ------------------------------------------------------------------
  function getRouterPosition(id) {
    const r = currentRouters.find(x => x.id === id);
    if (!r) return null;
    return { x: r._liveX ?? r.x, y: r._liveY ?? r.y };
  }

  function setRouterSelected(id, selected) {
    const g = routersLayer.querySelector(`[data-router-id="${id}"]`);
    if (g) g.classList.toggle("selected", selected);
  }

  function clearAllSelected() {
    routersLayer.querySelectorAll(".router-node.selected").forEach(g => g.classList.remove("selected"));
  }

  function pulseRouter(id, statusText) {
    const g = routersLayer.querySelector(`[data-router-id="${id}"]`);
    if (!g) return;
    g.classList.remove("pulse");
    void g.offsetWidth;
    g.classList.add("pulse");

    const label = g.querySelector("[data-status-label]");
    if (label && statusText) {
      label.textContent = statusText;
      label.classList.add("show");
      clearTimeout(label._hideTimer);
      label._hideTimer = setTimeout(() => label.classList.remove("show"), 900);
    }
  }

  /** Sets the semantic transmission state of a router: idle | receiving | processing | forwarding */
  function setRouterState(id, state, label) {
    const g = routersLayer.querySelector(`[data-router-id="${id}"]`);
    if (!g) return;
    g.setAttribute("data-state", state);

    const spinner = g.querySelector("[data-spinner]");
    const statusLabel = g.querySelector("[data-status-label]");
    if (spinner) {
      spinner.classList.remove("state-receiving", "state-processing", "state-forwarding", "show");
      if (state !== "idle") spinner.classList.add(`state-${state}`, "show");
    }
    if (statusLabel) {
      statusLabel.classList.remove("state-receiving", "state-processing", "state-forwarding");
      if (state !== "idle") {
        statusLabel.classList.add(`state-${state}`, "show");
        statusLabel.textContent = label || state;
      } else {
        statusLabel.classList.remove("show");
      }
    }
  }

  function resetAllRouterStates() {
    currentRouters.forEach(r => setRouterState(r.id, "idle"));
  }

  function highlightPath(pathIds) {
    linksLayer.querySelectorAll(".link-line").forEach(l => l.classList.remove("selected-path"));
    if (!pathIds || pathIds.length < 2) return;
    for (let i = 0; i < pathIds.length - 1; i++) {
      const a = pathIds[i], b = pathIds[i + 1];
      const link = currentLinks.find(l =>
        (l.source === a && l.destination === b) || (l.source === b && l.destination === a)
      );
      if (link) {
        const el = linksLayer.querySelector(`[data-link-line="${link.id}"]`);
        if (el) el.classList.add("selected-path");
      }
    }
  }

  function setLinkActiveFlow(a, b, active) {
    const link = currentLinks.find(l =>
      (l.source === a && l.destination === b) || (l.source === b && l.destination === a)
    );
    if (!link) return;
    const el = linksLayer.querySelector(`[data-link-line="${link.id}"]`);
    if (el) el.classList.toggle("active-flow", active);
  }

  function clearHighlight() {
    linksLayer.querySelectorAll(".link-line").forEach(l => {
      l.classList.remove("selected-path");
      l.classList.remove("active-flow");
    });
  }

  function getPacketLayer() { return packetLayer; }

  function showPendingLink(fromId, toX, toY) {
    const from = getRouterPosition(fromId);
    if (!from) return;
    previewLayer.innerHTML = "";
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", from.x); line.setAttribute("y1", from.y);
    line.setAttribute("x2", toX); line.setAttribute("y2", toY);
    line.setAttribute("class", "pending-link");
    previewLayer.appendChild(line);
  }

  function clearPendingLink() {
    previewLayer.innerHTML = "";
  }

  function getRouters() { return currentRouters; }
  function getLinks() { return currentLinks; }

  return {
    init, render,
    getRouterPosition, getRouters, getLinks,
    setRouterSelected, clearAllSelected,
    pulseRouter, setRouterState, resetAllRouterStates,
    highlightPath, clearHighlight, setLinkActiveFlow,
    getPacketLayer,
    showPendingLink, clearPendingLink,
  };
})();
