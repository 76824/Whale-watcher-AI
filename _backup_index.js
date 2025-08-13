const API = {
  base: "https://australia-southeast1-<your-project-id>.cloudfunctions.net",
  live: "https://australia-southeast1-<your-project-id>.cloudfunctions.net/liveSignals",
  gainers: "https://australia-southeast1-<your-project-id>.cloudfunctions.net/topGainers",
  future: "https://australia-southeast1-<your-project-id>.cloudfunctions.net/futureGainers",
  recs: "https://australia-southeast1-<your-project-id>.cloudfunctions.net/getRecommendations"
};

/* ===== tiny helpers ===== */
const el = (id) => document.getElementById(id);
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const nowStamp = () => new Date().toISOString().replace("T"," ").slice(0,19);

function normalizePair(sym){
  return String(sym||"").toUpperCase().replace(/[^A-Z0-9\-]/g,"");
}

// turn a pair like "XRPUSDT" or "XRP/USDT" into "XRP"
function getBaseAsset(sym){
  const s = normalizePair(sym);
  const m = s.match(/[A-Z]{2,5}/); // first token
  return m ? m[0] : s.slice(0,5);
}

// colored initial if we can’t fetch a logo image fast
function hashInt(str){
  let h = 2166136261>>>0;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,16777619); }
  return h>>>0;
  
}  

function placeholderData(base) {
  const letter = String(base || "?").toUpperCase().charAt(0);
  const hue = (hashInt(base || "") % 360);
  const fg = "#e7ecf8";                 // valid 6-char hex
  const bg = `hsl(${hue}, 60%, 35%)`;    // <-- backticks for template

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="${bg}" />
  <text x="50%" y="55%" text-anchor="middle" font-size="28"
        font-family="Inter,Segoe UI,Arial" fill="${fg}">${letter}</text>
</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function logoUrlsFor(baseLower) {
  const s = String(baseLower || "").toLowerCase();
  return [
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/64/color/${s}.png`,
    `https://raw.githubusercontent.com/ErikThiart/cryptocurrency-icons/master/64/color/${s}.png`,
    `https://cryptologos.cc/api/icon/${s}/64`
  ];
}

/* ===== DOM refs ===== */
const lastUpdated = el("lastUpdated");
const searchEl    = el("search");
const usdToggle   = el("usdToggle");
const refreshBtn  = el("refreshBtn");

const tabNew     = el("tab-new");
const tabTop     = el("tab-top");
const tabFuture  = el("tab-future");
const tabRecs    = el("tab-recs");

const viewLists  = el("view-lists");
const viewRecs   = el("view-recs");

const krakenList = el("krakenList");
const binanceList= el("binanceList");
const krakenCount= el("krakenCount");
const binanceCount=el("binanceCount");
const recList    = el("recList");

const chatLog = el("chatLog");
const chatInput = el("chatInput");
const sendBtn = el("sendBtn");

/* ===== state ===== */
let currentTab = "new";   // "new" | "top" | "future" | "recs"
let rawNew = {kraken:[], binance:[]};
let rawTop = {kraken:[], binance:[]};
let rawFuture = {kraken:[], binance:[]};
let recs = [];

/* ===== net ===== */
function fetchJSON(url){
  return fetch(url, {cache:"no-store"})
    .then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
}

// Optional USD price fetch (quick Binance ticker). Safe fallback if off.
async function fetchUSD(symbolBase){
  try{
    const pair = symbolBase.toUpperCase() + "USDT";
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {cache:"no-store"});
    if(!r.ok) return null;
    const j = await r.json();
    const p = Number(j.price);
    return isFinite(p) ? p : null;
  }catch(e){ return null; }
}

/* ===== renderers ===== */
function coinChip(symbol, tag){
  const base = getBaseAsset(symbol);
  const name = base; // could be expanded with alias map later

  const chip = document.createElement("div");
  chip.className = "chip";

  const img = document.createElement("img");
  img.className = "icon";
  img.alt = base;
  img.src = placeholderData(base);

  // try remote logos (fallback to placeholder silently)
  const candidates = logoUrlsFor(base.toLowerCase());
  let idx = 0;
  const tryNext = ()=>{ if(idx>=candidates.length) return; const u = candidates[idx++]; const test = new Image();
    test.onload = ()=>{ img.src = u; };
    test.onerror = tryNext;
    test.src = u;
  };
  tryNext();

  const tagEl = document.createElement("span");
  tagEl.className = "tag";
  tagEl.textContent = tag;

  const strong = document.createElement("strong");
  strong.textContent = base;

  const small = document.createElement("small");
  small.textContent = name;

  const price = document.createElement("span");
  price.className = "price";
  price.setAttribute("data-base", base);
  price.textContent = ""; // filled later when USD toggle is on

  chip.appendChild(img);
  chip.appendChild(tagEl);
  chip.appendChild(strong);
  chip.appendChild(small);
  chip.appendChild(price);
  return chip;
}

function renderList(container, symbols, tag){
  container.innerHTML = "";
  if(!symbols || !symbols.length){
    const m = document.createElement("div");
    m.className = "meta";
    m.textContent = "No items.";
    container.appendChild(m);
    return;
  }
  const frag = document.createDocumentFragment();
  for(const sym of symbols){
    const c = coinChip(sym, tag);
    frag.appendChild(c);
  }
  container.appendChild(frag);
}

async function refreshPrices(){
  if(!usdToggle.checked) {
    $$(".price").forEach(p=>p.textContent="");
    return;
  }
  const spans = $$(".price");
  for(const s of spans){
    const base = s.getAttribute("data-base");
    if(!base) continue;
    s.textContent = "…";
    const v = await fetchUSD(base);
    s.textContent = (v==null) ? "" : `$ ${v.toFixed(2)}`;
  }
}

/* ===== tabs & filter ===== */
function setTab(id){
  currentTab = id;
  // UI
  $$(".tab").forEach(t=>t.classList.remove("tab-active"));
  (id==="new"   ? tabNew :
   id==="top"   ? tabTop :
   id==="future"? tabFuture : tabRecs).classList.add("tab-active");

  if(id==="recs"){
    viewLists.classList.add("hidden");
    viewRecs.classList.remove("hidden");
  } else {
    viewRecs.classList.add("hidden");
    viewLists.classList.remove("hidden");
  }
  // render based on tab
  applyFilter();
}

function applyFilter(){
  const q = String(searchEl.value||"").trim().toUpperCase();
  const filt = (arr)=> !q ? arr : arr.filter(s => s.toUpperCase().includes(q));
  if(currentTab==="new"){
    renderList(krakenList , filt(rawNew.kraken) , "NEW");
    renderList(binanceList, filt(rawNew.binance), "NEW");
  }else if(currentTab==="top"){
    renderList(krakenList , filt(rawTop.kraken) , "TOP");
    renderList(binanceList, filt(rawTop.binance), "TOP");
  }else if(currentTab==="future"){
    renderList(krakenList , filt(rawFuture.kraken) , "FUTURE");
    renderList(binanceList, filt(rawFuture.binance), "FUTURE");
  }else{
    // recs view
    renderRecs();
  }
  krakenCount.textContent  = $$("#krakenList .chip").length;
  binanceCount.textContent = $$("#binanceList .chip").length;
  refreshPrices();
}

/* ===== recommendations ===== */
function renderRecs(){
  recList.innerHTML = "";
  if(!recs || !recs.length){
    const m = document.createElement("div");
    m.className = "meta";
    m.textContent = "No live recommendations yet.";
    recList.appendChild(m);
    return;
  }
  const frag = document.createDocumentFragment();
  for(const r of recs){
    // expected shape: { symbol, confidence, action, reason }
    const card = document.createElement("div");
    card.className = "rec";
    const head = document.createElement("div");
    head.className = "head";

    const icon = document.createElement("span");
    icon.className = "badge";
    icon.textContent = r.symbol || "?";

    const title = document.createElement("strong");
    title.textContent = r.symbol || "?";

    const conf = document.createElement("span");
    conf.className = "conf";
    conf.textContent = (r.confidence!=null) ? `${Math.round(r.confidence)}%` : "";

    head.appendChild(icon);
    head.appendChild(title);
    head.appendChild(conf);

    const sig = document.createElement("div");
    const a = String(r.action||"").toUpperCase();
    sig.className = /BUY/.test(a) ? "sig-buy" : /SELL/.test(a) ? "sig-sell" : "sig-hold";
    sig.textContent = a || "HOLD";

    const reason = document.createElement("div");
    reason.className = "reason";
    reason.textContent = r.reason || "—";

    card.appendChild(head);
    card.appendChild(sig);
    card.appendChild(reason);
    frag.appendChild(card);
  }
  recList.appendChild(frag);
}

/* ===== data loaders (LIVE) ===== */
async function loadNew(){
  // liveSignals is your “new listings” feed
  const j = await fetchJSON(API.base);
  // Accept either {kraken:[...], binance:[...]} or a flat list with .exchange
  if(Array.isArray(j)){
    rawNew = {
      kraken: j.filter(x=>String(x.exchange||"").toLowerCase()==="kraken").map(x=>x.symbol||x.base||x),
      binance:j.filter(x=>String(x.exchange||"").toLowerCase()==="binance").map(x=>x.symbol||x.base||x),
    };
  }else{
    rawNew = {
      kraken: (j.kraken  || []).map(x=>x.symbol||x.base||x),
      binance:(j.binance || []).map(x=>x.symbol||x.base||x)
    };
  }
}
async function loadTop(){
  const j = await fetchJSON(API.gainers);
  if(Array.isArray(j)){
    rawTop = {
      kraken: j.filter(x=>String(x.exchange||"").toLowerCase()==="kraken").map(x=>x.symbol||x.base||x),
      binance:j.filter(x=>String(x.exchange||"").toLowerCase()==="binance").map(x=>x.symbol||x.base||x),
    };
  }else{
    rawTop = {
      kraken: (j.kraken  || []).map(x=>x.symbol||x.base||x),
      binance:(j.binance || []).map(x=>x.symbol||x.base||x)
    };
  }
}
async function loadFuture(){
  const j = await fetchJSON(API.future);
  if(Array.isArray(j)){
    rawFuture = {
      kraken: j.filter(x=>String(x.exchange||"").toLowerCase()==="kraken").map(x=>x.symbol||x.base||x),
      binance:j.filter(x=>String(x.exchange||"").toLowerCase()==="binance").map(x=>x.symbol||x.base||x),
    };
  }else{
    rawFuture = {
      kraken: (j.kraken  || []).map(x=>x.symbol||x.base||x),
      binance:(j.binance || []).map(x=>x.symbol||x.base||x)
    };
  }
}
async function loadRecs(){
  const j = await fetchJSON(API.recs);
  // expected: [{symbol, confidence, action, reason}, ...]
  recs = Array.isArray(j) ? j : (j.items || []);
}

/* ===== chat (simple) ===== */
function say(m, who="her"){
  const div = document.createElement("div");
  div.className = "msg " + (who==="me"?"me":"her");
  div.textContent = m;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function handleChat(text){
  const t = text.trim();
  if(!t) return;
  say("You: " + t, "me");
  // a few shortcuts
  const q = t.toLowerCase();
  if(q==="refresh"){ doRefresh(); return say("Chenda: Fetching fresh data…"); }
  const m = q.match(/show\s+([a-z0-9]+)/i);
  if(m){
    searchEl.value = m[1].toUpperCase();
    applyFilter();
    return say(`Chenda: Filtering for ${m[1].toUpperCase()}.`);
  }
  say("Chenda: I’m here. Ask me about coins or say REFRESH to fetch latest.");
}

/* ===== wiring ===== */
async function doRefresh(){
  refreshBtn.disabled = true;
  try{
    if(currentTab==="new") await loadNew();
    else if(currentTab==="top") await loadTop();
    else if(currentTab==="future") await loadFuture();
    else await loadRecs();
    applyFilter();
    lastUpdated.textContent = nowStamp();
  }catch(e){
    console.error(e);
    say("Chenda: I couldn’t fetch data right now.");
  }finally{
    refreshBtn.disabled = false;
  }
}

function wire(){
  // tabs
  tabNew   .addEventListener("click", ()=>{ setTab("new");    doRefresh(); });
  tabTop   .addEventListener("click", ()=>{ setTab("top");    doRefresh(); });
  tabFuture.addEventListener("click", ()=>{ setTab("future"); doRefresh(); });
  tabRecs  .addEventListener("click", ()=>{ setTab("recs");   doRefresh(); });

  // filter & refresh & prices
  searchEl.addEventListener("input", applyFilter);
  usdToggle.addEventListener("change", refreshPrices);
  refreshBtn.addEventListener("click", doRefresh);

  // chat
  sendBtn.addEventListener("click", ()=>{ handleChat(chatInput.value); chatInput.value=""; });
  chatInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ handleChat(chatInput.value); chatInput.value=""; }});
}

/* ===== boot ===== */
document.addEventListener("DOMContentLoaded", async ()=>{
  wire();
  // initial loads so all tabs ready quickly
  try{
    await Promise.all([loadNew(), loadTop(), loadFuture(), loadRecs()]);
  }catch(e){ console.error(e); }
  setTab("future"); // pick your default tab
  applyFilter();
  lastUpdated.textContent = nowStamp();
});