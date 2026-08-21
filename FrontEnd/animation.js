/**
 * animation.js
 * ------------
 * Low level animation primitives built on requestAnimationFrame.
 * packet.js calls `animateBinaryAcrossLink` once per hop; this module
 * doesn't know anything about packets, routing, or the API - it just
 * moves an SVG <text> + glow orb from point A to point B.
 */

const Anim = (() => {

  /**
   * Animates the actual binary payload sliding from (x1,y1) to (x2,y2)
   * along a straight line, led by a small glowing orb. Resolves when
   * the animation completes.
   */
  function animateBinaryAcrossLink(layer, binaryText, x1, y1, x2, y2, durationMs = 850) {
    return new Promise((resolve) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

      const orb = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      orb.setAttribute("r", "3.2");
      orb.setAttribute("class", "packet-orb");

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("class", "binary-particle");
      text.textContent = truncateBinary(binaryText);

      group.appendChild(orb);
      group.appendChild(text);
      layer.appendChild(group);

      const start = performance.now();

      function frame(now) {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = easeInOutQuad(t);
        const x = x1 + (x2 - x1) * eased;
        const y = y1 + (y2 - y1) * eased;

        orb.setAttribute("cx", x);
        orb.setAttribute("cy", y);
        text.setAttribute("x", x);
        text.setAttribute("y", y - 8);

        let opacity = 1;
        if (t < 0.12) opacity = t / 0.12;
        else if (t > 0.88) opacity = (1 - t) / 0.12;
        group.setAttribute("opacity", opacity.toFixed(2));

        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          layer.removeChild(group);
          resolve();
        }
      }
      requestAnimationFrame(frame);
    });
  }

  function truncateBinary(bin, max = 26) {
    if (bin.length <= max) return bin;
    return bin.slice(0, max) + "…";
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return { animateBinaryAcrossLink, wait };
})();