# ===== Chenda Orderbook (auto-scan on startup + periodic refresh) =====
# Python 3.11+. Streams public depth/trades and computes metrics.

import os, json, time, asyncio
from collections import defaultdict, deque
import logging
from logging.handlers import RotatingFileHandler

import aiohttp
from aiohttp import web
import websockets
from dotenv import load_dotenv

# ---------- A) Config & env ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(BASE_DIR, "config.json")
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Logging (optional)
LOG_PATH = os.path.join(BASE_DIR, "chenda.log")
logger = logging.getLogger("chenda")
logger.setLevel(logging.INFO)
_handler = RotatingFileHandler(LOG_PATH, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
_handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
logger.addHandler(_handler)

with open(CFG_PATH, "r", encoding="utf-8") as f:
    CFG = json.load(f)

print(
    "CFG loaded:",
    list(CFG.keys()),
    "binance:", len(CFG.get("binance_symbols", [])),
    "kraken:", len(CFG.get("kraken_pairs", [])),
)

# Feature flags / tunables
ENABLE_GLOBAL_SCAN = bool(int(os.getenv("ENABLE_GLOBAL_SCAN", "1")))
GLOBAL_SCAN_EVERY_SEC = int(os.getenv("GLOBAL_SCAN_EVERY_SEC", "300"))  # 5 min default

BINANCE_WS = "wss://stream.binance.com:9443/ws"
BINANCE_REST_DEPTH_TMPL = "https://api.binance.com/api/v3/depth?symbol={sym}&limit={limit}"
BINANCE_TICKERS_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_INFO_URL    = "https://api.binance.com/api/v3/exchangeInfo"
KRAKEN_WS = "wss://ws.kraken.com"

DEPTH_LIMIT     = int(CFG.get("depth", 100))
BAND            = float(CFG.get("metrics_band_pct", 0.01))
WHALE_QTY       = float(CFG.get("whale_qty", 100000))
TRADE_WIN_SEC   = int(CFG.get("trade_window_sec", 300))
DEFAULT_PORT    = int(CFG.get("port", 8080))
MAX_SYMBOLS     = int(CFG.get("max_symbols", 25))
SCAN_INTERVAL   = int(CFG.get("scan_interval_sec", 600))

SEED_SYMBOLS    = [s.upper() for s in CFG.get("binance_symbols", []) if s.upper().endswith("USDT")]
KRAKEN_PAIRS    = list(CFG.get("kraken_pairs", []))

# ---------- B) State ----------
state = {
    "binance": defaultdict(lambda: {"bids": {}, "asks": {}, "lastUpdateId": None}),
    "kraken":  defaultdict(lambda: {"bids": {}, "asks": {}}),
    "trades":  defaultdict(lambda: deque(maxlen=6000)),  # key: (exchange, symbol/pair)
    "metrics": {}                                        # key: normalized symbol (e.g., XRPUSD)
}

RUNNING_SYMBOLS = set()        # currently streaming Binance symbols
TASKS_PER_SYMBOL = {}          # sym -> [depth_task, trades_task]

GLOBAL_STATE = {
    "universe": {"binance": [], "kraken": [], "ts": 0},
    "books":    {"binance": {}, "kraken": {}},
    "trades":   {"binance": [], "kraken": []},
    "features": {},
    "rings":    {},
    "alerts":   [],
    "errors":   [],
    "last_scan": {},
    "last_findings": [],
    "ts": 0,
}

# ---------- C) Helpers ----------
def prune_book(book: dict, max_levels=300):
    if book.get("bids"):
        bids = sorted(((float(p), float(q)) for p,q in book["bids"].items() if float(q)>0), key=lambda x: -x[0])[:max_levels]
        book["bids"] = {f"{p:.8f}": q for p,q in bids}
    if book.get("asks"):
        asks = sorted(((float(p), float(q)) for p,q in book["asks"].items() if float(q)>0), key=lambda x: x[0])[:max_levels]
        book["asks"] = {f"{p:.8f}": q for p,q in asks}

def apply_l2_update(side_dict, updates):
    for p, q in updates:
        if float(q) == 0.0:
            side_dict.pop(p, None)
        else:
            side_dict[p] = q

def best_bid_ask(bids: dict, asks: dict):
    if not bids or not asks:
        return None, None
    return max(float(p) for p in bids), min(float(p) for p in asks)

def band_volumes(bids: dict, asks: dict, mid: float, band: float):
    lo = mid*(1-band); hi = mid*(1+band)
    bid_vol = sum(float(q) for p,q in bids.items() if float(p) >= lo)
    ask_vol = sum(float(q) for p,q in asks.items() if float(p) <= hi)
    return bid_vol, ask_vol

def now_ms(): return int(time.time()*1000)

def norm_key(exchange: str, symbol_or_pair: str) -> str:
    if exchange == "binance":
        return symbol_or_pair[:-4] if symbol_or_pair.upper().endswith("USDT") else symbol_or_pair
    if exchange == "kraken":
        return symbol_or_pair.replace("/", "")
    return symbol_or_pair

def log_scan_summary(findings):
    if not isinstance(findings, list):
        logger.info("Global scan returned non-list: %s", type(findings))
        return
    ranked = sorted(findings, key=lambda x: x.get("score", 0), reverse=True)[:10]
    lines = [f"{i+1:02d}. {f.get('symbol')}  s={f.get('score')}  p={f.get('price')}  r={f.get('reason','')}" for i, f in enumerate(ranked)]
    logger.info("Global scan: %d candidates. Top:\n%s", len(findings), "\n".join(lines))
    GLOBAL_STATE["last_scan"] = {"ts": time.time(), "count": len(findings)}
    GLOBAL_STATE["last_findings"] = ranked

def detect_whale_levels(symbol="XRPUSDT", min_usd=200000):
    """Return whale levels (>= min_usd notional) for one symbol across Binance (XRPUSDT) and Kraken (XRP/USD)."""
    result = {"bids": [], "asks": []}

    # Binance
    b_book = state["binance"].get(symbol, {})
    for side_name in ("bids", "asks"):
        side = b_book.get(side_name, {})
        for p_str, q_str in side.items():
            try:
                p = float(p_str); q = float(q_str)
            except Exception:
                continue
            usd = p * q
            if usd >= min_usd:
                result[side_name].append({"price": p, "qty": q, "usd": usd, "ex": "binance"})

    # Kraken
    k_pair = symbol.replace("USDT", "/USD") if symbol.endswith("USDT") else symbol
    k_book = state["kraken"].get(k_pair, {})
    for side_name in ("bids", "asks"):
        side = k_book.get(side_name, {})
        for p_str, q_str in side.items():
            try:
                p = float(p_str); q = float(q_str)
            except Exception:
                continue
            usd = p * q
            if usd >= min_usd:
                result[side_name].append({"price": p, "qty": q, "usd": usd, "ex": "kraken"})

    for s in ("bids", "asks"):
        result[s].sort(key=lambda x: x["usd"], reverse=True)
    return result if (result["bids"] or result["asks"]) else {}

def detect_whale_levels_all(min_usd=200000):
    out = {}
    for sym in sorted(list(RUNNING_SYMBOLS)):
        levels = detect_whale_levels(sym, min_usd=min_usd)
        if levels:
            out[sym] = levels
    return out

# ---------- D) Binance loops ----------
async def binance_depth_loop(sym: str):
    url = BINANCE_REST_DEPTH_TMPL.format(sym=sym, limit=min(DEPTH_LIMIT, 1000))
    async with aiohttp.ClientSession() as sess:
        async with sess.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            snap = await resp.json()
    book = state["binance"][sym]
    book["bids"] = {p:q for p,q in snap.get("bids", [])}
    book["asks"] = {p:q for p,q in snap.get("asks", [])}
    book["lastUpdateId"] = snap.get("lastUpdateId")
    prune_book(book)

    stream = f"{BINANCE_WS}/{sym.lower()}@depth@100ms"
    while True:
        try:
            async with websockets.connect(stream, ping_interval=20, ping_timeout=20) as ws:
                async for raw in ws:
                    d = json.loads(raw)
                    if "u" not in d:
                        continue
                    last_id = book["lastUpdateId"] or 0
                    if d["u"] < last_id:
                        continue
                    if d["U"] <= last_id + 1 <= d["u"]:
                        apply_l2_update(book["bids"], d.get("b", []))
                        apply_l2_update(book["asks"], d.get("a", []))
                        book["lastUpdateId"] = d["u"]
                        prune_book(book)
        except Exception:
            await asyncio.sleep(1.0)

async def binance_trades_loop(sym: str):
    stream = f"{BINANCE_WS}/{sym.lower()}@trade"
    key = ("binance", sym)
    while True:
        try:
            async with websockets.connect(stream, ping_interval=20, ping_timeout=20) as ws:
                async for raw in ws:
                    d = json.loads(raw)
                    price = float(d["p"]); qty = float(d["q"])
                    side = "buy" if not d.get("m", False) else "sell"  # m=True => seller-initiated
                    state["trades"][key].append({"price":price,"qty":qty,"side":side,"ts":int(d["T"])})
        except Exception:
            await asyncio.sleep(1.0)

# ---------- E) Kraken loop ----------
async def kraken_ws_loop(pairs: list[str]):
    if not pairs: return
    subs = [
        {"event":"subscribe","pair":pairs,"subscription":{"name":"book","depth":DEPTH_LIMIT}},
        {"event":"subscribe","pair":pairs,"subscription":{"name":"trade"}}
    ]
    while True:
        try:
            async with websockets.connect(KRAKEN_WS, ping_interval=20, ping_timeout=20) as ws:
                for m in subs: await ws.send(json.dumps(m))
                async for raw in ws:
                    data = json.loads(raw)
                    if not (isinstance(data, list) and len(data) >= 2):
                        continue
                    payload = data[1]
                    pair = data[-1] if isinstance(data[-1], str) else None
                    if not pair: continue
                    if isinstance(payload, dict) and any(k in payload for k in ("as","bs","a","b")):
                        book = state["kraken"][pair]
                        if "bs" in payload or "as" in payload:
                            if "bs" in payload: book["bids"] = {p:q for p,q,_ in payload["bs"]}
                            if "as" in payload: book["asks"] = {p:q for p,q,_ in payload["as"]}
                        else:
                            if "b" in payload: apply_l2_update(book["bids"], [(p,q) for p,q,_ in payload["b"]])
                            if "a" in payload: apply_l2_update(book["asks"], [(p,q) for p,q,_ in payload["a"]])
                        prune_book(book)
                    elif isinstance(payload, list) and payload and isinstance(payload[0], list):
                        key = ("kraken", pair)
                        for t in payload:
                            side = "buy" if t[3] == "b" else "sell"
                            state["trades"][key].append({"price":float(t[0]),"qty":float(t[1]),"side":side,"ts":int(float(t[2])*1000)})
        except Exception:
            await asyncio.sleep(1.0)

# ---------- F) Metrics ----------
def compute_metrics():
    norm_to_sources = defaultdict(list)
    for sym, book in state["binance"].items():
        norm_to_sources[norm_key("binance", sym)].append(("binance", sym, book))
    for pair, book in state["kraken"].items():
        norm_to_sources[norm_key("kraken", pair)].append(("kraken", pair, book))

    out = {}
    for nk, sources in norm_to_sources.items():
        all_bids, all_asks = {}, {}
        best_bid = best_ask = None
        for _, _, book in sources:
            bb, ba = best_bid_ask(book["bids"], book["asks"])
            if bb is not None: best_bid = bb if best_bid is None else max(best_bid, bb)
            if ba is not None: best_ask = ba if best_ask is None else min(best_ask, ba)
            all_bids.update(book["bids"]); all_asks.update(book["asks"])
        if best_bid is None or best_ask is None:
            continue

        mid = (best_bid + best_ask) / 2.0
        band_bid, band_ask = band_volumes(all_bids, all_asks, mid, BAND)
        tot = band_bid + band_ask
        imb = round(100.0 * band_bid / tot, 2) if tot > 0 else None

        cutoff = now_ms() - TRADE_WIN_SEC*1000
        buys = sells = 0.0; whales = 0
        for ex, key, _ in sources:
            dq = state["trades"][(ex, key)]
            for t in dq:
                if t["ts"] >= cutoff:
                    if t["side"] == "buy": buys += t["qty"]
                    else: sells += t["qty"]
                    if t["qty"] >= WHALE_QTY: whales += 1
        total = buys + sells
        buy_pct = round(100.0 * buys / total, 2) if total > 0 else None

        out[nk] = {
            "mid": round(mid, 6),
            "band_bid_xrp": round(band_bid, 2),
            "band_ask_xrp": round(band_ask, 2),
            "imbalance_pct": imb,
            "buy_pct_5m": buy_pct,
            "whale_trades_5m": whales
        }

    state["metrics"] = out

async def metrics_loop():
    while True:
        try: compute_metrics()
        except Exception: pass
        await asyncio.sleep(1.0)

# ---------- G) Dynamic Binance symbol manager ----------
async def start_symbol(sym: str):
    if sym in RUNNING_SYMBOLS: return
    t1 = asyncio.create_task(binance_depth_loop(sym))
    t2 = asyncio.create_task(binance_trades_loop(sym))
    TASKS_PER_SYMBOL[sym] = [t1, t2]
    RUNNING_SYMBOLS.add(sym)
    print(f"[manager] started {sym}")

async def stop_symbol(sym: str):
    tasks = TASKS_PER_SYMBOL.pop(sym, [])
    for t in tasks: t.cancel()
    RUNNING_SYMBOLS.discard(sym)
    state["binance"].pop(sym, None)
    state["trades"].pop(("binance", sym), None)
    print(f"[manager] stopped {sym}")

async def fetch_json(session, url):
    for _ in range(3):
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as r:
                return await r.json()
        except Exception:
            await asyncio.sleep(0.5)
    return None

async def choose_targets(sess):
    """Return a target list of Binance USDT symbols to run (size <= MAX_SYMBOLS)."""
    tickers = await fetch_json(sess, BINANCE_TICKERS_URL)
    info    = await fetch_json(sess, BINANCE_INFO_URL)

    active_spot = set()
    if info and "symbols" in info:
        for x in info["symbols"]:
            if x.get("status") == "TRADING" and x.get("quoteAsset") == "USDT" and x.get("isSpotTradingAllowed", True):
                active_spot.add(x["symbol"])

    pool = []
    if tickers:
        usdt = [t for t in tickers if t.get("symbol","").endswith("USDT")]
        top_vol   = sorted(usdt, key=lambda t: float(t.get("quoteVolume","0") or 0.0), reverse=True)[:12]
        top_move  = sorted(usdt, key=lambda t: abs(float(t.get("priceChangePercent","0") or 0.0)), reverse=True)[:12]
        pool = list({t["symbol"] for t in (top_vol + top_move)})

    target = list(dict.fromkeys(SEED_SYMBOLS + list(RUNNING_SYMBOLS) + [s for s in pool if s in active_spot]))
    return target[:MAX_SYMBOLS]

async def initial_scan_and_start():
    """Immediate scan on startup and start streams right away."""
    async with aiohttp.ClientSession() as sess:
        for s in SEED_SYMBOLS:
            await start_symbol(s)
        try:
            target = await choose_targets(sess)
        except Exception:
            target = SEED_SYMBOLS[:]
        for sym in target:
            if sym not in RUNNING_SYMBOLS:
                await start_symbol(sym)
        print(f"[manager] initial running ({len(RUNNING_SYMBOLS)}): {', '.join(sorted(RUNNING_SYMBOLS))[:200]}")

async def refresh_symbols_loop():
    """Periodic rescans to rotate in fresh movers/liquidity."""
    async with aiohttp.ClientSession() as sess:
        while True:
            try:
                target = await choose_targets(sess)
                for sym in target:
                    if sym not in RUNNING_SYMBOLS:
                        await start_symbol(sym)
                for sym in list(RUNNING_SYMBOLS):
                    if sym not in target and sym not in SEED_SYMBOLS:
                        await stop_symbol(sym)
                GLOBAL_STATE["ts"] = int(time.time())
                print(f"[manager] running ({len(RUNNING_SYMBOLS)}): {', '.join(sorted(RUNNING_SYMBOLS))[:200]}")
            except Exception as e:
                print("[manager] refresh error:", e)
            await asyncio.sleep(SCAN_INTERVAL)

# ---------- H) HTTP API ----------
async def handle_signal(request: web.Request):
    """GET /signal?min_usd=200000 — Snapshot of running symbols, metrics, and detected whale levels."""
    headers = {"Access-Control-Allow-Origin": "*"}
    try:
        min_usd = float(request.rel_url.query.get("min_usd", "200000"))
    except ValueError:
        min_usd = 200000.0

    whale_levels = detect_whale_levels_all(min_usd=min_usd)

    return web.json_response({
        "ok": True,
        "running_symbols": sorted(list(RUNNING_SYMBOLS)),
        "metrics": state.get("metrics", {}),
        "whale_levels": whale_levels,
        "min_usd": min_usd
    }, headers=headers)

def _sym_from_binance(raw: str) -> str:
    return raw.upper().replace("USDT", "")

def _sym_from_kraken(raw: str) -> str:
    return raw.upper().replace("/", "").replace("USD", "")

async def handle_books(request: web.Request):
    """GET /books?symbol=XRP — best bid/ask and raw books for Binance & Kraken for the given base symbol."""
    headers = {"Access-Control-Allow-Origin": "*"}
    sym = (request.rel_url.query.get("symbol", "XRP") or "XRP").upper()

    out = {}

    # Binance
    try:
        b_match = next((k for k in state["binance"].keys() if _sym_from_binance(k) == sym), None)
        if b_match:
            bbook = state["binance"][b_match]
            bids = bbook.get("bids", {})
            asks = bbook.get("asks", {})
            out["binance"] = {
                "raw": b_match,
                "best_bid": max(bids.keys(), default=None),
                "best_ask": min(asks.keys(), default=None),
                "bids": bids,
                "asks": asks,
            }
    except Exception:
        pass

    # Kraken
    try:
        k_match = next((k for k in state["kraken"].keys() if _sym_from_kraken(k) == sym), None)
        if k_match:
            kbook = state["kraken"][k_match]
            bids = kbook.get("bids", {})
            asks = kbook.get("asks", {})
            out["kraken"] = {
                "raw": k_match,
                "best_bid": max(bids.keys(), default=None),
                "best_ask": min(asks.keys(), default=None),
                "bids": bids,
                "asks": asks,
            }
    except Exception:
        pass

    return web.json_response({"ok": True, "symbol": sym, "books": out}, headers=headers)

async def handle_universe(request: web.Request):
    """GET /universe — Universe snapshot (what we’re tracking)."""
    headers = {"Access-Control-Allow-Origin": "*"}
    uni = GLOBAL_STATE.get("universe", {"binance": [], "kraken": [], "ts": 0})
    uni.setdefault("binance", [])
    uni.setdefault("kraken", [])
    uni.setdefault("ts", GLOBAL_STATE.get("ts", 0))
    return web.json_response({"ok": True, "ts": uni["ts"], "universe": uni}, headers=headers)

async def handle_last(request: web.Request):
    """GET /last — Last global-scan summary & top findings."""
    headers = {"Access-Control-Allow-Origin": "*"}
    return web.json_response(
        {
            "ok": True,
            "last_scan": GLOBAL_STATE.get("last_scan", {}),
            "last_findings": GLOBAL_STATE.get("last_findings", []),
        },
        headers=headers,
    )

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/signal",   handle_signal)
    app.router.add_get("/books",    handle_books)
    app.router.add_get("/universe", handle_universe)
    app.router.add_get("/last",     handle_last)
    return app

# ---------- I) Bootstrap ----------
async def periodic_global_scan_task(app: web.Application):
    while True:
        if ENABLE_GLOBAL_SCAN:
            try:
                GLOBAL_STATE["ts"] = int(time.time())
            except Exception as e:
                print("global scan error:", e)
        await asyncio.sleep(GLOBAL_SCAN_EVERY_SEC)

async def start_all(app: web.Application):
    asyncio.create_task(metrics_loop())
    if KRAKEN_PAIRS:
        asyncio.create_task(kraken_ws_loop(KRAKEN_PAIRS))
    asyncio.create_task(initial_scan_and_start())
    asyncio.create_task(refresh_symbols_loop())
    asyncio.create_task(periodic_global_scan_task(app))

if __name__ == "__main__":
    app = create_app()
    app.on_startup.append(start_all)
    port = int(os.getenv("PORT", str(DEFAULT_PORT)))
    web.run_app(app, host="0.0.0.0", port=port)
