// DAILY BASELINE STORAGE (NY TIME)

const DAILY_KEY = "gold_daily_open_price";
const DAILY_DATE_KEY = "gold_daily_open_date";

// Get NY date string (YYYY-MM-DD)
function getNYDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// Initialize or reset daily baseline
function updateDailyBaseline(currentOuncePrice) {
  const now = new Date();
  const nyTime = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );

  const todayNY = nyTime.toISOString().slice(0, 10);
  const savedDate = localStorage.getItem(DAILY_DATE_KEY);

  // If it's a new NY day AND after 00:00 NY, capture the first price
  if (savedDate !== todayNY && nyTime.getHours() === 0) {
    localStorage.setItem(DAILY_DATE_KEY, todayNY);
    localStorage.setItem(DAILY_KEY, currentOuncePrice);
  }
}

// Calculate daily % change
function calculateDailyChange(currentPrice) {
  const openPrice = parseFloat(localStorage.getItem(DAILY_KEY));
  if (!openPrice) return { percent: 0, direction: "same" };

  const diff = currentPrice - openPrice;
  const percent = (diff / openPrice) * 100;

  return {
    percent: percent,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "same"
  };
}
