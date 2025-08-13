// ===============================
// Chenda Live Signals Frontend
// ===============================
(function () {
  "use strict";

  const API = (window.CHENDA_API_BASE || "").replace(/\/+$/, "");
  const BASE = API || "";

  async function safeGet(path) {
    const url = BASE + path;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      return { ok: false, error: String(e), path };
    }
  }

  async function refreshAll() {
    const [sig, uni] = await Promise.all([
      safeGet("/signal"),
      safeGet("/universe")
    ]);

    const sOut = document.getElementById("signalOut");
    const uOut = document.getElementById("universeOut");
    if (sOut) sOut.textContent = JSON.stringify(sig, null, 2);
    if (uOut) uOut.textContent = JSON.stringify(uni, null, 2);

    // If a symbol input exists, fetch its books
    const symInput = document.getElementById("symbol");
    const booksOut = document.getElementById("booksOut");
    if (symInput && symInput.value && booksOut) {
      const sym = symInput.value.trim().toUpperCase();
      const b = await safeGet("/books?symbol=" + encodeURIComponent(sym));
      booksOut.textContent = JSON.stringify(b, null, 2);
    }
  }

  window.addEventListener("load", () => {
    refreshAll();
    setInterval(refreshAll, 5000);
  });
})();
