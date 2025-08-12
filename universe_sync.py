# chenda/universe_sync.py
import asyncio, os, time
from typing import Dict, List

REFRESH_SECS = int(os.getenv("UNIVERSE_REFRESH_SECS", "900"))

async def fetch_binance_symbols(session) -> List[str]:
    # spot only, USD/USDT
    async with session.get("https://api.binance.com/api/v3/exchangeInfo") as r:
        j = await r.json()
    out = []
    for s in j.get("symbols", []):
        if s.get("status") == "TRADING" and s.get("quoteAsset") in ("USDT","USD"):
            out.append(s["symbol"])  # e.g. XRPUSDT
    return out

async def fetch_kraken_pairs(session) -> List[str]:
    async with session.get("https://api.kraken.com/0/public/AssetPairs") as r:
        j = await r.json()
    out = []
    for k,v in j.get("result", {}).items():
        if v.get("wsname") and v.get("quote") in ("USD","USDT"):
            out.append(k)  # e.g. XBT/USD pair code like "XXRPZUSD"
    return out

async def run(app):
    from aiohttp import ClientSession
    state = app["state"]
    while True:
        try:
            async with ClientSession() as s:
                b = await fetch_binance_symbols(s)
                k = await fetch_kraken_pairs(s)
            state["universe"] = {"binance": b, "kraken": k, "ts": time.time()}
        except Exception as e:
            state["errors"].append(("universe_sync", str(e), time.time()))
        await asyncio.sleep(REFRESH_SECS)

def start(app):
    app["tasks"].append(app.loop.create_task(run(app)))