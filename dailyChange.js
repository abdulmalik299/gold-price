// DAILY CHANGE BASELINE – OFFLINE SAFE

const DAILY_KEY = "gold_daily_open_price";
const DAILY_DATE_KEY = "gold_daily_open_date";

function getNYDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function updateDailyBaseline(currentPrice) {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US",{timeZone:"America/New_York"}));
  const today = ny.toISOString().slice(0,10);
  const saved = localStorage.getItem(DAILY_DATE_KEY);

  if (saved !== today && ny.getHours() === 0) {
    localStorage.setItem(DAILY_DATE_KEY, today);
    localStorage.setItem(DAILY_KEY, currentPrice);
  }
}

function calculateDailyChange(currentPrice) {
  const open = parseFloat(localStorage.getItem(DAILY_KEY));
  if (!open) return { percent:0, direction:"same" };

  const diff = currentPrice - open;
  const percent = (diff / open) * 100;

  return {
    percent,
    direction: diff>0 ? "up" : diff<0 ? "down" : "same"
  };
}
