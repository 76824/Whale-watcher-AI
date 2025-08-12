# chenda/feature_engine.py
import asyncio, time, math
from collections import deque, defaultdict

WINDOWS = (60, 300, 900)  # 1m, 5m, 15m features

def _best(book_side: dict, reverse=False):
    if not book_side: return None
    return (max if reverse else min)(float(p) for p in book_side.keys())

async def run(app):
    state = app["state"]
    # rolling bars per symbol (midprice, volume etc.)
    rings = {w: defaultdict(lambda: deque(maxlen=w)) for w in WINDOWS}
    while True:
        try:
            # derive midprice & top-of-book imbalance for everything we have
            for exch, books in state["books"].items():
                for raw_sym, sides in books.items():
                    bids, asks = sides.get("bids",{}), sides.get("asks",{})
                    bb = _best(bids, reverse=True); ba = _best(asks, reverse=False)
                    if bb and ba:
                        mid = (bb+ba)/2.0
                        bid_sz = sum(bids.values())
                        ask_sz = sum(asks.values())
                        imb = bid_sz / max(bid_sz+ask_sz, 1e-9)
                        key = f"{exch}:{raw_sym}"
                        now = int(time.time())
                        for w in WINDOWS:
                            rings[w][key].append((now, mid, bid_sz, ask_sz, imb))
                        state["features"][key] = {"mid": mid, "imb": imb, "bb": bb, "ba": ba, "ts": now}
            state["rings"] = rings
        except Exception as e:
            state["errors"].append(("feature_engine", str(e), time.time()))
        await asyncio.sleep(1)

def start(app):
    app["tasks"].append(app.loop.create_task(run(app)))