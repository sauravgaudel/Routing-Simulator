/**
 * api.js
 * ------
 * Thin wrapper around fetch() for every backend endpoint. Pure data
 * layer - no DOM access. Talks to the existing FastAPI backend
 * exactly as before; nothing here changes the backend contract.
 */

const API = (() => {
  const BASE_URL = "http://127.0.0.1:8000";

  async function request(method, path, body) {
    const options = { method, headers: {} };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const res = await fetch(BASE_URL + path, options);
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const errJson = await res.json();
        detail = errJson.detail || detail;
      } catch (_) { /* ignore parse errors */ }
      throw new Error(detail);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    BASE_URL,

    ping: () => request("GET", "/"),

    createRouter: (name, x, y) => request("POST", "/router", { name, x, y }),
    deleteRouter: (id) => request("DELETE", `/router/${id}`),
    moveRouter: (id, x, y) => request("POST", "/move_router", { id, x, y }),
    listRouters: () => request("GET", "/routers"),

    createLink: (source, destination) => request("POST", "/link", { source, destination }),
    deleteLink: (source, destination) => request("DELETE", "/link", { source, destination }),
    failLink: (source, destination) => request("POST", "/link/fail", { source, destination }),
    restoreLink: (source, destination) => request("POST", "/link/restore", { source, destination }),
    listLinks: () => request("GET", "/links"),

    route: (source, destination) => request("POST", "/route", { source, destination }),
    bfs: (source) => request("POST", "/bfs", { source }),
    dfs: (source) => request("POST", "/dfs", { source }),
    bellman: (source) => request("POST", "/bellman", { source }),

    send: (source, destination, message) => request("POST", "/send", { source, destination, message }),

    getEvents: (limit = 100) => request("GET", `/events?limit=${limit}`),
    getStats: () => request("GET", "/stats"),
  };
})();