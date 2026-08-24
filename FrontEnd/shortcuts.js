

const Shortcuts = (() => {
  let bindings = {};
  let escapeHandler = null;

  function init(map, onEscape) {
    bindings = map;
    escapeHandler = onEscape;
    document.addEventListener("keydown", handleKeydown);
  }

  function isTyping(target) {
    const tag = (target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      escapeHandler && escapeHandler();
      return;
    }
    if (isTyping(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key.toLowerCase();
    const handler = bindings[key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  }

  return { init };
})();
