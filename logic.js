/* logic.js
   LuxGold dashboard core logic
   - Live API fetch (metals.g.apised.com) with x-api-key header
   - Persistent deltas (no reset color)
   - Karat conversions (mithqal or gram), USD or IQD with optional margin slider
   - Expectation section with independent slider
   - Margin solver that auto-sets main slider
   - Connection status (online/offline + basic downlink if supported)
   - Chart.js with zoom/pan + crosshair ruler (+)
   - History persistence via localStorage, seeded by chart-history.json
   - Web Worker smoothing + noise filter >= $0.10
*/

(() => {
  "use strict";

  // ------------------ Config ------------------
  const API_URL = "https://metals.g.apised.com/v1/latest?symbols=XAU&base_currency=USD";

  // NOTE: You provided this API key. Putting it in client-side code exposes it to anyone
  // who can view page source. For real production, proxy via your own backend.
  const API_KEY = "sk_395396F9Edf481ae4aB4Db3F1770A4B1548B1bDeb543355D";

  const OUNCE_TO_GRAM = 31.1035;
  const MITHQAL_GRAM = 5;
  const NOISE_THRESHOLD_USD = 0.10; // as requested: reduce noise >= $0.10
  const STORAGE_KEY = "luxgold.history.v1";
  const STORAGE_META = "luxgold.meta.v1";
  const STORAGE_CALC_HIST = "luxgold.calc.history.v1";

  const KARAT_FACTORS = {
    24: 1.0,
    22: 0.916,
    21: 0.875,
    18: 0.75
  };

  // ------------------ Helpers ------------------
  const $ = (sel) => document.querySelector(sel);

  function nowMs(){ return Date.now(); }

  function fmtNumber(n, decimals=2){
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  function fmtInt(n){
    if (!Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString(undefined);
  }
  function parseNum(s){
    if (s === null || s === undefined) return NaN;
    const t = String(s).trim().replace(/,/g,"");
    if (t === "") return NaN;
    const v = Number(t);
    return Number.isFinite(v) ? v : NaN;
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function roundToStep(v, step){
    return Math.round(v/step)*step;
  }

  function setText(el, t){ if (el) el.textContent = t; }

  function setClass(el, cls){
    if (!el) return;
    el.className = cls;
  }

  function currencyModeFromFx(fx){
    return Number.isFinite(fx) && fx > 0 ? "IQD" : "USD";
  }

  function symbolForMode(mode){
    return mode === "IQD" ? "IQD" : "$";
  }

  function withSymbol(mode, value, decimals){
    const s = symbolForMode(mode);
    if (!Number.isFinite(value)) return "—";
    const text = (mode === "IQD") ? fmtInt(value) : fmtNumber(value, decimals);
    return mode === "IQD" ? `${text} ${s}` : `${s}${text}`;
  }

  // ------------------ DOM refs ------------------
  const elClock = $("#liveClock");
  const elLastUpdated = $("#lastUpdated");
  const elLivePrice = $("#livePrice");
  const elLiveDelta = $("#liveDelta");
  const elDeltaArrow = $("#deltaArrow");
  const elDeltaAbs = $("#deltaAbs");
  const elDeltaPct = $("#deltaPct");
  const elUsdToIqd = $("#usdToIqd");
  const elBtnClearFx = $("#btnClearFx");
  const elBtnForceTick = $("#btnForceTick");
  const elBtnExportHistory = $("#btnExportHistory");

  const elUnitLive = $("#unitLive");
  const elKaratLive = $("#karatLive");
  const elUnitLabelLive = $("#unitLabelLive");
  const elKaratList = $("#karatList");
  const elSelectedLivePrice = $("#selectedLivePrice");

  const elMarginSlider = $("#marginSlider");
  const elMarginValue = $("#marginValue");

  const elExpOunce = $("#expOunce");
  const elExpUsdToIqd = $("#expUsdToIqd");
  const elExpKarat = $("#expKarat");
  const elExpUnit = $("#expUnit");
  const elExpMarginSlider = $("#expMarginSlider");
  const elExpMarginValue = $("#expMarginValue");
  const elExpResult = $("#expResult");
  const elExpMode = $("#expMode");

  const elSolveOunce = $("#solveOunce");
  const elSolveUsdToIqd = $("#solveUsdToIqd");
  const elSolve21 = $("#solve21Mithqal");
  const elSolveMargin = $("#solveMargin");
  const elBtnApplySolve = $("#btnApplySolve");

  const elConnPill = $("#connPill");
  const elConnText = $("#connText");
  const elConnDot = $("#connDot");

  // Calculator
  const elCalcExpr = $("#calcExpr");
  const elCalcResult = $("#calcResult");
  const elCalcKeys = $("#calcKeys");
  const elToggleHistory = $("#toggleHistory");
  const elCalcHistory = $("#calcHistory");
  const elHistoryList = $("#historyList");
  const elClearHistory = $("#clearHistory");

  // Chart
  const elChart = $("#goldChart");

  // ------------------ Clock ------------------
  function tickClock(){
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    const ss = String(d.getSeconds()).padStart(2,"0");
    setText(elClock, `${hh}:${mm}:${ss}`);
  }
  setInterval(tickClock, 250);
  tickClock();

  // ------------------ Connection status ------------------
  function updateConn(){
    const online = navigator.onLine;
    let label = online ? "Online" : "Offline";
    // Network Information API (best-effort)
    const navAny = navigator;
    const conn = navAny.connection || navAny.mozConnection || navAny.webkitConnection;
    if (online && conn){
      const down = conn.downlink;
      const rtt = conn.rtt;
      if (Number.isFinite(down)){
        if (down >= 5) label = "Online • Strong";
        else if (down >= 1.5) label = "Online • OK";
        else label = "Online • Weak";
      } else if (Number.isFinite(rtt)){
        if (rtt <= 80) label = "Online • Fast";
        else if (rtt <= 200) label = "Online • OK";
        else label = "Online • Slow";
      }
    }
    setText(elConnText, label);
    elConnPill.classList.toggle("ok", online);
    elConnPill.classList.toggle("bad", !online);
  }
  window.addEventListener("online", updateConn);
  window.addEventListener("offline", updateConn);
  updateConn();

  // ------------------ History storage ------------------
  function loadLocalHistory(){
    try{
      const s = localStorage.getItem(STORAGE_KEY);
      if (!s) return null;
      const data = JSON.parse(s);
      if (!Array.isArray(data)) return null;
      return data;
    }catch{ return null; }
  }

  function saveLocalHistory(points){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
    }catch{ /* ignore */ }
  }

  function loadMeta(){
    try{
      const s = localStorage.getItem(STORAGE_META);
      return s ? JSON.parse(s) : {};
    }catch{ return {}; }
  }
  function saveMeta(meta){
    try{ localStorage.setItem(STORAGE_META, JSON.stringify(meta)); }catch{}
  }

  async function loadSeedHistory(){
    const res = await fetch("chart-history.json", {cache:"no-store"});
    const seed = await res.json();
    if (!Array.isArray(seed)) throw new Error("chart-history.json must be an array");
    return seed;
  }

  // ------------------ Worker ------------------
  const worker = new Worker("worker.js", {type:"classic"});
  let workerBusy = false;
  let workerQueue = null;

  function workerProcess(points){
    return new Promise((resolve) => {
      const msg = {type:"PROCESS", points, threshold: NOISE_THRESHOLD_USD};
      const send = () => {
        workerBusy = true;
        worker.postMessage(msg);
        const onMsg = (e) => {
          const m = e.data || {};
          if (m.type === "PROCESSED"){
            worker.removeEventListener("message", onMsg);
            workerBusy = false;
            if (workerQueue){
              const q = workerQueue;
              workerQueue = null;
              workerProcess(q.points).then(q.resolve);
            }
            resolve(m.points);
          }
        };
        worker.addEventListener("message", onMsg);
      };

      if (workerBusy){
        workerQueue = {points, resolve};
      } else {
        send();
      }
    });
  }

  // ------------------ Chart.js setup ------------------
  let chart = null;
  let rawHistory = [];      // [{t, p}]
  let smoothHistory = [];   // worker output

  function tfToMs(tf){
    const h = 3600*1000, d = 24*h;
    if (tf === "24h") return 24*h;
    if (tf === "7d") return 7*d;
    if (tf === "1m") return 30*d;
    if (tf === "1y") return 365*d;
    return Infinity;
  }

  function filterByTf(points, tf){
    const win = tfToMs(tf);
    if (win === Infinity) return points;
    const end = points.length ? points[points.length-1].t : nowMs();
    const start = end - win;
    return points.filter(p => p.t >= start);
  }

  const crosshairPlugin = {
    id: "luxCrosshair",
    afterDraw(chart, args, opts){
      const {ctx, chartArea} = chart;
      const x = chart._luxCrossX;
      const y = chart._luxCrossY;
      if (x == null || y == null) return;
      if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) return;

      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([6,6]);
      ctx.strokeStyle = "rgba(247,210,120,0.45)";
      // vertical
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      // horizontal
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      // plus sign at center
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(247,210,120,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x-10, y);
      ctx.lineTo(x+10, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y-10);
      ctx.lineTo(x, y+10);
      ctx.stroke();

      ctx.restore();
    }
  };

  function buildChart(points){
    const ctx = elChart.getContext("2d");
    const data = points.map(p => ({x: p.t, y: p.p}));

    chart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: [{
          label: "XAU / USD",
          data,
          tension: 0.22,
          borderWidth: 2,
          pointRadius: 0,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            type: "time",
            time: { tooltipFormat: "PPpp" },
            grid: { color: "rgba(32,38,56,0.85)" },
            ticks: { color: "rgba(167,177,203,0.85)", maxRotation: 0 }
          },
          y: {
            position: "right",
            grid: { color: "rgba(32,38,56,0.85)" },
            ticks: {
              color: "rgba(167,177,203,0.85)",
              callback: (v) => "$" + Number(v).toLocaleString(undefined, {maximumFractionDigits: 2})
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => "$" + Number(ctx.parsed.y).toLocaleString(undefined, {maximumFractionDigits: 2})
            }
          },
          zoom: {
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "x"
            },
            pan: {
              enabled: true,
              mode: "x",
              modifierKey: "shift" // shift+drag
            },
            limits: {
              x: { min: "original", max: "original" }
            }
          }
        }
      },
      plugins: [crosshairPlugin]
    });

    // Crosshair tracking
    const canvas = chart.canvas;
    canvas.addEventListener("mousemove", (ev) => {
      const rect = canvas.getBoundingClientRect();
      chart._luxCrossX = ev.clientX - rect.left;
      chart._luxCrossY = ev.clientY - rect.top;
      chart.draw();
    });
    canvas.addEventListener("mouseleave", () => {
      chart._luxCrossX = null;
      chart._luxCrossY = null;
      chart.draw();
    });
    canvas.addEventListener("dblclick", () => {
      chart.resetZoom();
    });
  }

  function updateChart(points){
    if (!chart){
      buildChart(points);
      return;
    }
    const data = points.map(p => ({x: p.t, y: p.p}));
    chart.data.datasets[0].data = data;
    chart.update("none");
  }

  // ------------------ Live price + deltas ------------------
  const state = {
    livePriceUSD: NaN,
    prevLivePriceUSD: NaN,
    lastChangeAt: null,

    // persistent direction for main metric
    lastDir: "neutral", // "up"|"down"|"neutral"

    // karat deltas
    karatPrev: {24: NaN, 22: NaN, 21: NaN, 18: NaN},
    karatDir:  {24: "neutral", 22: "neutral", 21: "neutral", 18: "neutral"},

    // time frame
    tf: "24h"
  };

  function setLastUpdated(ts){
    if (!ts){ setText(elLastUpdated, "—"); return; }
    const d = new Date(ts);
    setText(elLastUpdated, d.toLocaleString());
  }

  function setDeltaUI(abs, pct){
    const dir = abs > 0 ? "up" : abs < 0 ? "down" : state.lastDir; // keep last if zero
    if (abs > 0) state.lastDir = "up";
    else if (abs < 0) state.lastDir = "down";

    elLiveDelta.classList.remove("up","down","neutral");
    elLiveDelta.classList.add(dir === "up" ? "up" : dir === "down" ? "down" : "neutral");

    setText(elDeltaArrow, dir === "up" ? "▲" : dir === "down" ? "▼" : "—");
    setText(elDeltaAbs, (abs === 0 ? "0.00" : fmtNumber(Math.abs(abs), 2)));
    setText(elDeltaPct, (pct === 0 ? "0.00%" : `${fmtNumber(Math.abs(pct), 2)}%`));
  }

  function updateMainMetric(){
    const fx = parseNum(elUsdToIqd.value);
    const mode = currencyModeFromFx(fx);

    const p = state.livePriceUSD;
    if (!Number.isFinite(p)){
      setText(elLivePrice, "—");
      setDeltaUI(0,0);
      return;
    }

    const show = (mode === "IQD") ? (p * fx) : p;
    setText(elLivePrice, withSymbol(mode, show, 2));

    if (Number.isFinite(state.prevLivePriceUSD)){
      const abs = p - state.prevLivePriceUSD;
      const pct = (state.prevLivePriceUSD !== 0) ? (abs / state.prevLivePriceUSD * 100) : 0;
      setDeltaUI(abs, pct);
    } else {
      setDeltaUI(0,0);
    }
  }

  function pricePerUnitFromOunce(ounceUSD, karat, unit){
    const factor = KARAT_FACTORS[karat];
    if (!factor || !Number.isFinite(ounceUSD)) return NaN;
    const usdPerGram24 = ounceUSD / OUNCE_TO_GRAM;
    const usdPerGram = usdPerGram24 * factor;
    if (unit === "gram") return usdPerGram;
    // mithqal
    return usdPerGram * MITHQAL_GRAM;
  }

  function applyFxAndMargin(usdValue, fx, marginIQD, mode){
    if (!Number.isFinite(usdValue)) return NaN;
    if (mode === "IQD"){
      const base = usdValue * fx;
      return base + (Number.isFinite(marginIQD) ? marginIQD : 0);
    }
    return usdValue;
  }

  function updateMarginUI(){
    const v = parseNum(elMarginSlider.value);
    setText(elMarginValue, `${fmtInt(v)} IQD`);

    // disable slider if no fx
    const fx = parseNum(elUsdToIqd.value);
    const mode = currencyModeFromFx(fx);
    const disabled = (mode !== "IQD");
    elMarginSlider.disabled = disabled;
    elMarginSlider.style.opacity = disabled ? 0.45 : 1;
  }

  function renderKaratList(){
    const fx = parseNum(elUsdToIqd.value);
    const mode = currencyModeFromFx(fx);
    const margin = parseNum(elMarginSlider.value) || 0;
    const unit = elUnitLive.value;

    const karats = [24,22,21,18];
    elKaratList.innerHTML = "";
    for (const k of karats){
      const rawUSD = pricePerUnitFromOunce(state.livePriceUSD, k, unit);
      const value = applyFxAndMargin(rawUSD, fx, margin, mode);
      const priceText = withSymbol(mode, value, 2);

      // delta per karat uses the same ounce delta, but scaled by karat factor + unit
      let deltaAbs = 0, deltaPct = 0;
      const prev = state.karatPrev[k];
      if (Number.isFinite(prev) && Number.isFinite(value)){
        deltaAbs = value - prev;
        deltaPct = prev !== 0 ? (deltaAbs/prev*100) : 0;
      }
      // direction: keep last if zero
      let dir = state.karatDir[k];
      if (deltaAbs > 0) dir = "up";
      else if (deltaAbs < 0) dir = "down";
      state.karatDir[k] = dir;

      const deltaText = (Number.isFinite(value) && Number.isFinite(prev))
        ? `${dir==="up"?"▲":dir==="down"?"▼":"—"} ${fmtNumber(Math.abs(deltaAbs), mode==="IQD"?0:2, )} • ${fmtNumber(Math.abs(deltaPct),2)}%`
        : "—";

      const item = document.createElement("div");
      item.className = "karat-item";
      item.innerHTML = `
        <div class="karat-left">
          <div class="karat-badge">${k}</div>
          <div>
            <div class="karat-name">${k}k</div>
            <div class="tiny-hint">per ${unit === "gram" ? "gram" : "mithqal"} • factor ${KARAT_FACTORS[k]}</div>
          </div>
        </div>
        <div class="karat-right">
          <div class="karat-price">${priceText}</div>
          <div class="karat-delta ${dir}">${deltaText}</div>
        </div>
      `;
      elKaratList.appendChild(item);

      // store prev (in the same display mode) so delta matches what user sees
      if (Number.isFinite(value)) state.karatPrev[k] = value;
    }
  }

  function updateSelectedLivePrice(){
    const fx = parseNum(elUsdToIqd.value);
    const mode = currencyModeFromFx(fx);
    const margin = parseNum(elMarginSlider.value) || 0;
    const unit = elUnitLive.value;
    const k = Number(elKaratLive.value);

    setText(elUnitLabelLive, unit === "gram" ? "gram" : "mithqal");

    const rawUSD = pricePerUnitFromOunce(state.livePriceUSD, k, unit);
    const val = applyFxAndMargin(rawUSD, fx, margin, mode);
    setText(elSelectedLivePrice, withSymbol(mode, val, 2));
  }

  // ------------------ Expectation ------------------
  function updateExpectation(){
    const ounce = parseNum(elExpOunce.value);
    const fx = parseNum(elExpUsdToIqd.value);
    const mode = currencyModeFromFx(fx);
    const margin = parseNum(elExpMarginSlider.value) || 0;
    const unit = elExpUnit.value;
    const k = Number(elExpKarat.value);

    setText(elExpMode, mode);

    if (!Number.isFinite(ounce)){
      setText(elExpResult, "—");
      return;
    }

    const rawUSD = pricePerUnitFromOunce(ounce, k, unit);
    const out = applyFxAndMargin(rawUSD, fx, margin, mode);
    setText(elExpResult, withSymbol(mode, out, 2));

    // margin slider only active in IQD mode
    const disabled = (mode !== "IQD");
    elExpMarginSlider.disabled = disabled;
    elExpMarginSlider.style.opacity = disabled ? 0.45 : 1;
    setText(elExpMarginValue, `${fmtInt(parseNum(elExpMarginSlider.value)||0)} IQD`);
  }

  // ------------------ Margin solve ------------------
  function computeSolve(){
    const ounce = parseNum(elSolveOunce.value);
    const fx = parseNum(elSolveUsdToIqd.value);
    const local21 = parseNum(elSolve21.value);
    if (!Number.isFinite(ounce) || !Number.isFinite(fx) || !Number.isFinite(local21)){
      setText(elSolveMargin, "—");
      return {ok:false};
    }
    const base21 = (ounce / OUNCE_TO_GRAM) * 0.875 * 5 * fx; // mithqal fixed
    const margin = local21 - base21;
    const m = Math.max(0, margin); // don't go negative
    setText(elSolveMargin, `${fmtInt(m)} IQD`);
    return {ok:true, margin: m};
  }

  function applySolveToMain(m){
    const mm = clamp(roundToStep(m, 1000), 0, 70000);
    elMarginSlider.value = String(mm);
    updateMarginUI();
    renderAll();
  }

  // ------------------ Input restrictions ------------------
  function numericInputGuard(input){
    input.addEventListener("input", () => {
      // allow digits, one dot, commas (we strip), and empty
      const raw = input.value;
      let cleaned = raw.replace(/[^\d.,]/g, "");
      // keep only first dot
      const parts = cleaned.split(".");
      if (parts.length > 2){
        cleaned = parts[0] + "." + parts.slice(1).join("");
      }
      input.value = cleaned;
    });
  }

  [elUsdToIqd, elExpOunce, elExpUsdToIqd, elSolveOunce, elSolveUsdToIqd, elSolve21].forEach(inp => numericInputGuard(inp));

  // ------------------ API fetch ------------------
  async function fetchLive(){
    const headers = new Headers();
    headers.append("x-api-key", API_KEY);

    const res = await fetch(API_URL, {
      method: "GET",
      headers,
      redirect: "follow",
      cache: "no-store"
    });

    if (!res.ok){
      throw new Error("API error: " + res.status);
    }

    const json = await res.json();
    // expected shape: { data: { XAU: <price> }, ... } or similar; handle common variations.
    let price = NaN;
    if (json && typeof json === "object"){
      if (json.data && typeof json.data === "object"){
        price = Number(json.data.XAU);
      } else if (json.rates && typeof json.rates === "object"){
        price = Number(json.rates.XAU);
      } else if (json.XAU != null){
        price = Number(json.XAU);
      } else if (Array.isArray(json.data)){
        // sometimes: [{symbol:"XAU", rate: ...}]
        const row = json.data.find(r => r.symbol === "XAU" || r.code === "XAU");
        if (row) price = Number(row.rate ?? row.price ?? row.value);
      }
    }
    if (!Number.isFinite(price)) throw new Error("Unexpected API response format");

    return price;
  }

  // ------------------ History update logic ------------------
  function pushHistory(priceUSD){
    const ts = nowMs();

    // only push if changed meaningfully (worker filter handles small noise later, but avoid bloating rawHistory)
    if (rawHistory.length){
      const last = rawHistory[rawHistory.length-1].p;
      if (Math.abs(priceUSD - last) < NOISE_THRESHOLD_USD){
        return false;
      }
    }

    rawHistory.push({t: ts, p: priceUSD});

    // keep a cap to avoid huge storage (still plenty)
    if (rawHistory.length > 8000){
      rawHistory = rawHistory.slice(rawHistory.length - 8000);
    }

    saveLocalHistory(rawHistory);
    return true;
  }

  async function refreshChart(){
    const filtered = filterByTf(rawHistory, state.tf);
    smoothHistory = await workerProcess(filtered);
    updateChart(smoothHistory);
  }

  // ------------------ Render all UI ------------------
  function renderAll(){
    updateMainMetric();
    updateMarginUI();
    renderKaratList();
    updateSelectedLivePrice();
    updateExpectation();
    computeSolve(); // updates UI
  }

  // ------------------ Timeframe buttons ------------------
  function setupTimeframes(){
    document.querySelectorAll(".seg").forEach(btn => {
      btn.addEventListener("click", async () => {
        document.querySelectorAll(".seg").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.tf = btn.dataset.tf;
        await refreshChart();
      });
    });
  }

  // ------------------ Calculator (Samsung-like) ------------------
  const calc = {
    expr: "",
    lastAns: 0,
    justEvaluated: false,
    history: []
  };

  function loadCalcHistory(){
    try{
      const s = localStorage.getItem(STORAGE_CALC_HIST);
      if (!s) return;
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) calc.history = arr.slice(0, 80);
    }catch{}
  }
  function saveCalcHistory(){
    try{ localStorage.setItem(STORAGE_CALC_HIST, JSON.stringify(calc.history.slice(0, 80))); }catch{}
  }

  function renderCalc(){
    const shown = calc.expr.trim() === "" ? "0" : calc.expr;
    setText(elCalcExpr, shown);
    setText(elCalcResult, fmtNumber(calc.lastAns, 10).replace(/\.?0+$/,"")); // cleaner display
  }

  function addHist(eq, res){
    calc.history.unshift({eq, res, t: nowMs()});
    calc.history = calc.history.slice(0, 60);
    saveCalcHistory();
    renderHist();
  }

  function renderHist(){
    elHistoryList.innerHTML = "";
    if (!calc.history.length){
      elHistoryList.innerHTML = `<div class="tiny-hint">No history yet.</div>`;
      return;
    }
    for (const it of calc.history){
      const d = new Date(it.t);
      const div = document.createElement("div");
      div.className = "hist-item";
      div.innerHTML = `
        <div class="hist-eq">${escapeHtml(it.eq)}</div>
        <div class="hist-res">${escapeHtml(it.res)}</div>
        <div class="tiny-hint">${d.toLocaleString()}</div>
      `;
      div.addEventListener("click", () => {
        calc.expr = it.eq;
        calc.justEvaluated = false;
        safeEvalPreview();
      });
      elHistoryList.appendChild(div);
    }
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function safeEval(expr){
    // Convert friendly operators to JS
    // - ÷ -> /
    // - × -> *
    // - % -> /100 (as Samsung-ish percent on last number is complex; we implement inline percent operator)
    // We'll implement: if user presses %: wrap last number as (last/100).
    // Additionally support Ans token.
    let js = expr
      .replace(/Ans/g, String(calc.lastAns))
      .replace(/÷/g, "/")
      .replace(/×/g, "*");

    // allow only safe chars: digits, operators, parentheses, dot, spaces, commas
    if (!/^[0-9+\-*/().\s,]*$/.test(js)) throw new Error("Invalid characters");

    // strip commas
    js = js.replace(/,/g,"");

    // eslint-disable-next-line no-new-func
    const fn = new Function("return (" + js + ")");
    const out = Number(fn());
    if (!Number.isFinite(out)) throw new Error("Math error");
    return out;
  }

  function safeEvalPreview(){
    const e = calc.expr.trim();
    if (e === ""){
      calc.lastAns = 0;
      renderCalc();
      return;
    }
    try{
      const val = safeEval(e);
      calc.lastAns = val;
    }catch{
      // keep lastAns, just show expr
    }
    renderCalc();
  }

  function insertToken(t){
    if (calc.justEvaluated && /[0-9.]/.test(t)){
      calc.expr = "";
      calc.justEvaluated = false;
    }
    calc.expr += t;
    safeEvalPreview();
  }

  function backspace(){
    if (calc.expr.length){
      calc.expr = calc.expr.slice(0, -1);
      safeEvalPreview();
    }
  }

  function clearAll(){
    calc.expr = "";
    calc.lastAns = 0;
    calc.justEvaluated = false;
    renderCalc();
  }

  function toggleSign(){
    // toggle sign of last number
    const s = calc.expr;
    const m = s.match(/(\d+(\.\d+)?)(?!.*\d)/);
    if (!m){ return; }
    const idx = m.index;
    const num = m[1];
    const start = idx;
    const before = s.slice(0, start);
    const after = s.slice(start + num.length);
    // see if there is a '-' right before number and it's a unary for that number
    if (before.endsWith("(-")){
      calc.expr = before.slice(0, -2) + "(" + num + after; // remove -
    } else if (before.endsWith("(")){
      calc.expr = before + "-" + num + after;
    } else if (start === 0 || /[+\-×÷*/(]\s*$/.test(before)){
      // make unary
      calc.expr = before + "(-" + num + ")" + after;
    } else {
      // insert unary parentheses before number
      calc.expr = before + "(-" + num + ")" + after;
    }
    safeEvalPreview();
  }

  function percent(){
    // convert last number to (last/100)
    const s = calc.expr;
    const m = s.match(/(\d+(\.\d+)?)(?!.*\d)/);
    if (!m) return;
    const idx = m.index;
    const num = m[1];
    const before = s.slice(0, idx);
    const after = s.slice(idx + num.length);
    calc.expr = before + "(" + num + "/100)" + after;
    safeEvalPreview();
  }

  function equals(){
    const e = calc.expr.trim();
    if (e === "") return;
    try{
      const val = safeEval(e);
      const shown = fmtNumber(val, 10).replace(/\.?0+$/,"");
      addHist(e, shown);
      calc.lastAns = val;
      calc.justEvaluated = true;
      renderCalc();
    }catch{
      // show error without breaking UX
      elCalcResult.textContent = "Error";
    }
  }

  function buildCalcKeys(){
    // Layout inspired by Samsung: (row) %  ( )  C  ⌫
    // then 7 8 9 ÷
    // 4 5 6 ×
    // 1 2 3 −
    // ± 0 .  +
    // (wide) =
    const keys = [
      {t:"%", a:percent, cls:"op small"},
      {t:"( )", a:() => insertToken("("), cls:"op small", altClose:true},
      {t:"C", a:clearAll, cls:"danger"},
      {t:"⌫", a:backspace, cls:"op"},
      {t:"7", a:() => insertToken("7")},
      {t:"8", a:() => insertToken("8")},
      {t:"9", a:() => insertToken("9")},
      {t:"÷", a:() => insertToken("÷"), cls:"op"},
      {t:"4", a:() => insertToken("4")},
      {t:"5", a:() => insertToken("5")},
      {t:"6", a:() => insertToken("6")},
      {t:"×", a:() => insertToken("×"), cls:"op"},
      {t:"1", a:() => insertToken("1")},
      {t:"2", a:() => insertToken("2")},
      {t:"3", a:() => insertToken("3")},
      {t:"−", a:() => insertToken("-"), cls:"op"},
      {t:"±", a:toggleSign, cls:"op"},
      {t:"0", a:() => insertToken("0")},
      {t:".", a:() => insertToken("."), cls:"op"},
      {t:"+", a:() => insertToken("+"), cls:"op"},
    ];

    elCalcKeys.innerHTML = "";
    for (const k of keys){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "key " + (k.cls || "");
      b.textContent = k.t;
      b.addEventListener("click", () => {
        if (k.t === "( )"){
          // smart parentheses: if more opens than closes, insert ")", else "("
          const opens = (calc.expr.match(/\(/g)||[]).length;
          const closes = (calc.expr.match(/\)/g)||[]).length;
          if (opens > closes) insertToken(")");
          else insertToken("(");
          return;
        }
        k.a();
      });
      elCalcKeys.appendChild(b);
    }

    // = wide row
    const eq = document.createElement("button");
    eq.type = "button";
    eq.className = "key eq";
    eq.style.gridColumn = "span 4";
    eq.textContent = "=";
    eq.addEventListener("click", equals);
    elCalcKeys.appendChild(eq);

    // Keyboard support
    window.addEventListener("keydown", (ev) => {
      const k = ev.key;
      if (k >= "0" && k <= "9") return insertToken(k);
      if (k === ".") return insertToken(".");
      if (k === "+") return insertToken("+");
      if (k === "-") return insertToken("-");
      if (k === "*") return insertToken("×");
      if (k === "/") return insertToken("÷");
      if (k === "Enter") { ev.preventDefault(); return equals(); }
      if (k === "Backspace") return backspace();
      if (k === "Escape") return clearAll();
      if (k === "(") return insertToken("(");
      if (k === ")") return insertToken(")");
      if (k === "%") return percent();
    });
  }

  // ------------------ Events ------------------
  function attachEvents(){
    elBtnClearFx.addEventListener("click", () => {
      elUsdToIqd.value = "";
      renderAll();
    });

    // any input changes update instantly
    [elUsdToIqd, elUnitLive, elKaratLive].forEach(el => el.addEventListener("input", () => { renderAll(); }));
    elUnitLive.addEventListener("change", renderAll);
    elKaratLive.addEventListener("change", renderAll);

    elMarginSlider.addEventListener("input", () => { updateMarginUI(); renderAll(); });

    [elExpOunce, elExpUsdToIqd, elExpKarat, elExpUnit].forEach(el => el.addEventListener("input", updateExpectation));
    elExpMarginSlider.addEventListener("input", updateExpectation);

    [elSolveOunce, elSolveUsdToIqd, elSolve21].forEach(el => el.addEventListener("input", computeSolve));
    elBtnApplySolve.addEventListener("click", () => {
      const r = computeSolve();
      if (r.ok) applySolveToMain(r.margin);
    });

    elBtnForceTick.addEventListener("click", async () => {
      await liveTick(true);
    });

    elBtnExportHistory.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(rawHistory, null, 2)], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gold-history-export.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    // Calc history toggle
    elToggleHistory.addEventListener("click", () => {
      elCalcHistory.classList.toggle("hidden");
    });
    elClearHistory.addEventListener("click", () => {
      calc.history = [];
      saveCalcHistory();
      renderHist();
    });
  }

  // ------------------ Live tick loop ------------------
  async function liveTick(force=false){
    try{
      updateConn();
      const price = await fetchLive();

      const prev = state.livePriceUSD;
      state.prevLivePriceUSD = Number.isFinite(prev) ? prev : NaN;
      state.livePriceUSD = price;

      // Only update "last updated" time if the number changed meaningfully
      const changed = (!Number.isFinite(prev)) ? true : (Math.abs(price - prev) >= NOISE_THRESHOLD_USD);
      if (changed){
        state.lastChangeAt = nowMs();
        setLastUpdated(state.lastChangeAt);

        // update history only when changed
        const pushed = pushHistory(price);
        if (pushed){
          await refreshChart();
        }
      }

      renderAll();
    }catch(err){
      // show offline indicator but keep UI alive
      updateConn();
      // Keep last displayed price, do not wipe.
      console.error(err);
    }
  }

  // ------------------ Init ------------------
  async function init(){
    attachEvents();
    setupTimeframes();
    buildCalcKeys();
    loadCalcHistory();
    renderHist();

    // Load history: localStorage first, else seed json
    rawHistory = loadLocalHistory();
    if (!rawHistory){
      try{
        rawHistory = await loadSeedHistory();
        saveLocalHistory(rawHistory);
      }catch{
        rawHistory = [];
      }
    }

    // Apply last saved timeframe if available
    const meta = loadMeta();
    if (meta && typeof meta === "object" && meta.tf){
      state.tf = String(meta.tf);
      document.querySelectorAll(".seg").forEach(b => {
        b.classList.toggle("active", b.dataset.tf === state.tf);
      });
    }

    await refreshChart();

    // Start with a tick; then poll every ~1.2s (reasonable for UI + API)
    await liveTick(true);
    setInterval(() => {
      liveTick(false).catch(()=>{});
      saveMeta({tf: state.tf});
    }, 1200);

    // Render once so UI isn't blank
    renderAll();
    updateExpectation();
  }

  init().catch(console.error);
})();
