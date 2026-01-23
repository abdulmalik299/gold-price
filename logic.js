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
let last = 0;

const el = id => document.getElementById(id);

function setChange(target, pct, diff) {
  if (diff > 0) {
    target.textContent = `▲ ${pct.toFixed(2)}%`;
    target.style.color = "#0f0";
  } else if (diff < 0) {
    target.textContent = `▼ ${pct.toFixed(2)}%`;
    target.style.color = "#f00";
  }
}

function updateConnection(force=false) {
  if (!navigator.onLine || force) {
    el("status").textContent = "🔴 نیشانە نیە";
    el("status").className = "status offline";
  } else {
    el("status").textContent = "🟢 نیشانە هەیە";
    el("status").className = "status online";
  }
}

window.addEventListener("online", ()=>updateConnection(false));
window.addEventListener("offline", ()=>updateConnection(true));

async function update() {
  try {
    if (!navigator.onLine) throw "offline";

    let o = (await (await fetch("https://api.gold-api.com/price/XAU",{cache:"no-store"})).json()).price;
    let currentNYDate = getNYDate();

    if (nyDateStored !== currentNYDate || !nyBaseline) {
      nyDateStored = currentNYDate;
      nyBaseline = o;
      localStorage.setItem("nyDate", nyDateStored);
      localStorage.setItem("nyBaseline", nyBaseline);
    }

    let diff = o - nyBaseline;
    let pct = nyBaseline ? (diff / nyBaseline) * 100 : 0;


    let g21 = (o / 31.1) * 0.875 * 5;
    let margin = +el("margin").value;
    let market21 = g21 * (1 + margin / 100);

    el("ounce").textContent = `$${o.toFixed(2)}`;
    el("global21").textContent = `$${g21.toFixed(2)}`;
    el("market21").textContent = `$${market21.toFixed(2)}`;
    el("cbi21").textContent = (g21 * 1320).toLocaleString() + " IQD";

    let usd = +el("usd").value || 0;
    el("iqdNoMargin").textContent = (g21 * usd).toLocaleString() + " IQD";
    el("iqdMargin").textContent = (market21 * usd).toLocaleString() + " IQD";

    ["chgOunce","chg21","chgMarket","chgCbi","chgIQD","chgIQDM"]
      .forEach(id=>setChange(el(id),pct,diff));

    el("time").textContent = "نوێکردنەوە: " + new Date().toLocaleTimeString();

    updateConnection(false);
    last = o;

  } catch {
    updateConnection(true);
  }
}

el("margin").oninput = () => el("mval").textContent = el("margin").value + "%";

setInterval(update,1000);
update();

/* Calculator */
function toggleCalc(){ el("calc").classList.toggle("hidden"); }
function c(v){ calcInput.value+=v; }
function calc(){ try{ calcInput.value=eval(calcInput.value);}catch{ calcInput.value="Error"; } }
function clr(){ calcInput.value=""; }
