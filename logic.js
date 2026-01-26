/* =========================
   CORE HELPERS
========================= */

const el = id => document.getElementById(id);
let isFormatting = false;

/* ---- Commas (UI only) ---- */
function addCommas(v) {
  const parts = v.split(".");
  parts[0] = parts[0]
    .replace(/\D/g, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return parts.length > 1
    ? parts[0] + "." + parts[1].replace(/\D/g, "")
    : parts[0];
}

function removeCommas(v) {
  return v.replace(/,/g, "");
}

function attachCommaFormatter(inputEl) {
  inputEl.addEventListener("input", () => {
    if (isFormatting) return;
    isFormatting = true;

    const raw = removeCommas(inputEl.value);
    inputEl.value = raw === "" ? "" : addCommas(raw);

    isFormatting = false;
  });
}

/* =========================
   NEW YORK BASELINE
========================= */

function getNYDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

let nyDateStored = localStorage.getItem("nyDate");
let nyBaseline = Number(localStorage.getItem("nyBaseline")) || 0;

/* =========================
   CONNECTION STATUS
========================= */

function updateConnection(force = false) {
  el("status").textContent =
    (!navigator.onLine || force)
      ? "🔴 نیشانە نیە"
      : "🟢 نیشانە هەیە";
}

function setChange(target, pct, diff, unit = "") {
  if (!target) return;

  const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "";
  const sign  = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const color = diff > 0 ? "#0f0" : diff < 0 ? "#f00" : "#999";

  let valueText = "";
  if (unit === "$") {
    valueText = `${sign}${Math.abs(diff).toFixed(2)}$`;
  } else if (unit === "IQD") {
    valueText = `${sign}${Math.abs(diff).toLocaleString()} IQD`;
  }

  target.textContent =
    arrow ? `${arrow} ${pct.toFixed(2)}% (${valueText})` : "";

  target.style.color = color;
}

/* =========================
   LIVE GOLD UPDATE
========================= */

async function update() {
  try {
    if (!navigator.onLine) throw 0;

    const res = await fetch("https://api.gold-api.com/price/XAU", { cache: "no-store" });
    const data = await res.json();
    const ounce = data.price;

    const today = getNYDate();
    if (nyDateStored !== today || !nyBaseline) {
      nyDateStored = today;
      nyBaseline = ounce;
      localStorage.setItem("nyDate", today);
      localStorage.setItem("nyBaseline", ounce);
    }

    const diff = ounce - nyBaseline;
    const pct = (diff / nyBaseline) * 100;

    const g21 = (ounce / 31.1035) * 0.875 * 5;
    const margin = Number(el("margin").value) || 0;
    const market21 = g21 * (1 + margin / 100);

    el("ounce").textContent = `$${ounce.toFixed(2)}`;
    el("global21").textContent = `$${g21.toFixed(2)}`;
    el("market21").textContent = `$${market21.toFixed(2)}`;

    const usd = Number(removeCommas(el("usd").value)) || 0;
    el("iqdNoMargin").textContent = (g21 * usd).toLocaleString() + " IQD";
    el("iqdMargin").textContent = (market21 * usd).toLocaleString() + " IQD";

    setChange(el("chgOunce"), pct, diff, "$");
    setChange(el("chg21"), pct, diff, "$");
    setChange(el("chgMarket"), pct, diff, "$");
    setChange(el("chgIQD"), pct, diff * Number(removeCommas(el("usd").value || 0)), "IQD");
    setChange(el("chgIQDM"), pct, diff * Number(removeCommas(el("usd").value || 0)), "IQD");


    el("time").textContent = "نوێکردنەوە: " + new Date().toLocaleTimeString();
    updateConnection(false);
  } catch {
    updateConnection(true);
  }
}

el("margin").oninput = () => {
  el("mval").textContent = el("margin").value + "%";
};

setInterval(update, 1000);
update();

/* =========================
   EXPECTATION SIMULATOR
========================= */

function runSimulation() {
  const o = Number(removeCommas(el("simOunce").value));
  const usd = Number(removeCommas(el("simUsd").value));
  const m = Number(removeCommas(el("simMargin").value));

  if (!o || !usd) return;

  const g21 = (o / 31.1035) * 0.875 * 5;
  const market = g21 * (1 + m / 100);
  const iqd = market * usd;

  el("sim21usd").textContent = "$" + g21.toFixed(2);
  el("sim21iqd").textContent = iqd.toLocaleString() + " IQD";

  const cur =
    Number(el("iqdMargin").textContent.replace(/[^\d]/g, "")) || 0;

  el("simDiff").textContent =
    (iqd >= cur ? "▲ " : "▼ ") + (iqd - cur).toLocaleString();
}

/* =========================
   HYBRID MARKET (OFFLINE)
========================= */

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function submitMarketPrice() {
  const price = Number(removeCommas(el("shopPrice").value));
  if (!price) return;

  let entries = JSON.parse(localStorage.getItem("marketPrices") || "[]");
  const now = Date.now();

  entries = entries.filter(e => now - e.t < 86400000);

  if (entries.filter(e => e.d === todayKey()).length >= 3) return;

  entries.push({ v: price, t: now, d: todayKey() });
  localStorage.setItem("marketPrices", JSON.stringify(entries));

  calculateHybridMargin(entries);
}

function calculateHybridMargin(entries) {
  if (!entries.length) return;

  const avg = entries.reduce((a,b) => a + b.v, 0) / entries.length;
  const g21usd = Number(el("global21").textContent.replace("$","")) || 0;
  const usd = Number(removeCommas(el("usd").value)) || 0;

  if (!g21usd || !usd) return;

  const implied = ((avg / (g21usd * usd)) - 1) * 100;
  el("realMargin").textContent = implied.toFixed(2) + "%";

  const confidence = Math.min(100, entries.length * 20);
  el("confidence").textContent = confidence + "%";

  if (confidence >= 60) {
    el("margin").value = implied.toFixed(1);
    el("mval").textContent = implied.toFixed(1) + "%";
  }
}

/* =========================
   CALCULATOR
========================= */

let expression = "";
let history = JSON.parse(localStorage.getItem("calcHistory") || "[]");

const calcTyping = el("calcTyping");
const calcExpression = el("calcExpression");
const calcResult = el("calcResult");

function toggleCalc() {
  el("calc").classList.toggle("hidden");
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatNumber(n) {
  if (Math.abs(n) >= 1e12) {
    return n.toExponential(2).replace("e+", "E+");
  }
  return n.toLocaleString();
}

function c(v) {
  if (v === "%") {
    const m = expression.match(/(\d+\.?\d*)$/);
    if (!m) return;
    expression = expression.slice(0, -m[1].length) + "(" + m[1] + "/100)";
  } else {
    expression += v;
  }

  calcTyping.textContent = expression;

  try {
    if (!/[+\-*/.]$/.test(expression)) {
      calcResult.textContent = formatNumber(eval(expression));
    }
  } catch {}
}

function calc() {
  try {
    const res = eval(expression);
    history.unshift({ exp: expression, res: formatNumber(res), time: timeNow() });
    if (history.length > 30) history.pop();
    localStorage.setItem("calcHistory", JSON.stringify(history));

    calcExpression.textContent = expression;
    calcResult.textContent = formatNumber(res);
    expression = "";
    calcTyping.textContent = "";
    renderHistory();
  } catch {
    calcResult.textContent = "Error";
  }
}

function del() {
  expression = expression.slice(0, -1);
  calcTyping.textContent = expression;
}

function clr() {
  expression = "";
  calcTyping.textContent = "";
  calcResult.textContent = "";
  calcExpression.textContent = "";
}

function toggleSign() {
  if (!expression) return;
  expression = expression.startsWith("-") ? expression.slice(1) : "-" + expression;
  calcTyping.textContent = expression;
}

function openHistory() {
  if (!history.length) return;
  el("calcHistory").classList.toggle("hidden");
  renderHistory();
}

function renderHistory() {
  const box = el("calcHistory");
  box.innerHTML =
    '<button class="clear-history-btn" onclick="clearHistory()">Clear history</button>';

  history.forEach(item => {
    const row = document.createElement("div");
    row.textContent = `${item.exp} = ${item.res} • ${item.time}`;
    row.onclick = () => {
      expression = item.exp;
      calcTyping.textContent = expression;
      box.classList.add("hidden");
    };
    box.appendChild(row);
  });
}

function clearHistory() {
  history = [];
  localStorage.removeItem("calcHistory");
  el("calcHistory").classList.add("hidden");
}

function copyResult() {
  if (calcResult.textContent) {
    navigator.clipboard.writeText(calcResult.textContent);
  }
}

/* Swipe delete */
let startX = 0;
calcTyping.addEventListener("touchstart", e => startX = e.touches[0].clientX);
calcTyping.addEventListener("touchend", e => {
  if (startX - e.changedTouches[0].clientX > 40) del();
});

/* =========================
   ATTACH FORMATTERS
========================= */

attachCommaFormatter(el("usd"));
attachCommaFormatter(el("simUsd"));
attachCommaFormatter(el("shopPrice"));
