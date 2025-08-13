import functions from "firebase-functions";
import admin from "firebase-admin";
import fetch from "node-fetch";
import corsLib from "cors";
import express from "express";

// Initialize admin SDK once
try { admin.app(); } catch { admin.initializeApp(); }

const app = express();
const cors = corsLib({ origin: true });

// Read CHENDA_URL from runtime config: functions:config:set chenda.url="https://whale-watcher-ai.onrender.com"
const CHENDA_URL = (process.env.CHENDA_URL || (functions.config()?.chenda?.url)) || "https://whale-watcher-ai.onrender.com";

// Helper: proxy GET to Chenda
async function proxy(req, res, path) {
  const url = new URL(path, CHENDA_URL);
  // copy query params
  for (const [k, v] of Object.entries(req.query || {})) url.searchParams.set(k, v);
  try {
    const r = await fetch(url.toString(), { method: "GET", timeout: 15000 });
    const data = await r.json();
    res.set("Access-Control-Allow-Origin", "*");
    res.status(200).json({ ok: true, via: "firebase", from: url.toString(), data });
  } catch (e) {
    console.error("proxy error", e);
    res.status(502).json({ ok: false, error: String(e), target: url.toString() });
  }
}

app.get("/ping", cors, (req, res) => res.json({ ok: true, CHENDA_URL }));
app.get("/signal", cors, (req, res) => proxy(req, res, "/signal"));
app.get("/books",  cors, (req, res) => proxy(req, res, "/books"));
app.get("/last",   cors, (req, res) => proxy(req, res, "/last"));
app.get("/universe", cors, (req, res) => proxy(req, res, "/universe"));

// Optional: write alerts coming from Chenda to Firestore
app.post("/alert", cors, express.json(), async (req, res) => {
  try {
    const payload = req.body || {};
    payload.ts = Date.now();
    await admin.firestore().collection("alerts").add(payload);
    res.set("Access-Control-Allow-Origin", "*");
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export const api = functions.region("us-central1").https.onRequest(app);
