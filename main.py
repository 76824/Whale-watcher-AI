# ===== Chenda Public Backend (Flask, no API keys required) =====
# Python 3.11+. Serves /signal, /books, /universe using Binance PUBLIC REST depth.
# Safe to run on Render/Heroku without credentials or region-limited SDKs.

import os
import time
import math
import logging
from typing import Dict, List, Tuple

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

BINANCE_DEPTH_URL = "https://api.binance.com/api/v3/depth"

# --- Config ---
DEFAULT_SYMBOLS = "XRPUSDT,JASMYUSDT,SOLUSDT,PEPEUSDT,LINKUSDT,BONKUSDT"
SYMBOLS = [s.strip().upper() for s in os.getenv("BINANCE_SYMBOLS", DEFAULT_SYMBOLS).split(",") if s.strip()]
DEFAULT_LIMIT = int(os.getenv("DEPTH_LIMIT", "200"))
PORT = int(os.getenv("PORT", "10000"))

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("chenda-public")

def fetch_depth(symbol: str, limit: int = DEFAULT_LIMIT) -> Dict:
    """Fetch public orderbook depth from Binance REST (no API key)."""
    try:
        resp = requests.get(BINANCE_DEPTH_URL, params={"symbol": symbol, "limit": min(max(limit, 5), 1000)}, timeout=10)
        if resp.status_code != 200:
            return {"ok": False, "error": f"HTTP {resp.status_code}", "symbol": symbol}
        data = resp.json()
        # normalize to dict of str->str like WS does
        bids = {p:q for p,q in data.get("bids", [])}
        asks = {p:q for p,q in data.get("asks", [])}
        return {"ok": True, "symbol": symbol, "lastUpdateId": data.get("lastUpdateId"), "bids": bids, "asks": asks}
    except Exception as e:
        return {"ok": False, "error": str(e), "symbol": symbol}

def best_bid_ask(bids: Dict[str,str], asks: Dict[str,str]) -> Tuple[float, float]:
    if not bids or not asks:
        return (None, None)
    try:
        bb = max(float(p) for p in bids.keys())
        ba = min(float(p) for p in asks.keys())
        return (bb, ba)
    except Exception:
        return (None, None)

def levels_summary(book: Dict[str,str], top_n: int = 20) -> Tuple[int, float]:
    """Return (#levels, total_qty) for top_n price levels by proximity."""
    try:
        # Sort: bids desc, asks asc — but here we don't know side; caller passes correct mapping.
        # We only need counts/qty sums; keep it simple.
        items = list(book.items())
        qty_sum = 0.0
        for i, (_, q) in enumerate(items[:top_n]):
            try:
                qty_sum += float(q)
            except Exception:
                continue
        return (min(len(items), top_n), round(qty_sum, 6))
    except Exception:
        return (0, 0.0)

@app.route("/", methods=["GET", "HEAD"])
def root():
    return jsonify({"ok": True, "service": "chenda-public", "endpoints": ["/signal", "/books?symbol=XRPUSDT", "/universe"]})

@app.route("/universe", methods=["GET"])
def universe():
    return jsonify({"ok": True, "symbols": SYMBOLS, "ts": int(time.time())})

@app.route("/books", methods=["GET"])
def books():
    symbol = (request.args.get("symbol") or "").upper().replace(" ", "")
    if not symbol:
        return jsonify({"ok": False, "error": "missing ?symbol="}), 400
    limit = request.args.get("limit", type=int) or DEFAULT_LIMIT
    book = fetch_depth(symbol, limit)
    status = 200 if book.get("ok") else 502
    return jsonify(book), status

@app.route("/signal", methods=["GET"])
def signal():
    limit = request.args.get("limit", type=int) or DEFAULT_LIMIT
    out = {"ok": True, "ts": int(time.time()), "symbols": [], "data": {}, "errors": []}
    for s in SYMBOLS:
        d = fetch_depth(s, limit)
        if not d.get("ok"):
            out["errors"].append({"symbol": s, "error": d.get("error", "unknown")})
            continue
        bids = d.get("bids", {})
        asks = d.get("asks", {})
        bb, ba = best_bid_ask(bids, asks)
        # simple summaries
        bid_lvls, bid_qty = levels_summary(dict(sorted(bids.items(), key=lambda x: float(x[0]), reverse=True)))
        ask_lvls, ask_qty = levels_summary(dict(sorted(asks.items(), key=lambda x: float(x[0]))))
        mid = None
        spread = None
        try:
            if bb is not None and ba is not None and ba > 0:
                mid = (bb + ba) / 2.0
                spread = (ba - bb) / mid * 100.0
        except Exception:
            pass
        out["symbols"].append(s)
        out["data"][s] = {
            "best_bid": bb,
            "best_ask": ba,
            "mid": round(mid, 8) if mid else None,
            "spread_pct": round(spread, 6) if spread is not None else None,
            "bid_levels": bid_lvls,
            "ask_levels": ask_lvls,
            "bid_qty_topN": bid_qty,
            "ask_qty_topN": ask_qty,
            "lastUpdateId": d.get("lastUpdateId"),
        }
    return jsonify(out)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)
