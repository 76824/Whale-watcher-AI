/* live-signals.js — frontend poller for Chenda backend (Render)
   - Works with window.CHENDA_BACKEND or window.CHENDA_SIGNAL_URL
   - Calls only /signal (+ /health once)
   - Renders into #kraken-list, #binance-list, #metrics-pre, #last-updated
   - Emits: chenda:signal with {detail:data}; listens to chenda:manualRefresh
*/
(() => {
  "use strict";

  const RAW_BASE =
    (typeof window.CHENDA_BACKEND === "string" && window.CHENDA_BACKEND) ||
    (typeof window.CHENDA_SIGNAL_URL === "string" && window.CHENDA_SIGNAL_URL) || "";

  if (!RAW_BASE) {
    console.error("[Chenda] No backend base URL set. Add:");
    console.error('<script>window.CHENDA_BACKEND="https://whale-watcher-ai.onrender.com"</script>');
  }
  const BASE = RAW_BASE.replace(/\/+$/, "");
  const ENDPOINTS = { health: `${BASE}/health`, signal: `${BASE}/signal` };

  const $ = (s) => document.querySelector(s);
  const setText = (s, t) => { const el = $(s); if (el) el.textContent = t; };
  const setHTML = (s, h) => { const el = $(s); if (el) el.innerHTML = h; };
  const esc = (x) => String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const fmt = (n, d=2) => (isFinite(+n) ? Number(n).toLocaleString(undefined,{maximumFractionDigits:d}) : "-");

  function rowHTML(w) {
    const sym = w.symbol || w.sym || "-";
    const p   = fmt(w.price, 6);
    const q   = fmt(w.qty, 2);
    const usd = fmt(w.usd, 0);
    const side= (w.side || w.side_guess || "").toUpperCase();
    const ven = (w.price_venue || "").toUpperCase();
    return `<div class="row">
      <div class="row-left">
        <div class="symbol">${esc(sym)}</div>
        <div class="venue pill">${esc(ven || "—")}</div>
      </div>
      <div class="row-right">
        <span class="pill">${side || "-"}</span>
        <span class="pill">P: ${p}</span>
        <span class="pill">Q: ${q}</span>
        <span class="pill">$: ${usd}</span>
      </div>
    </div>`;
  }

  function render(data) {
    if (data?.ts) setText("#last-updated", new Date(data.ts*1000).toLocaleString());

    if ($("#metrics-pre")) {
      setHTML("#metrics-pre", `<pre>${esc(JSON.stringify(data, null, 2))}</pre>`);
    }

    const whales = Array.isArray(data?.whales) ? data.whales : [];
    const byVenue = { kraken: [], binance: [] };
    for (const w of whales) {
      const v = (w.price_venue || "").toLowerCase();
      (byVenue[v] || (byVenue[v] = [])).push(w);
    }

    const kBox = $("#kraken-list");
    const bBox = $("#binance-list");
    if (kBox) kBox.innerHTML = byVenue.kraken.length ? byVenue.kraken.map(rowHTML).join("") : `<div class="empty">No items.</div>`;
    if (bBox) bBox.innerHTML = byVenue.binance.length ? byVenue.binance.map(rowHTML).join("") : `<div class="empty">No items.</div>`;

    window.dispatchEvent(new CustomEvent("chenda:signal", { detail: data }));
  }

  async function healthOnce() {
    if (!BASE) return;
    try {
      const r = await fetch(ENDPOINTS.health, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      console.log("[Chenda] /health OK");
    } catch (e) {
      console.warn("[Chenda] /health failed (non-blocking):", e);
    }
  }

  async function pull() {
    if (!BASE) return;
    try {
      const r = await fetch(ENDPOINTS.signal, { cache: "no-store" });
      const ct = r.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await r.text();
        throw new Error("Expected JSON, got: " + text.slice(0, 180));
      }
      const data = await r.json();
      render(data);
    } catch (e) {
      console.error("[Chenda] /signal error:", e);
      setHTML("#metrics-pre", `<div class="empty">Fetch failed: ${esc(e.message || e)}</div>`);
    }
  }

  healthOnce();
  pull();
  const iv = setInterval(pull, 5000);
  window.addEventListener("chenda:manualRefresh", () => pull());
  window.addEventListener("beforeunload", () => clearInterval(iv));
})();