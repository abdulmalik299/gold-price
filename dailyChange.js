/* ======================================================
   DAILY CHANGE ENGINE — GOLD ENGINE CORE
   Reset: New York 00:00
   Storage-safe • Offline-safe • Drift-free
   ====================================================== */

let dailyBasePrice = null;
let dailyStamp = null;

/* ---------- NY DAY STAMP ---------- */
function getNYDayStamp() {
  const now = new Date();
  const ny = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  return ny.toISOString().slice(0, 10);
}

/* ---------- LOAD ---------- */
function loadDailyBase() {
  dailyBasePrice = parseFloat(localStorage.getItem("dailyBasePrice"));
  dailyStamp = localStorage.getItem("dailyStamp");
}

/* ---------- SAVE ---------- */
function saveDailyBase(price) {
  dailyBasePrice = price;
  dailyStamp = getNYDayStamp();
  localStorage.setItem("dailyBasePrice", dailyBasePrice);
  localStorage.setItem("dailyStamp", dailyStamp);
}

/* ---------- UPDATE BASE ---------- */
function updateDailyBaseIfNeeded(currentPrice) {
  const today = getNYDayStamp();
  if (dailyStamp !== today || !dailyBasePrice) {
    saveDailyBase(currentPrice);
  }
}

/* ---------- CALCULATE ---------- */
function getDailyChange(currentPrice) {
  if (!dailyBasePrice) return { diff: 0, percent: 0 };

  const diff = currentPrice - dailyBasePrice;
  const percent = (diff / dailyBasePrice) * 100;

  return { diff, percent };
}

/* ---------- INIT ---------- */
loadDailyBase();
