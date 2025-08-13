/* ==============================================
   Chenda Live Signals (frontend, vanilla JS)
   - Utilities (logo, base symbol extraction)
   - Simple client for /signal, /books, /universe, /last
   - Safe, debounced polling with error handling
   ============================================== */

(function () {
  "use strict";

  // -------------------- Config --------------------
  // Override from HTML before this script loads:
  //   <script>window.CHENDA_API_BASE="https://whale-watcher-ai.onrender.com"</script>
  var API_BASE = (window.CHENDA_API_BASE || "https://whale-watcher-ai.onrender.com").replace(/\/+$/,"");

  // Public API (exposed at end)
  var LiveSignals = {};

  // -------------------- Utils ---------------------
  var COMMON_QUOTES = [
    "USDT","USDC","TUSD","BUSD","USD","EUR","GBP","AUD","TRY","BRL","JPY","CAD",
    "CHF","ZAR","NGN","RUB","IDR","ARS","AED","KRW","MXN","PLN","SGD","BTC","ETH","BNB"
  ];

  var ALIAS = {
    "LINK":"Chainlink","BTC":"Bitcoin","ETH":"Ethereum","SOL":"Solana","ADA":"Cardano",
    "BNB":"BNB","XRP":"XRP","DOGE":"Dogecoin","AVAX":"Avalanche","MATIC":"Polygon",
    "DOT":"Polkadot","PEPE":"PEPE","SHIB":"Shiba Inu","NEO":"NEO","LTC":"Litecoin",
    "ALGO":"Algorand","JASMY":"Jasmy","BONK":"BONK","PEPE":"PEPE"
  };

  function normalizePair(sym) {
    return String(sym || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function getBaseAsset(sym) {
    var s = normalizePair(sym);
    for (var i = 0; i < COMMON_QUOTES.length; i++) {
      var q = COMMON_QUOTES[i];
      if (s.length > q.length && s.endsWith(q)) {
        return s.slice(0, s.length - q.length);
      }
    }
    return s.slice(0, Math.max(3, Math.min(5, s.length)));
  }

  function hashInt(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function hslToHex(h, s, l) {
    s = s / 100; l = l / 100;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs((h / 60) % 2 - 1));
    var m = l - c / 2;
    var r = 0, g = 0, b = 0;
    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    var R = Math.round((r + m) * 255);
    var G = Math.round((g + m) * 255);
    var B = Math.round((b + m) * 255);
    function toHex(n) { var s = n.toString(16); return s.length === 1 ? "0" + s : s; }
    return "#" + toHex(R) + toHex(G) + toHex(B);
  }

  function placeholderData(base) {
    var letter = (String(base).toUpperCase().charAt(0) || "?");
    var hue = (hashInt(base) % 360);
    var bg = hslToHex(hue, 65, 38);
    var fg = "#e7ecf5";
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="12" ry="12" fill="' + bg + '"/>' +
      '<text x="50%" y="55%" text-anchor="middle" font-size="30" font-family="Inter,Segoe UI,Arial" fill="' + fg + '">' +
      letter +
      "</text></svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function logoUrlsFor(base) {
    var s = String(base || "").toLowerCase();
    return [
      "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/64/color/" + s + ".png",
      "https://raw.githubusercontent.com/ErikThiart/cryptocurrency-icons/master/64/color/" + s + ".png",
      "https://cryptoicons.org/api/icon/" + s + "/64"
    ];
  }

  function friendlyName(base) {
    var u = String(base || "").toUpperCase();
    return ALIAS[u] ? ALIAS[u] : u;
  }

  // --------------- HTTP helpers ------------------
  async function getJSON(path) {
    var url = (path.startsWith("http") ? path : (API_BASE + path));
    var res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
    return await res.json();
  }

  // --------------- API methods -------------------
  LiveSignals.fetchSignal = async function(min_usd) {
    var q = (typeof min_usd === "number" ? ("?min_usd=" + encodeURIComponent(min_usd)) : "");
    return await getJSON("/signal" + q);
  };

  LiveSignals.fetchBooks = async function(symbol) {
    var base = (symbol || "XRP").toUpperCase();
    return await getJSON("/books?symbol=" + encodeURIComponent(base));
  };

  LiveSignals.fetchUniverse = async function() {
    return await getJSON("/universe");
  };

  LiveSignals.fetchLast = async function() {
    return await getJSON("/last");
  };

  // --------------- Simple rendering --------------
  // Optional helper to render a list of findings into a container element
  LiveSignals.renderFindings = function(container, findings) {
    if (!container) return;
    container.innerHTML = "";
    if (!Array.isArray(findings) || findings.length === 0) {
      container.innerHTML = '<div class="empty">No signals yet.</div>';
      return;
    }
    findings.forEach(function(f) {
      var sym = String(f.symbol || f.base || "N/A").toUpperCase();
      var base = getBaseAsset(sym + "USDT"); // best-effort
      var card = document.createElement("div");
      card.className = "signal-card";
      var img = document.createElement("img");
      img.className = "logo";
      img.alt = base + " logo";
      img.src = placeholderData(base);
      // try remote logos
      (function tryLogos(urls, idx){
        if (idx >= urls.length) return;
        var test = new Image();
        test.onload = function(){ img.src = urls[idx]; };
        test.onerror = function(){ tryLogos(urls, idx+1); };
        test.src = urls[idx];
      })(logoUrlsFor(base), 0);

      var title = document.createElement("div");
      title.className = "title";
      title.textContent = friendlyName(base) + " (" + base + ")";

      var meta = document.createElement("div");
      meta.className = "meta";
      var score = (f.score != null ? ("Score: " + f.score) : "");
      var price = (f.price != null ? ("Price: " + f.price) : "");
      var reason = (f.reason ? f.reason : "");
      meta.textContent = [score, price, reason].filter(Boolean).join(" • ");

      card.appendChild(img);
      card.appendChild(title);
      card.appendChild(meta);
      container.appendChild(card);
    });
  };

  // --------------- Auto-poll helpers -------------
  var pollTimers = {};

  LiveSignals.startPolling = function(key, fn, intervalMs, onData, onError) {
    LiveSignals.stopPolling(key);
    async function tick() {
      try {
        var data = await fn();
        if (onData) onData(data);
      } catch (e) {
        if (onError) onError(e);
        console.error("Polling error (" + key + "):", e);
      } finally {
        pollTimers[key] = setTimeout(tick, intervalMs);
      }
    }
    tick();
  };

  LiveSignals.stopPolling = function(key) {
    if (pollTimers[key]) {
      clearTimeout(pollTimers[key]);
      delete pollTimers[key];
    }
  };

  // --------------- Expose on window --------------
  window.LiveSignals = LiveSignals;
  window.ChendaUtils = {
    COMMON_QUOTES: COMMON_QUOTES,
    ALIAS: ALIAS,
    normalizePair: normalizePair,
    getBaseAsset: getBaseAsset,
    hashInt: hashInt,
    hslToHex: hslToHex,
    placeholderData: placeholderData,
    logoUrlsFor: logoUrlsFor,
    friendlyName: friendlyName
  };
})();
