/* Aurum IQ — main logic
   Runs by opening index.html (no build tools). Vanilla JS + Chart.js (CDN).
*/

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);

  const cfg = (window.AURUM_CONFIG || {});
  const NOISE = Number(cfg.NOISE_THRESHOLD_USD ?? 0.10);
  const MAX_LOCAL_POINTS = Number(cfg.MAX_LOCAL_POINTS ?? 4000);

  const OUNCE_GRAMS = 31.1035;
  const MITHQAL_GRAMS = 5;

  const KARAT_FACTORS = {
    24: 1.0,
    22: 0.916,
    21: 0.875,
    18: 0.75
  };

  function nowLocalString(ts = Date.now()){
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  function asNumber(inputEl){
    if (!inputEl) return null;
    const v = String(inputEl.value ?? "").trim();
    if (!v) return null;
    const n = Number(v.replace(/,/g,""));
    if (!isFinite(n)) return null;
    return n;
  }

  function fmtNumber(n, decimals=2){
    if (n == null || !isFinite(n)) return "—";
    const abs = Math.abs(n);
    const d = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
    const use = (decimals == null ? d : decimals);
    return n.toLocaleString(undefined, { maximumFractionDigits: use, minimumFractionDigits: 0 });
  }

  function fmtMoney(n, currency, decimals=2){
    if (n == null || !isFinite(n)) return "—";
    const symbol = currency === "IQD" ? " IQD" : " $";
    return fmtNumber(n, decimals) + symbol;
  }

  function setDeltaUI(elArrow, elAmt, elPct, delta, pct){
    // Keep persistent color and arrow based on sign
    if (!elArrow || !elAmt || !elPct) return;
    const isUp = delta > 0;
    const isDown = delta < 0;
    elArrow.textContent = isUp ? "▲" : isDown ? "▼" : "—";

    elAmt.textContent = isUp || isDown ? `${fmtNumber(Math.abs(delta), 2)}` : "—";
    elPct.textContent = isUp || isDown ? `(${fmtNumber(Math.abs(pct), 3)}%)` : "";

    // remove both classes then add
    [elArrow, elAmt, elPct].forEach(el => {
      el.classList.remove("green","red","muted");
      if (isUp) el.classList.add("green");
      else if (isDown) el.classList.add("red");
      else el.classList.add("muted");
    });
  }

  function setChipDelta(el, delta, pct){
    if (!el) return;
    const isUp = delta > 0;
    const isDown = delta < 0;
    el.classList.remove("green","red","muted");
    if (isUp) el.classList.add("green");
    else if (isDown) el.classList.add("red");
    else el.classList.add("muted");

    if (isUp || isDown){
      el.textContent = `${isUp ? "▲" : "▼"} ${fmtNumber(Math.abs(delta), 0)} • ${fmtNumber(Math.abs(pct), 3)}%`;
    } else {
      el.textContent = "—";
    }
  }

  // ---------- Unit selection (live) ----------
  let liveUnit = "mithqal"; // mithqal or gram
  function unitFactor(unit){
    return unit === "gram" ? 1 : MITHQAL_GRAMS;
  }

  function setSegActive(btnA, btnB, active){
    btnA.classList.toggle("active", active === "A");
    btnB.classList.toggle("active", active === "B");
  }

  const unitM = $("unitLiveMithqal");
  const unitG = $("unitLiveGram");
  unitM.addEventListener("click", () => { liveUnit = "mithqal"; unitM.classList.add("active"); unitG.classList.remove("active"); recomputeAll(); });
  unitG.addEventListener("click", () => { liveUnit = "gram"; unitG.classList.add("active"); unitM.classList.remove("active"); recomputeAll(); });

  // ---------- Margin slider ----------
  const marginSlider = $("marginSlider");
  const marginVal = $("marginVal");
  function getMarginIQD(){
    return Number(marginSlider.value || 0);
  }
  function setMarginIQD(v){
    const snapped = Math.round(Number(v || 0) / 1000) * 1000;
    const clamped = Math.min(70000, Math.max(0, snapped));
    marginSlider.value = String(clamped);
    marginVal.textContent = fmtNumber(clamped, 0) + " IQD";
  }
  marginSlider.addEventListener("input", () => {
    setMarginIQD(getMarginIQD());
    recomputeAll();
  });

  // expectation margin
  const expMarginSlider = $("expMarginSlider");
  const expMarginVal = $("expMarginVal");
  function getExpMarginIQD(){ return Number(expMarginSlider.value || 0); }
  function setExpMarginIQD(v){
    const snapped = Math.round(Number(v || 0) / 1000) * 1000;
    const clamped = Math.min(70000, Math.max(0, snapped));
    expMarginSlider.value = String(clamped);
    expMarginVal.textContent = fmtNumber(clamped, 0) + " IQD";
  }
  expMarginSlider.addEventListener("input", () => { setExpMarginIQD(getExpMarginIQD()); recomputeAll(); });

  // ---------- Price state ----------
  let lastLivePriceUSD = null;         // last accepted (after noise filter)
  let lastLiveAcceptedAt = null;       // timestamp only when changed

  const prevK = {24:null,22:null,21:null,18:null}; // previous per-unit price in selected currency/unit for delta

  // ---------- Conversion & formulas ----------
  function perUnitUSD(ounceUSD, karat, unit){
    const factor = KARAT_FACTORS[karat];
    const grams = unitFactor(unit);
    // (ounce/31.1035) * factor * grams
    return (ounceUSD / OUNCE_GRAMS) * factor * grams;
  }

  function resolveCurrency(){
    const rate = asNumber($("usdIqd"));
    if (rate == null) return { currency:"USD", rate:null };
    return { currency:"IQD", rate };
  }

  function applyCurrency(priceUSD, currencyInfo){
    if (!currencyInfo || currencyInfo.currency === "USD") return priceUSD;
    return priceUSD * currencyInfo.rate;
  }

  function marginApplied(price, currencyInfo){
    if (!currencyInfo || currencyInfo.currency !== "IQD") return price;
    return price + getMarginIQD();
  }

  // ---------- UI update for karats ----------
  function updateKaratCards(ounceUSD){
    const c = resolveCurrency();
    const cur = c.currency;
    const unit = liveUnit;

    const show = (idPrice, idDelta, k) => {
      const priceUSD = perUnitUSD(ounceUSD, k, unit);
      let price = applyCurrency(priceUSD, c);
      // apply margin only in IQD
      price = marginApplied(price, c);

      const elP = $(idPrice);
      elP.textContent = fmtMoney(price, cur, cur==="IQD"?0:2);

      const prev = prevK[k];
      if (prev != null && isFinite(prev)){
        const delta = price - prev;
        const pct = prev === 0 ? 0 : (delta / prev) * 100;
        setChipDelta($(idDelta), delta, pct);
      } else {
        $(idDelta).textContent = "—";
        $(idDelta).classList.add("muted");
      }
      prevK[k] = price;
    };

    show("k24Price","k24Delta",24);
    show("k22Price","k22Delta",22);
    show("k21Price","k21Delta",21);
    show("k18Price","k18Delta",18);
  }

  // ---------- Live hero price UI ----------
  function updateHero(ounceUSD){
    const c = resolveCurrency();
    const cur = c.currency;
    const value = applyCurrency(ounceUSD, c);

    $("livePrice").textContent = fmtMoney(value, cur, cur==="IQD"?0:2);

    // delta for ounce: computed in the worker pipeline (stored in lastLivePriceUSD)
    if (lastLivePriceUSD == null){
      // first run
      setDeltaUI($("liveArrow"), $("liveDeltaAmt"), $("liveDeltaPct"), 0, 0);
      return;
    }
  }

  // ---------- Expectation calculator ----------
  function updateExpectation(){
    const ounce = asNumber($("expOunce"));
    const rate = asNumber($("expUsdIqd"));
    const karat = Number(($("expKarat").value || "21"));
    const unit = String($("expUnit").value || "mithqal");
    const margin = getExpMarginIQD();

    if (ounce == null || rate == null){
      $("expResult").textContent = "—";
      $("expHint").textContent = "Enter expected ounce and USD→IQD.";
      $("expHint").classList.add("muted");
      return;
    }

    const baseUSD = perUnitUSD(ounce, karat, unit);
    const iqd = baseUSD * rate + margin;
    const unitName = (unit === "gram" ? "gram" : "mithqal");
    $("expResult").textContent = fmtNumber(iqd, 0) + " IQD";
    $("expHint").textContent = `${karat}K per ${unitName} (margin included)`;
    $("expHint").classList.remove("muted");
  }

  // ---------- Tax solver (21K per mithqal) ----------
  function updateSolverPreview(){
    const ounce = asNumber($("solveOunce"));
    const rate = asNumber($("solveUsdIqd"));
    const k21 = asNumber($("solveK21"));
    if (ounce == null || rate == null || k21 == null){
      $("solveMargin").textContent = "—";
      return null;
    }

    const result = (ounce / OUNCE_GRAMS) * KARAT_FACTORS[21] * MITHQAL_GRAMS * rate; // without margin
    const margin = k21 - result;
    $("solveMargin").textContent = fmtNumber(margin, 0) + " IQD";
    return margin;
  }

  $("solveOunce").addEventListener("input", () => updateSolverPreview());
  $("solveUsdIqd").addEventListener("input", () => updateSolverPreview());
  $("solveK21").addEventListener("input", () => updateSolverPreview());

  $("applySolveBtn").addEventListener("click", () => {
    const m = updateSolverPreview();
    if (m == null) return;
    setMarginIQD(m);
    recomputeAll();
  });

  // ---------- Connection status ----------
  const netDot = $("netDot");
  const netText = $("netText");
  const netSig = $("netSig");
  const netBox = $("netBox");

  function setNet(state, strength="good"){
    // state: "online"|"offline"|"checking"
    netDot.classList.remove("green","red","muted");
    netText.classList.remove("green","red","muted");
    netSig.classList.remove("green","red","muted");

    if (state === "online"){
      netDot.classList.add("green");
      netText.classList.add("green");
      netSig.classList.add("green");
      netText.textContent = strength === "weak" ? "Online (weak)" : "Online";
      netSig.textContent = strength === "weak" ? "▂▃" : "▂▃▅▇";
      netBox.title = strength === "weak" ? "Online but slow/weak" : "Online and stable";
    } else if (state === "offline"){
      netDot.classList.add("red");
      netText.classList.add("red");
      netSig.classList.add("red");
      netText.textContent = "Offline";
      netSig.textContent = "—";
      netBox.title = "No connection";
    } else {
      netDot.classList.add("muted");
      netText.classList.add("muted");
      netSig.classList.add("muted");
      netText.textContent = "Checking…";
      netSig.textContent = "▂▃▅▇";
      netBox.title = "Checking connection";
    }
  }

  async function probeConnection(){
    if (!navigator.onLine){
      setNet("offline");
      return;
    }
    setNet("checking");
    const t0 = performance.now();
    try{
      // small HEAD request to same API domain for realistic status
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch("https://api.gold-api.com/ping", { method:"GET", cache:"no-store", signal: controller.signal });
      clearTimeout(timeout);
      const dt = performance.now() - t0;
      // even if /ping doesn't exist, fetch will likely return 404 but still means we have internet
      if (res && typeof res.status === "number"){
        const weak = dt > 1200;
        setNet("online", weak ? "weak" : "good");
      } else {
        setNet("online", "weak");
      }
    } catch (e){
      // fallback: use network info if available
      if (!navigator.onLine) setNet("offline");
      else setNet("online", "weak");
    }
  }

  window.addEventListener("online", probeConnection);
  window.addEventListener("offline", probeConnection);
  setInterval(probeConnection, 6000);
  probeConnection();

  // ---------- Clock ----------
  function tickClock(){
    $("clock").textContent = nowLocalString();
  }
  setInterval(tickClock, 250);
  tickClock();

  // ---------- PWA install ----------
  let deferredPrompt = null;
  const installBtn = $("installBtn");
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt){
      // show hint
      installBtn.classList.add("muted");
      installBtn.textContent = "Use browser menu → Add to Home screen";
      setTimeout(() => { installBtn.classList.remove("muted"); installBtn.innerHTML = '<span class="pillIcon">⬇</span><span>Install</span>'; }, 2200);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === "accepted"){
      installBtn.textContent = "Installed";
      installBtn.disabled = true;
    }
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove("muted");
  });

  // Service worker
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  // ---------- History persistence ----------
  const STORAGE_KEY = "aurum_local_history_v1";

  function loadLocalHistory(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw){
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return null;
  }

  function saveLocalHistory(arr){
    try{
      const trimmed = arr.slice(-MAX_LOCAL_POINTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }

  async function loadSeedHistoryFromFile(){
    try{
      const res = await fetch("chart-history.json", { cache:"no-store" });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];
      return data
        .filter(x => x && typeof x.t === "number" && typeof x.p === "number" && isFinite(x.p))
        .sort((a,b) => a.t - b.t);
    } catch {
      return [];
    }
  }

  // Supabase (optional)
  let supabase = null;
  function supaEnabled(){
    return cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY.trim().length > 10;
  }
  function initSupabase(){
    try{
      if (!supaEnabled()) return null;
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
      $("historySource").textContent = "Supabase + cache";
      return supabase;
    } catch {
      return null;
    }
  }
  initSupabase();

  async function supaFetchRange(fromTs){
    if (!supabase) return null;
    try{
      const table = cfg.SUPABASE_TABLE || "gold_prices";
      const { data, error } = await supabase
        .from(table)
        .select("t,p")
        .gte("t", fromTs)
        .order("t", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data || []).map(r => ({ t: Number(r.t), p: Number(r.p) }))
        .filter(x => isFinite(x.t) && isFinite(x.p));
    } catch {
      return null;
    }
  }

  async function supaInsertPoint(t, p){
    if (!supabase) return false;
    try{
      const table = cfg.SUPABASE_TABLE || "gold_prices";
      const { error } = await supabase.from(table).insert([{ t, p }], { returning: "minimal" });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }

  // ---------- Worker & API polling ----------
  const worker = new Worker("worker.js", { type: "classic" });

  let seedHistory = [];
  let chartHistory = []; // authoritative in main thread
  let chart = null;
  let currentTF = "24h";

  function tfWindowMs(tf){
    if (tf === "24h") return 24 * 60 * 60 * 1000;
    if (tf === "7d") return 7 * 24 * 60 * 60 * 1000;
    if (tf === "1m") return 31 * 24 * 60 * 60 * 1000; // rolling
    if (tf === "1y") return 366 * 24 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
  }

  function filterHistoryForTF(arr, tf){
    const win = tfWindowMs(tf);
    const cutoff = Date.now() - win;
    const out = arr.filter(pt => pt.t >= cutoff);
    // keep at least some points
    return out.length ? out : arr.slice(-200);
  }

  function labelForTF(ts, tf){
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2,"0");
    if (tf === "24h"){
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (tf === "7d"){
      // day + time
      const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      return `${days[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (tf === "1m"){
      // month/day
      return `${d.getMonth()+1}/${d.getDate()}`;
    }
    if (tf === "1y"){
      return `${d.getFullYear()}`;
    }
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  const crosshairPlugin = {
    id: "aurumCrosshair",
    afterDraw(chart, args, opts){
      const ctx = chart.ctx;
      const active = chart._active || [];
      if (!active || !active.length) return;
      const pt = active[0].element;
      if (!pt) return;

      const { top, bottom, left, right } = chart.chartArea;
      const x = pt.x;
      const y = pt.y;

      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([5,4]);
      ctx.strokeStyle = "rgba(255,223,136,.45)";
      // vertical
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      // horizontal
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.restore();
    }
  };

  function buildChart(){
    const ctx = $("priceChart").getContext("2d");
    const overlayBox = $("overlayBox");
    const overlayPrice = $("overlayPrice");
    const overlayTime = $("overlayTime");

    Chart.register(crosshairPlugin);

    chart = new Chart(ctx, {
      type: "line",
      data: { labels: [], datasets: [{
        label: "XAU (oz)",
        data: [],
        tension: 0.22,
        borderWidth: 2,
        pointRadius: 0,
        // color is controlled by segment scriptable option:
        segment: {
          borderColor: (ctx) => {
            const i = ctx.p0DataIndex;
            const arr = ctx.chart.data.datasets[0].data;
            if (!arr || i <= 0) return "rgba(216,178,90,.95)";
            const prev = Number(arr[i - 1]);
            const curr = Number(arr[i]);
            if (!isFinite(prev) || !isFinite(curr)) return "rgba(216,178,90,.95)";
            if (curr > prev) return "rgba(46,229,157,.95)";
            if (curr < prev) return "rgba(255,77,109,.95)";
            return "rgba(216,178,90,.95)";
          }
        }
      }]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: false,
            external: (context) => {
              const tooltip = context.tooltip;
              if (!tooltip || tooltip.opacity === 0){
                overlayBox.style.display = "none";
                return;
              }
              const idx = tooltip.dataPoints?.[0]?.dataIndex;
              if (idx == null) return;

              const val = context.chart.data.datasets[0].data[idx];
              const label = context.chart.data.labels[idx];
              overlayPrice.textContent = fmtNumber(Number(val), 2) + " $";
              overlayTime.textContent = String(label);
              overlayBox.style.display = "block";
            }
          },
          zoom: {
            pan: { enabled: true, mode: "x" },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: "x"
            },
            limits: { x: { minRange: 20 } }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,.08)" },
            ticks: { color: "rgba(244,240,230,.72)", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
          },
          y: {
            position: "right",
            grid: { color: "rgba(255,255,255,.08)" },
            ticks: { color: "rgba(244,240,230,.72)", callback: (v) => fmtNumber(Number(v), 0) }
          }
        }
      }
    });
  }

  function renderChart(){
    if (!chart) buildChart();

    const view = filterHistoryForTF(chartHistory, currentTF);
    const labels = view.map(pt => labelForTF(pt.t, currentTF));
    const data = view.map(pt => pt.p);

    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update("none");
  }

  function setTimeframe(tf){
    currentTF = tf;
    document.querySelectorAll(".tfBtn").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-tf") === tf);
    });
    renderChart();
  }

  document.querySelectorAll(".tfBtn").forEach(btn => {
    btn.addEventListener("click", () => setTimeframe(btn.getAttribute("data-tf")));
  });

  $("resetZoomBtn").addEventListener("click", () => {
    try{ chart?.resetZoom(); } catch {}
  });

  $("exportBtn").addEventListener("click", async () => {
    const blob = new Blob([JSON.stringify(chartHistory, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gold-history-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // ---------- API fetch loop ----------
  const API_URL = "https://api.gold-api.com/price/XAU";
  let pollDelay = 1000;
  let inFlight = false;

  async function fetchPrice(){
    if (inFlight) return;
    inFlight = true;
    try{
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(API_URL, { cache:"no-store", signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      // gold-api usually returns { price: number, ... }
      const p = Number(data?.price);
      if (!isFinite(p)) throw new Error("Bad price");
      worker.postMessage({ type:"tick", t: Date.now(), price: p });
      pollDelay = 1000; // recover
    } catch (e){
      // backoff
      pollDelay = Math.min(8000, Math.floor(pollDelay * 1.4));
    } finally{
      inFlight = false;
      setTimeout(fetchPrice, pollDelay);
    }
  }

  // ---------- Main recompute ----------
  function recomputeAll(){
    // Use lastLivePriceUSD for calculations when available, otherwise show placeholders
    const ounce = lastLivePriceUSD;
    if (ounce == null || !isFinite(ounce)){
      updateExpectation();
      updateSolverPreview();
      // show currency label changes even if no live
      const c = resolveCurrency();
      marginVal.textContent = fmtNumber(getMarginIQD(),0) + " IQD";
      if (c.currency !== "IQD"){
        // still show chip values but without margin
      }
      return;
    }

    updateHero(ounce);
    updateKaratCards(ounce);
    updateExpectation();
    updateSolverPreview();

    // margin label
    marginVal.textContent = fmtNumber(getMarginIQD(),0) + " IQD";
  }

  // ---------- Input listeners ----------
  $("usdIqd").addEventListener("input", () => {
    const rate = asNumber($("usdIqd"));
    // when USD to IQD is empty, margin doesn't apply (but keep slider value)
    // still recompute outputs immediately
    recomputeAll();
  });

  $("expOunce").addEventListener("input", updateExpectation);
  $("expUsdIqd").addEventListener("input", updateExpectation);
  $("expKarat").addEventListener("change", updateExpectation);
  $("expUnit").addEventListener("change", updateExpectation);

  // ---------- Worker messages ----------
  worker.onmessage = async (ev) => {
    const msg = ev.data || {};
    if (msg.type === "ready"){
      // nothing
      return;
    }

    if (msg.type === "price_changed"){
      const t = Number(msg.t);
      const p = Number(msg.price);

      // delta on ounce
      const prev = lastLivePriceUSD;
      lastLivePriceUSD = p;
      lastLiveAcceptedAt = t;

      // update last updated only when changed
      $("lastUpdated").textContent = nowLocalString(t);

      // update hero delta in current currency
      const c = resolveCurrency();
      const prevCur = prev == null ? null : applyCurrency(prev, c);
      const currCur = applyCurrency(p, c);
      if (prevCur != null){
        const delta = currCur - prevCur;
        const pct = prevCur === 0 ? 0 : (delta / prevCur) * 100;
        setDeltaUI($("liveArrow"), $("liveDeltaAmt"), $("liveDeltaPct"), delta, pct);
        $("liveDeltaAmt").textContent = fmtMoney(Math.abs(delta), c.currency, c.currency==="IQD"?0:2);
      } else {
        setDeltaUI($("liveArrow"), $("liveDeltaAmt"), $("liveDeltaPct"), 0, 0);
      }

      // update live price display in currency
      $("livePrice").textContent = fmtMoney(currCur, c.currency, c.currency==="IQD"?0:2);

      // history push in main thread too
      chartHistory.push({ t, p });
      if (chartHistory.length > MAX_LOCAL_POINTS) chartHistory.splice(0, chartHistory.length - MAX_LOCAL_POINTS);
      saveLocalHistory(chartHistory);

      // store to Supabase only when changed (this message is only emitted on change)
      if (supabase){
        await supaInsertPoint(t, p);
      }

      renderChart();
      recomputeAll();
      return;
    }

    if (msg.type === "no_change"){
      // keep UI stable; do nothing
      return;
    }
  };

  // ---------- Calculator ----------
  const calc = {
    expr: "",
    out: "0",
    history: []
  };

  const calcExpr = $("calcExpr");
  const calcOut = $("calcOut");
  const historyList = $("historyList");
  const calcHistory = $("calcHistory");

  function renderCalc(){
    calcExpr.textContent = calc.expr || " ";
    calcOut.textContent = calc.out || "0";
  }

  function pushHistory(expr, res){
    calc.history.unshift({ expr, res, t: Date.now() });
    calc.history = calc.history.slice(0, 60);
    try{ localStorage.setItem("aurum_calc_history", JSON.stringify(calc.history)); } catch {}
    renderHistory();
  }

  function loadCalcHistory(){
    try{
      const raw = localStorage.getItem("aurum_calc_history");
      if (raw){
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) calc.history = arr;
      }
    } catch {}
  }

  function renderHistory(){
    historyList.innerHTML = "";
    for (const h of calc.history){
      const div = document.createElement("div");
      div.className = "histItem";
      div.innerHTML = `<div class="histExpr"></div><div class="histRes"></div>`;
      div.querySelector(".histExpr").textContent = h.expr;
      div.querySelector(".histRes").textContent = h.res;
      div.addEventListener("click", () => {
        calc.expr = h.expr;
        calc.out = h.res;
        renderCalc();
      });
      historyList.appendChild(div);
    }
  }

  function tokenize(expr){
    // supports numbers, ., operators + - * ÷ / % ^, parentheses
    const s = expr.replace(/\s+/g,"")
      .replace(/÷/g,"/")
      .replace(/×/g,"*");
    const tokens = [];
    let i = 0;
    while (i < s.length){
      const ch = s[i];
      if ("0123456789.".includes(ch)){
        let j = i + 1;
        while (j < s.length && "0123456789.".includes(s[j])) j++;
        tokens.push({ type:"num", v: s.slice(i,j) });
        i = j;
        continue;
      }
      if ("+-*/%^()".includes(ch)){
        tokens.push({ type:"op", v: ch });
        i++;
        continue;
      }
      // unknown char -> skip
      i++;
    }
    return tokens;
  }

  const prec = { "^":4, "*":3, "/":3, "%":3, "+":2, "-":2 };
  const rightAssoc = { "^": true };

  function toRPN(tokens){
    const out = [];
    const ops = [];
    let prevType = "start";
    for (const t of tokens){
      if (t.type === "num"){
        out.push(t);
        prevType = "num";
        continue;
      }
      const v = t.v;
      if (v === "("){
        ops.push(t);
        prevType = "(";
        continue;
      }
      if (v === ")"){
        while (ops.length && ops[ops.length-1].v !== "("){
          out.push(ops.pop());
        }
        if (ops.length && ops[ops.length-1].v === "(") ops.pop();
        prevType = ")";
        continue;
      }

      // unary minus support
      if (v === "-" && (prevType === "start" || prevType === "(" || prevType === "op")){
        // convert unary minus into (0 - x)
        out.push({ type:"num", v:"0" });
      }

      while (ops.length){
        const top = ops[ops.length-1].v;
        if (top === "(") break;
        const pTop = prec[top] ?? 0;
        const pV = prec[v] ?? 0;
        if (pTop > pV || (pTop === pV && !rightAssoc[v])){
          out.push(ops.pop());
        } else break;
      }
      ops.push(t);
      prevType = "op";
    }
    while (ops.length) out.push(ops.pop());
    return out;
  }

  function evalRPN(rpn){
    const st = [];
    for (const t of rpn){
      if (t.type === "num"){
        st.push(Number(t.v));
        continue;
      }
      const op = t.v;
      const b = st.pop();
      const a = st.pop();
      if (a == null || b == null) return NaN;

      let r = NaN;
      if (op === "+") r = a + b;
      else if (op === "-") r = a - b;
      else if (op === "*") r = a * b;
      else if (op === "/") r = b === 0 ? NaN : a / b;
      else if (op === "%") r = a % b;
      else if (op === "^") r = Math.pow(a, b);
      st.push(r);
    }
    return st.length ? st[0] : NaN;
  }

  function formatCalcResult(n){
    if (!isFinite(n)) return "Error";
    // show up to 10 significant digits, but with commas for large ints
    const abs = Math.abs(n);
    if (abs >= 1e12) return n.toExponential(6);
    if (Number.isInteger(n) && abs < 1e12) return n.toLocaleString();
    // for decimals
    return n.toLocaleString(undefined, { maximumFractionDigits: 10 });
  }

  function calcEval(){
    const expr = calc.expr.trim();
    if (!expr) return;
    const tokens = tokenize(expr);
    const rpn = toRPN(tokens);
    const val = evalRPN(rpn);
    const res = formatCalcResult(val);
    calc.out = res;
    pushHistory(expr, res);
    renderCalc();
  }

  function calcBackspace(){
    calc.expr = calc.expr.slice(0, -1);
    renderCalc();
  }

  function calcClear(){
    calc.expr = "";
    calc.out = "0";
    renderCalc();
  }

  function calcInput(s){
    // keep expression safe: only allow certain chars
    const allowed = "0123456789.+-×*/÷%^()";
    if (!allowed.includes(s)) return;
    // prevent repeated dots in current number
    if (s === "."){
      // scan back until non-digit
      let i = calc.expr.length - 1;
      while (i >= 0 && "0123456789.".includes(calc.expr[i])) i--;
      const chunk = calc.expr.slice(i+1);
      if (chunk.includes(".")) return;
    }
    calc.expr += s;
    renderCalc();
  }

  function calcToggleSign(){
    // toggles sign of last number by wrapping
    const s = calc.expr;
    // find last number segment
    let i = s.length - 1;
    while (i >= 0 && "0123456789.".includes(s[i])) i--;
    const start = i + 1;
    if (start >= s.length) return;
    const num = s.slice(start);
    if (!num) return;
    // if already has unary minus just remove it
    if (start >= 1 && s[start-1] === "-" && (start-1 === 0 || "+-×*/÷%^(".includes(s[start-2]))){
      calc.expr = s.slice(0, start-1) + s.slice(start);
      renderCalc();
      return;
    }
    calc.expr = s.slice(0, start) + "-" + num;
    renderCalc();
  }

  function calcPercent(){
    // Convert last number x into (x/100)
    const s = calc.expr;
    let i = s.length - 1;
    while (i >= 0 && "0123456789.".includes(s[i])) i--;
    const start = i + 1;
    if (start >= s.length) return;
    const num = s.slice(start);
    if (!num) return;
    calc.expr = s.slice(0, start) + "(" + num + "÷100)";
    renderCalc();
  }

  const keyLayout = [
    { t:"C", cls:"danger", act: calcClear },
    { t:"( )", cls:"op", act: () => calcInput("(") },
    { t:"%", cls:"op", act: calcPercent },
    { t:"÷", cls:"op", act: () => calcInput("÷") },

    { t:"7", act: () => calcInput("7") },
    { t:"8", act: () => calcInput("8") },
    { t:"9", act: () => calcInput("9") },
    { t:"×", cls:"op", act: () => calcInput("×") },

    { t:"4", act: () => calcInput("4") },
    { t:"5", act: () => calcInput("5") },
    { t:"6", act: () => calcInput("6") },
    { t:"-", cls:"op", act: () => calcInput("-") },

    { t:"1", act: () => calcInput("1") },
    { t:"2", act: () => calcInput("2") },
    { t:"3", act: () => calcInput("3") },
    { t:"+", cls:"op", act: () => calcInput("+") },

    { t:"±", cls:"op", act: calcToggleSign },
    { t:"0", act: () => calcInput("0") },
    { t:".", act: () => calcInput(".") },
    { t:"=", cls:"eq", act: calcEval },

    { t:"⌫", cls:"op", act: calcBackspace },
    { t:")", cls:"op", act: () => calcInput(")") },
    { t:"^", cls:"op", act: () => calcInput("^") },
    { t:"", cls:"op", act: () => {} }
  ];

  function buildKeys(){
    const wrap = $("calcKeys");
    wrap.innerHTML = "";
    keyLayout.forEach(k => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "calcKey " + (k.cls || "");
      b.textContent = k.t;
      b.addEventListener("click", k.act);
      wrap.appendChild(b);
    });
  }

  $("toggleHistoryBtn").addEventListener("click", () => {
    calcHistory.classList.toggle("hidden");
  });

  $("clearHistoryBtn").addEventListener("click", () => {
    calc.history = [];
    try{ localStorage.removeItem("aurum_calc_history"); } catch {}
    renderHistory();
  });

  // keyboard support
  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "Enter"){ e.preventDefault(); calcEval(); return; }
    if (k === "Backspace"){ calcBackspace(); return; }
    if (k === "Escape"){ calcClear(); return; }
    if ("0123456789".includes(k)) return calcInput(k);
    if (k === ".") return calcInput(".");
    if (k === "+") return calcInput("+");
    if (k === "-") return calcInput("-");
    if (k === "*") return calcInput("×");
    if (k === "/") return calcInput("÷");
    if (k === "(") return calcInput("(");
    if (k === ")") return calcInput(")");
    if (k === "%") return calcPercent();
    if (k === "^") return calcInput("^");
  });

  // ---------- Boot ----------
  async function boot(){
    buildKeys();
    loadCalcHistory();
    renderHistory();
    renderCalc();

    // seed history: prefer localStorage cache, then supabase, then bundled json
    const local = loadLocalHistory();
    if (local && local.length){
      chartHistory = local;
      $("historySource").textContent = supabase ? "Supabase + local cache" : "Local cache";
    } else if (supabase){
      // fetch 24h initially
      const from = Date.now() - tfWindowMs("24h");
      const supa = await supaFetchRange(from);
      if (supa && supa.length){
        chartHistory = supa;
        saveLocalHistory(chartHistory);
      } else {
        seedHistory = await loadSeedHistoryFromFile();
        chartHistory = seedHistory;
        saveLocalHistory(chartHistory);
      }
    } else {
      seedHistory = await loadSeedHistoryFromFile();
      chartHistory = seedHistory;
      saveLocalHistory(chartHistory);
    }

    // init worker with seed
    worker.postMessage({ type:"init", threshold: NOISE, maxPoints: MAX_LOCAL_POINTS, seedHistory: chartHistory });

    // set lastLivePriceUSD from most recent point if any
    if (chartHistory.length){
      lastLivePriceUSD = chartHistory[chartHistory.length - 1].p;
      $("livePrice").textContent = fmtMoney(lastLivePriceUSD, "USD", 2);
      $("lastUpdated").textContent = nowLocalString(chartHistory[chartHistory.length - 1].t);
    }

    // initial render
    renderChart();
    recomputeAll();
    updateExpectation();
    updateSolverPreview();

    // start polling
    setTimeout(fetchPrice, 500);
  }

  boot();
})();
