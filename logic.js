/* =========================================================
   logic.js — GOLD ENGINE + CALCULATOR BRAIN
   Live XAU • Karats • Margin • Expectation • OHLC • Failover
   ========================================================= */

/* ===================== CONFIG ===================== */
const API_SOURCES = [
  "https://api.gold-api.com/price/XAU",
  "https://data-asg.goldprice.org/dbXRates/USD"
];

const OUNCE_GRAM = 31.1035;
const MITHQAL_GRAM = 5;

const KARAT_FACTORS = {
  24: 1,
  22: 0.916,
  21: 0.875,
  18: 0.75
};

/* ===================== STATE ===================== */
let state = {
  liveOunce: null,
  prevOunce: null,
  lastUpdate: null,
  usdToIqd: null,
  margin: 0,
  chartData: []
};

/* ===================== HELPERS ===================== */
function formatNumber(num, symbol = "") {
  return symbol + Number(num).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function nowString() {
  const d = new Date();
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function isOnline() {
  return navigator.onLine;
}

/* ===================== CONNECTION STATUS ===================== */
function updateConnectionUI() {
  const el = document.getElementById("connectionStatus");
  if (!el) return;
  if (isOnline()) {
    el.textContent = "ONLINE";
    el.className = "online";
  } else {
    el.textContent = "OFFLINE";
    el.className = "offline";
  }
}

window.addEventListener("online", updateConnectionUI);
window.addEventListener("offline", updateConnectionUI);

/* ===================== API FETCH WITH FAILOVER ===================== */
async function fetchGoldPrice() {
  for (let url of API_SOURCES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (data.price) return data.price;
      if (data.rates && data.rates.XAU)
        return 1 / data.rates.XAU;
    } catch (e) {}
  }
  return null;
}

/* ===================== LIVE UPDATE LOOP ===================== */
async function updateLiveGold() {
  const price = await fetchGoldPrice();
  if (!price) return;

  if (state.liveOunce !== price) {
    state.prevOunce = state.liveOunce;
    state.liveOunce = price;
    state.lastUpdate = nowString();

    updateLiveUI();
    updateKarats();
    updateChart(price);

    document.dispatchEvent(
      new CustomEvent("goldPriceUpdated", { detail: { price } })
    );
  }
}

setInterval(updateLiveGold, 1000);

/* ===================== LIVE UI ===================== */
function updateLiveUI() {
  const priceEl = document.getElementById("liveOunce");
  const changeEl = document.getElementById("ounceChange");
  const timeEl = document.getElementById("lastUpdate");

  priceEl.textContent = formatNumber(state.liveOunce, "$");

  if (state.prevOunce !== null) {
    const diff = state.liveOunce - state.prevOunce;
    const pct = (diff / state.prevOunce) * 100;
    const up = diff >= 0;

    changeEl.className = up ? "up" : "down";
    changeEl.textContent =
      `${up ? "▲" : "▼"} ${formatNumber(Math.abs(diff))} (${pct.toFixed(2)}%)`;
  }

  timeEl.textContent = "Updated: " + state.lastUpdate;
}

/* ===================== KARAT ENGINE ===================== */
function calcKaratPrice(karat, unit = "mithqal") {
  if (!state.liveOunce) return 0;

  const usdIqd = state.usdToIqd || 1;
  const grams = unit === "gram" ? 1 : MITHQAL_GRAM;

  return (
    (state.liveOunce / OUNCE_GRAM) *
    KARAT_FACTORS[karat] *
    grams *
    usdIqd +
    state.margin
  );
}

function updateKarats() {
  [24, 22, 21, 18].forEach(k => {
    const el = document.getElementById(`karat-${k}`);
    if (!el) return;

    const price = calcKaratPrice(k);
    if (state.usdToIqd)
      el.textContent = formatNumber(price, "") + " IQD";
    else
      el.textContent = formatNumber(price, "$");
  });
}

/* ===================== INPUT LISTENERS ===================== */
document.getElementById("usdToIqd")?.addEventListener("input", e => {
  state.usdToIqd = parseFloat(e.target.value) || null;
  updateKarats();
});

document.getElementById("marginSlider")?.addEventListener("input", e => {
  state.margin = parseInt(e.target.value);
  document.getElementById("marginValue").textContent =
    state.margin.toLocaleString() + " IQD";
  updateKarats();
});

/* ===================== EXPECTATION ENGINE ===================== */
function updateExpectation() {
  const ounce = parseFloat(document.getElementById("expectOunce")?.value);
  const usdIqd = parseFloat(document.getElementById("expectUsdIqd")?.value);
  const karat = document.getElementById("expectKarat")?.value;
  const unit = document.getElementById("expectUnit")?.value;

  if (!ounce || !usdIqd) return;

  const grams = unit === "gram" ? 1 : MITHQAL_GRAM;
  const result =
    (ounce / OUNCE_GRAM) *
    KARAT_FACTORS[karat] *
    grams *
    usdIqd +
    state.margin;

  document.getElementById("expectResult").textContent =
    formatNumber(result) + " IQD";
}

["expectOunce", "expectUsdIqd", "expectKarat", "expectUnit"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", updateExpectation);
});

/* ===================== TAX / MARGIN DETECTOR ===================== */
document.getElementById("applyTaxBtn")?.addEventListener("click", () => {
  const local = parseFloat(
    document.getElementById("localGoldPrice").value
  );
  const karat = document.getElementById("taxKarat").value;

  const calc = calcKaratPrice(karat);
  const tax = Math.round(local - calc);

  if (tax >= 0 && tax <= 20000) {
    state.margin = tax;
    document.getElementById("marginSlider").value = tax;
    document.getElementById("marginValue").textContent =
      tax.toLocaleString() + " IQD";
    updateKarats();
  }
});

/* ===================== CALCULATOR ===================== */
let calcExpr = "";
let calcHistory = [];

function press(v) {
  const screen = document.getElementById("calcScreen");

  if (v === "C") {
    calcExpr = "";
    screen.textContent = "0";
    return;
  }

  if (v === "=") {
    try {
      const evalExpr = calcExpr
        .replace(/×/g, "*")
        .replace(/÷/g, "/");
      const res = eval(evalExpr);
      calcHistory.push(calcExpr + " = " + res);
      document.getElementById("calcHistory").innerHTML =
        calcHistory.map(h => `<div>${h}</div>`).join("");
      calcExpr = String(res);
      screen.textContent = res;
    } catch {
      screen.textContent = "Error";
    }
    return;
  }

  calcExpr += v;
  screen.textContent = calcExpr;
}

/* ===================== OHLC CHART (LINE CORE) ===================== */
function updateChart(price) {
  const t = Date.now();
  state.chartData.push({ t, price });
  if (state.chartData.length > 300)
    state.chartData.shift();

  const canvas = document.getElementById("ohlcChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const prices = state.chartData.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  ctx.beginPath();
  state.chartData.forEach((p, i) => {
    const x = (i / state.chartData.length) * canvas.width;
    const y =
      canvas.height -
      ((p.price - min) / (max - min)) * canvas.height;

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.strokeStyle =
    price >= state.prevOunce ? "#2ecc71" : "#e74c3c";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/* ===================== INIT ===================== */
updateConnectionUI();
updateLiveGold();
