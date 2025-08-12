# chenda/alerts.py
import asyncio, time, math, os

ORANGE = int(os.getenv("THRESH_ORANGE", "80"))
GREEN  = int(os.getenv("THRESH_GREEN",  "65"))
COOLDOWN = int(os.getenv("ALERT_COOLDOWN_MIN", "20")) * 60

def _score(snap: dict, hist: list) -> int:
    # tiny scorer: price momentum + OB imbalance
    if not snap or not hist or len(hist)<30: return 0
    mid_now = snap["mid"]; imb = snap["imb"]
    mid_30s = [m for ,m,,, in hist[-30:]]
    ret_30s = (mid_now - mid_30s[0]) / max(mid_30s[0], 1e-9)
    score = 0
    if ret_30s > 0.01: score += min(40, ret_30s*2000)     # up to +40 for >2%
    if imb > 0.60:    score += (imb-0.60)*100             # up to +40 as it approaches 1.0
    return int(round(max(0, min(100, score))))

async def run(app):
    state = app["state"]
    last_sent = {}  # key -> ts
    while True:
        try:
            rings = state.get("rings", {})
            out = []
            for w, ring in rings.items():
                if w != 60: continue  # use 60s window for quick alerts
                for key, hist in ring.items():
                    snap = state["features"].get(key)
                    score = _score(snap, list(hist))
                    lvl = "none"
                    if score >= ORANGE: lvl = "orange"
                    elif score >= GREEN: lvl = "green"
                    if lvl != "none":
                        if time.time() - last_sent.get(key, 0) > COOLDOWN:
                            last_sent[key] = time.time()
                            out.append({"key":key, "score":score, "level":lvl, "snap":snap, "t":int(time.time())})
            if out:
                state["alerts"].extend(out)
                state["alerts"] = state["alerts"][-200:]
        except Exception as e:
            state["errors"].append(("alerts", str(e), time.time()))
        await asyncio.sleep(5)

def start(app):
    app["tasks"].append(app.loop.create_task(run(app)))

# optional endpoint helper
async def handle_alert_feed(request):
    headers = {"Access-Control-Allow-Origin":"*"}
    alerts = request.app["state"]["alerts"]
    return request.app["json"]({"ok":True, "alerts":alerts}, headers=headers)