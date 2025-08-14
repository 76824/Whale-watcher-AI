
import os, json, asyncio, time
from aiohttp import web, ClientSession, ClientTimeout

BINANCE_TICKERS_URL = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_INFO_URL    = "https://api.binance.com/api/v3/exchangeInfo"
BINANCE_DEPTH_TMPL  = "https://api.binance.com/api/v3/depth?symbol={sym}&limit=50"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(BASE_DIR, "config.json")

with open(CFG_PATH, "r", encoding="utf-8") as f:
    CFG = json.load(f)

DEFAULT_PORT = int(CFG.get("port", 10000))

async def fetch_json(session: ClientSession, url: str):
    try:
        async with session.get(url, timeout=ClientTimeout(total=10)) as r:
            if r.status != 200:
                return None
            return await r.json()
    except Exception:
        return None

async def handle_root(request: web.Request):
    return web.json_response({"ok": True, "service": "chenda-backend", "ts": int(time.time())})

async def handle_universe(request: web.Request):
    """GET /universe -> list of USDT spot symbols. Falls back to seeds from config.json"""
    headers = {"Access-Control-Allow-Origin": "*"}
    async with ClientSession() as sess:
        info = await fetch_json(sess, BINANCE_INFO_URL)
    syms = []
    if isinstance(info, dict) and "symbols" in info:
        for x in info["symbols"]:
            try:
                if x.get("status") == "TRADING" and x.get("quoteAsset") == "USDT" and x.get("isSpotTradingAllowed", True):
                    syms.append(x["symbol"])
            except Exception:
                continue
    if not syms:  # fallback to config seeds
        syms = [s.upper() for s in CFG.get("binance_symbols", []) if s.upper().endswith("USDT")]
    return web.json_response({"ok": True, "ts": int(time.time()), "universe": {"binance": syms, "kraken": CFG.get("kraken_pairs", [])}}, headers=headers)

async def handle_signal(request: web.Request):
    """GET /signal -> small snapshot of selected symbols with 24h stats (public REST)."""
    headers = {"Access-Control-Allow-Origin": "*"}
    want = [s.upper() for s in CFG.get("binance_symbols", []) if s.upper().endswith("USDT")]
    async with ClientSession() as sess:
        tickers = await fetch_json(sess, BINANCE_TICKERS_URL)

    out = []
    if isinstance(tickers, list):
        tmap = {t.get("symbol"): t for t in tickers if isinstance(t, dict)}
        for s in want:
            t = tmap.get(s)
            if not t: 
                continue
            try:
                out.append({
                    "symbol": s,
                    "lastPrice": float(t.get("lastPrice", "0") or 0.0),
                    "priceChangePercent": float(t.get("priceChangePercent", "0") or 0.0),
                    "quoteVolume": float(t.get("quoteVolume", "0") or 0.0),
                    "highPrice": float(t.get("highPrice", "0") or 0.0),
                    "lowPrice": float(t.get("lowPrice", "0") or 0.0),
                })
            except Exception:
                continue
    return web.json_response({"ok": True, "ts": int(time.time()), "data": out}, headers=headers)

async def handle_books(request: web.Request):
    """GET /books?symbol=XRP -> best bid/ask from Binance (public depth)."""
    headers = {"Access-Control-Allow-Origin": "*"}
    base = (request.rel_url.query.get("symbol", "XRP") or "XRP").upper()
    # find a USDT symbol that starts with base, prefer exact BASE+USDT in seeds
    seeds = [s.upper() for s in CFG.get("binance_symbols", [])]
    sym = None
    for s in seeds:
        if s.upper().startswith(base) and s.upper().endswith("USDT"):
            sym = s.upper()
            break
    if not sym:
        sym = base + "USDT"  # try default

    async with ClientSession() as sess:
        depth = await fetch_json(sess, BINANCE_DEPTH_TMPL.format(sym=sym))

    best_bid = best_ask = None
    if isinstance(depth, dict):
        try:
            bids = depth.get("bids", [])
            asks = depth.get("asks", [])
            if bids:
                best_bid = bids[0][0]
            if asks:
                best_ask = asks[0][0]
        except Exception:
            pass

    return web.json_response({"ok": True, "symbol": base, "pair": sym, "best_bid": best_bid, "best_ask": best_ask}, headers=headers)

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", handle_root)
    app.router.add_get("/universe", handle_universe)
    app.router.add_get("/signal", handle_signal)
    app.router.add_get("/books", handle_books)
    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", str(DEFAULT_PORT)))
    web.run_app(app, host="0.0.0.0", port=port)
