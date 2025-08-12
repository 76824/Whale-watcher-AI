# chenda/market_stream.py
import asyncio, json, time, os
from typing import Dict, Any

BINANCE_WS = "wss://stream.binance.com:9443/stream"
KRAKEN_WS  = "wss://ws.kraken.com/"
MAX_LEVELS = int(os.getenv("ORDERBOOK_LEVELS", "100"))

def _sym_from_binance(sym: str) -> str:
    # "XRPUSDT" -> "XRP"
    return sym[:-4] if sym.endswith("USDT") else sym[:-3]

def _sym_from_kraken(pair: str) -> str:
    # crude, good enough for USD quotes
    return "XRP" if "XRP" in pair.upper() else pair.upper()

async def _binance_ws(app):
    import aiohttp
    state = app["state"]
    while True:
        try:
            uni = state["universe"].get("binance", [])
            if not uni:
                await asyncio.sleep(2); continue
            # one multiplexed stream of trades + depth
            streams = "/".join([f"{s.lower()}@trade/{s.lower()}@depth@100ms" for s in uni[:200]])  # cap first 200 to start
            url = f"{BINANCE_WS}?streams={streams}"
            async with aiohttp.ClientSession() as s, s.ws_connect(url, heartbeat=30) as ws:
                async for msg in ws:
                    if msg.type != aiohttp.WSMsgType.TEXT: continue
                    data = json.loads(msg.data)
                    payload = data.get("data", {})
                    stream = data.get("stream","")
                    if "@trade" in stream:
                        sym = payload["s"]       # XRPUSDT
                        px  = float(payload["p"])
                        q   = float(payload["q"])
                        ts  = int(payload["T"])
                        state["trades"]["binance"].append((sym,px,q,ts))
                        if len(state["trades"]["binance"])>5000: state["trades"]["binance"]=state["trades"]["binance"][-5000:]
                    elif "@depth" in stream:
                        sname = payload.get("s")
                        bids  = payload.get("bids") or payload.get("b")
                        asks  = payload.get("asks") or payload.get("a")
                        book = state["books"]["binance"].setdefault(sname, {"bids":{}, "asks":{}})
                        if bids:
                            for p,q in bids[:MAX_LEVELS]:
                                if float(q)==0: book["bids"].pop(p, None)
                                else: book["bids"][p]=float(q)
                        if asks:
                            for p,q in asks[:MAX_LEVELS]:
                                if float(q)==0: book["asks"].pop(p, None)
                                else: book["asks"][p]=float(q)
        except Exception as e:
            app["state"]["errors"].append(("binance_ws", str(e), time.time()))
            await asyncio.sleep(3)

async def _kraken_ws(app):
    import aiohttp
    state = app["state"]
    subs = {}
    while True:
        try:
            pairs = state["universe"].get("kraken", [])
            if not pairs:
                await asyncio.sleep(2); continue
            async with aiohttp.ClientSession() as s, s.ws_connect(KRAKEN_WS, heartbeat=30) as ws:
                await ws.send_json({"event":"subscribe","pair":pairs[:100],"subscription":{"name":"book","depth":MAX_LEVELS}})
                await ws.send_json({"event":"subscribe","pair":pairs[:100],"subscription":{"name":"trade"}})
                async for msg in ws:
                    if msg.type != aiohttp.WSMsgType.TEXT: continue
                    raw = json.loads(msg.data)
                    if isinstance(raw, dict):  # events/heartbeats
                        continue
                    # book updates come as [channelID, {as/bs/a/b}, pair]
                    if isinstance(raw, list) and len(raw)>=2:
                        payload = raw[1]; pair = raw[-1]
                        book = state["books"]["kraken"].setdefault(pair, {"bids":{}, "asks":{}})
                        if "as" in payload or "a" in payload:
                            for p,q,_ in payload.get("as",[])+payload.get("a",[]):
                                if float(q)==0: book["asks"].pop(p, None)
                                else: book["asks"][p]=float(q)
                        if "bs" in payload or "b" in payload:
                            for p,q,_ in payload.get("bs",[])+payload.get("b",[]):
                                if float(q)==0: book["bids"].pop(p, None)
                                else: book["bids"][p]=float(q)
        except Exception as e:
            app["state"]["errors"].append(("kraken_ws", str(e), time.time()))
            await asyncio.sleep(3)

def start(app):
    app["tasks"].append(app.loop.create_task(_binance_ws(app)))
    app["tasks"].append(app.loop.create_task(_kraken_ws(app)))