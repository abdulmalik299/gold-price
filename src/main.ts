import './styles.css';
import { fetchLiveGoldXAU, priceKaratPerMithqalFromOunce, priceKaratPerGramFromOunce, type Karat, type Unit } from './lib/gold';
import { formatMoney, formatDeltaMoney, formatPct, fmtDateTime, fmtTime, formatNumericStringForInput, toNumberLoose, type Currency } from './lib/format';
import { watchConnection } from './lib/connection';
import { supabase } from './lib/supabase';
import { mountGoldChart } from './lib/chart/chart';
import type { GoldPoint, Timeframe } from './lib/chart/types';
import { mountCalculator } from './lib/calc/ui';

type DeltaState = {
  dir: 'up' | 'down' | 'neutral';
  pct: number;
  amt: number;
};

type KaratRow = {
  karat: Karat;
  elPrice: HTMLElement;
  elDelta: HTMLElement;
  delta: DeltaState;
  unit: Unit;
};

const APP_PUBLISHED_AT = new Date(); // used for defaults in UI

const app = document.querySelector('#app') as HTMLElement;

app.innerHTML = `
  <div class="lux-rail"></div>
  <div class="shell">
    <div class="header">
      <div class="brand">
        <div class="logo">Au</div>
        <div class="t">
          <div class="name">Live Gold Price Chart</div>
          <div class="sub">Luxury dashboard • USD & IQD • Smart margin</div>
        </div>
      </div>

      <div class="head-right">
        <div class="pill" title="Live clock (Asia/Baghdad)">
          <div class="k">Time</div>
          <div class="v" data-clock>--:--:--</div>
        </div>

        <div class="pill" title="Last updated (only changes when price changes)">
          <div class="k">Gold updated</div>
          <div class="v" data-last-update>—</div>
        </div>

        <div class="pill" title="Connection status, ping and download speed">
          <div class="status-dot" data-net-dot></div>
          <div class="signal" data-net-signal>
            <span></span><span></span><span></span><span></span>
          </div>
          <div style="display:flex;flex-direction:column;gap:2px">
            <div style="display:flex;gap:8px;align-items:center">
              <div class="k" data-net-label>offline</div>
              <div class="v" data-net-ms style="font-family:var(--mono)">— ms</div>
            </div>
            <div class="v" data-net-down style="font-family:var(--mono);opacity:.85">— kbps</div>
          </div>
        </div>
      </div>
    </div>

    <div class="main">
      <div class="panel">
        <div class="panel-h">
          <h2>Market</h2>
          <p class="hint">Live XAU ounce with persistent gain/loss.</p>
        </div>
        <div class="panel-b">
          <div class="grid-cards">
            <div class="card">
              <div class="k">Live Gold (XAU)</div>
              <div class="p" data-ounce-price>—</div>
              <div class="d">
                <span class="delta neutral" data-ounce-delta>
                  <span class="arr">—</span>
                  <span class="pct">—</span>
                  <span class="amt">—</span>
                </span>
                <span style="color:rgba(246,243,234,0.55);font-size:12px">per oz</span>
              </div>
            </div>
            <div class="card">
              <div class="k">Ounces tracked</div>
              <div class="p" data-oz-count>1</div>
              <div class="d">
                <span style="opacity:.9">Live: 1 oz</span>
                <span style="opacity:.6">•</span>
                <span style="opacity:.85">History: <span data-history-count>—</span></span>
              </div>
            </div>
          </div>

          <div style="margin-top:14px;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <div class="field" style="flex:1">
              <label>USD to IQD</label>
              <input class="in" inputmode="decimal" placeholder="e.g. 1,500" data-fx />
              <div class="small">Leave empty for USD. Fill to convert *karats only* to IQD.</div>
            </div>

            <div style="min-width: 220px">
              <label>Unit</label>
              <div class="seg" data-unit-seg>
                <button data-unit="mithqal" class="active">Mithqal</button>
                <button data-unit="gram">Gram</button>
              </div>
              <div class="small">Affects karats + expectation only.</div>
            </div>
          </div>

          <div class="karat-list" data-karats></div>

          <div class="slider-wrap">
            <div class="slider-top">
              <div>
                <div class="k" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(246,243,234,.72)">Margin (IQD)</div>
                <div class="p" style="font-family:var(--mono);font-size:16px;margin-top:8px" data-margin>0 IQD</div>
              </div>
              <button class="btn ghost" data-margin-reset>Reset</button>
            </div>
            <input class="range" type="range" min="0" max="70000" step="1000" value="0" data-margin-slider />
            <div class="small">Slider works only when USD→IQD is filled. Value steps by 1,000 (0 → 70,000).</div>
          </div>

          <div class="panel" style="margin-top:16px">
            <div class="panel-h">
              <h2>Expectation</h2>
              <p class="hint">Try a future ounce price and see mithqal/gram results.</p>
            </div>
            <div class="panel-b">
              <div class="form-row">
                <div class="field">
                  <label>Expected ounce (USD)</label>
                  <input class="in" inputmode="decimal" placeholder="e.g. 4,000" data-exp-ounce />
                </div>
                <div class="field">
                  <label>USD to IQD</label>
                  <input class="in" inputmode="decimal" placeholder="e.g. 1,500" data-exp-fx />
                </div>
              </div>

              <div style="margin-top:12px;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
                <div style="min-width:220px">
                  <label>Karat</label>
                  <select class="in" data-exp-karat>
                    <option value="21">21k</option>
                    <option value="22">22k</option>
                    <option value="18">18k</option>
                    <option value="24">24k</option>
                  </select>
                </div>

                <div style="min-width:220px">
                  <label>Unit</label>
                  <select class="in" data-exp-unit>
                    <option value="mithqal">Mithqal (5g)</option>
                    <option value="gram">Gram</option>
                  </select>
                </div>

                <div style="flex:1;min-width:220px">
                  <label>Result</label>
                  <div class="pill" style="border-radius:16px;height:42px">
                    <div class="k">Price</div>
                    <div class="v" style="font-size:13px" data-exp-result>—</div>
                  </div>
                </div>
              </div>

              <div class="slider-wrap" style="margin-top:12px">
                <div class="slider-top">
                  <div>
                    <div class="k" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(246,243,234,.72)">Margin (IQD)</div>
                    <div class="p" style="font-family:var(--mono);font-size:16px;margin-top:8px" data-exp-margin>0 IQD</div>
                  </div>
                  <button class="btn ghost" data-exp-margin-reset>Reset</button>
                </div>
                <input class="range" type="range" min="0" max="70000" step="1000" value="0" data-exp-margin-slider />
                <div class="small">This margin applies only to expectation results (IQD view only).</div>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:16px">
            <div class="panel-h">
              <h2>Tax or Margin Solve</h2>
              <p class="hint">Reverse-calc local margin, then sync the main slider automatically.</p>
            </div>
            <div class="panel-b">
              <div class="form-row">
                <div class="field">
                  <label>Local ounce (USD)</label>
                  <input class="in" inputmode="decimal" placeholder="e.g. 4,000" data-solve-ounce />
                </div>
                <div class="field">
                  <label>USD to IQD</label>
                  <input class="in" inputmode="decimal" placeholder="e.g. 1,500" data-solve-fx />
                </div>
                <div class="field">
                  <label>Local 21k / mithqal (IQD)</label>
                  <input class="in" inputmode="decimal" placeholder="e.g. 450,000" data-solve-21 />
                </div>
              </div>
              <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <div class="pill" style="border-radius:16px;flex:1">
                  <div class="k">Solved margin</div>
                  <div class="v" data-solve-out>—</div>
                </div>
                <button class="btn" data-solve-apply>Apply to main slider</button>
              </div>
              <div class="small" style="margin-top:8px">
                Formula: 21k mithqal = (ounce/31.1035) × 0.875 × 5 × (USD→IQD).
                Then margin = local(21k mithqal) − computed.
              </div>
            </div>
          </div>

          <div class="calc">
            <div class="panel-h" style="padding:0 2px 10px">
              <h2>Advanced Calculator</h2>
              <p class="hint">Samsung-style layout, ÷ symbol, history.</p>
            </div>
            <div class="calc-grid">
              <div class="calc-panel" data-calc>
                <div class="calc-display">
                  <div class="expr" data-calc-expr></div>
                  <div class="res" data-calc-res>0</div>
                </div>
                <div class="calc-keys">
                  <button class="ck ghost" data-calc-key="ac">AC</button>
                  <button class="ck ghost" data-calc-key="del">⌫</button>
                  <button class="ck ghost" data-calc-key="(">(</button>
                  <button class="ck op" data-calc-key=")">)</button>

                  <button class="ck ghost" data-calc-key="sin">sin</button>
                  <button class="ck ghost" data-calc-key="cos">cos</button>
                  <button class="ck ghost" data-calc-key="tan">tan</button>
                  <button class="ck op" data-calc-key="÷">÷</button>

                  <button class="ck ghost" data-calc-key="log">log</button>
                  <button class="ck ghost" data-calc-key="ln">ln</button>
                  <button class="ck ghost" data-calc-key="sqrt">√</button>
                  <button class="ck op" data-calc-key="×">×</button>

                  <button class="ck" data-calc-key="7">7</button>
                  <button class="ck" data-calc-key="8">8</button>
                  <button class="ck" data-calc-key="9">9</button>
                  <button class="ck op" data-calc-key="−">−</button>

                  <button class="ck" data-calc-key="4">4</button>
                  <button class="ck" data-calc-key="5">5</button>
                  <button class="ck" data-calc-key="6">6</button>
                  <button class="ck op" data-calc-key="+">+</button>

                  <button class="ck" data-calc-key="1">1</button>
                  <button class="ck" data-calc-key="2">2</button>
                  <button class="ck" data-calc-key="3">3</button>
                  <button class="ck ghost" data-calc-key="^">xʸ</button>

                  <button class="ck ghost" data-calc-key="sign">±</button>
                  <button class="ck" data-calc-key="0">0</button>
                  <button class="ck" data-calc-key=".">.</button>
                  <button class="ck eq" data-calc-key="=">=</button>
                </div>
              </div>

              <div class="calc-panel">
                <div class="history">
                  <div class="hrow">
                    <div>
                      <div class="k" style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(246,243,234,.70)">History</div>
                      <div class="small">Tap to show/hide equations.</div>
                    </div>
                    <div style="display:flex;gap:10px">
                      <button class="btn ghost" data-calc-toggle>Show</button>
                      <button class="btn ghost" data-calc-clear>Clear</button>
                    </div>
                  </div>
                  <div class="hlist" data-calc-list></div>

                  <div class="notice">
                    Tips: Use keyboard too. Enter = equals. Backspace = delete.  
                    Functions expect degrees for sin/cos/tan.  
                    This calculator is isolated: it never changes any gold inputs.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div class="panel">
        <div class="chart-shell">
          <div class="chart-top">
            <div class="chart-title">
              <div class="big">Gold Price History</div>
              <div class="small" data-chart-live>—</div>
            </div>

            <div class="chart-tools">
              <div class="btns" data-tf>
                <button class="btn ghost active" data-tf-btn="24h">24h</button>
                <button class="btn ghost" data-tf-btn="7d">7 days</button>
                <button class="btn ghost" data-tf-btn="months">Months</button>
                <button class="btn ghost" data-tf-btn="years">Years</button>
              </div>
              <button class="btn" data-refresh>Refresh</button>
            </div>
          </div>

          <div class="chart-box">
            <div id="chart"></div>
            <div class="chart-ywheel" title="Scroll here to zoom price scale"></div>
            <div class="chart-note">Wheel = zoom • Drag = pan • Hover = value</div>
          </div>

          <div class="notice" style="margin-top:10px">
            History is stored in Supabase by a scheduled Edge Function (<span style="font-family:var(--mono)">gold-poller</span>) so you don’t miss changes while offline.
            When the price does not change, nothing is stored.
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="toast" data-toast></div>
`;

const el = <T extends Element>(sel: string) => document.querySelector(sel) as T;

const toastEl = el<HTMLDivElement>('[data-toast]');
const toast = (msg: string) => {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  window.setTimeout(() => toastEl.classList.remove('show'), 1600);
};

// ========= clock =========
const clockEl = el<HTMLElement>('[data-clock]');
function tickClock() {
  // Use user's locale; Baghdad time is user's timezone but browser handles.
  clockEl.textContent = fmtTime(new Date());
}
tickClock();
setInterval(tickClock, 1000);

// ========= connection =========
const dot = el<HTMLElement>('[data-net-dot]');
const sig = el<HTMLElement>('[data-net-signal]');
const msEl = el<HTMLElement>('[data-net-ms]');
const downEl = el<HTMLElement>('[data-net-down]');
const labEl = el<HTMLElement>('[data-net-label]');

watchConnection((s) => {
  dot.classList.toggle('online', s.online);
  labEl.textContent = s.online ? 'online' : 'offline';
  msEl.textContent = s.rttMs != null ? `${s.rttMs} ms` : '— ms';
  downEl.textContent = s.downKbps != null ? `${s.downKbps} kbps` : '— kbps';
  sig.classList.remove('good', 'mid', 'bad');
  sig.classList.add(s.quality);
});

// ========= inputs with comma formatting =========
function wireNumericInput(input: HTMLInputElement, onValue: (n: number | null) => void) {
  const emit = () => onValue(toNumberLoose(input.value));
  input.addEventListener('input', () => {
    const prev = input.value;
    input.value = formatNumericStringForInput(prev);
    emit();
  });
  input.addEventListener('blur', emit);
  emit();
}

function setTfActive(tf: Timeframe) {
  document.querySelectorAll('[data-tf-btn]').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.tfBtn === tf);
  });
}

// ========= state =========
let liveOunceUsd: number | null = null;
let prevOunceUsd: number | null = null;
let lastUpdate: Date | null = null;
let fxUsdToIqd: number | null = null;
let unit: Unit = 'mithqal';
let marginIqd = 0;

const ounceEl = el<HTMLElement>('[data-ounce-price]');
const ounceDeltaEl = el<HTMLElement>('[data-ounce-delta]');
const lastUpdateEl = el<HTMLElement>('[data-last-update]');
const historyCountEl = el<HTMLElement>('[data-history-count]');
const ozCountEl = el<HTMLElement>('[data-oz-count]');

const fxInput = el<HTMLInputElement>('[data-fx]');
const unitSeg = el<HTMLElement>('[data-unit-seg]');
const karatsWrap = el<HTMLElement>('[data-karats]');
const marginEl = el<HTMLElement>('[data-margin]');
const marginSlider = el<HTMLInputElement>('[data-margin-slider]');
const marginResetBtn = el<HTMLButtonElement>('[data-margin-reset]');

const expOunceInput = el<HTMLInputElement>('[data-exp-ounce]');
const expFxInput = el<HTMLInputElement>('[data-exp-fx]');
const expKaratSel = el<HTMLSelectElement>('[data-exp-karat]');
const expUnitSel = el<HTMLSelectElement>('[data-exp-unit]');
const expResultEl = el<HTMLElement>('[data-exp-result]');
const expMarginEl = el<HTMLElement>('[data-exp-margin]');
const expMarginSlider = el<HTMLInputElement>('[data-exp-margin-slider]');
const expMarginResetBtn = el<HTMLButtonElement>('[data-exp-margin-reset]');

const solveOunceInput = el<HTMLInputElement>('[data-solve-ounce]');
const solveFxInput = el<HTMLInputElement>('[data-solve-fx]');
const solve21Input = el<HTMLInputElement>('[data-solve-21]');
const solveOut = el<HTMLElement>('[data-solve-out]');
const solveApply = el<HTMLButtonElement>('[data-solve-apply]');

const refreshBtn = el<HTMLButtonElement>('[data-refresh]');

const calcEl = el<HTMLElement>('[data-calc]');
mountCalculator(calcEl);

// ========= karat rows =========
const karats: Karat[] = [24, 22, 21, 18];
const rows: KaratRow[] = [];

function makeDelta(): DeltaState {
  return { dir: 'neutral', pct: 0, amt: 0 };
}

function renderKaratList() {
  karatsWrap.innerHTML = karats
    .map(
      (k) => `
    <div class="kitem" data-k="${k}">
      <div class="left">
        <div class="k">${k}k</div>
        <div class="u" data-k-unit>${unit === 'mithqal' ? 'per mithqal (5g)' : 'per gram'}</div>
      </div>
      <div class="right">
        <div class="price" data-k-price>—</div>
        <div class="subd">
          <span class="delta neutral" data-k-delta>
            <span class="arr">—</span>
            <span class="pct">—</span>
            <span class="amt">—</span>
          </span>
        </div>
      </div>
    </div>
  `
    )
    .join('');

  rows.length = 0;
  karatsWrap.querySelectorAll<HTMLElement>('[data-k]').forEach((node) => {
    const k = Number(node.dataset.k) as Karat;
    rows.push({
      karat: k,
      elPrice: node.querySelector('[data-k-price]') as HTMLElement,
      elDelta: node.querySelector('[data-k-delta]') as HTMLElement,
      delta: makeDelta(),
      unit,
    });
  });
}

renderKaratList();

// ========= unit toggle =========
unitSeg.querySelectorAll('button').forEach((b) => {
  b.addEventListener('click', () => {
    unitSeg.querySelectorAll('button').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    unit = (b as HTMLElement).dataset.unit as Unit;
    renderKaratList();
    recalcAll();
  });
});

// ========= margin slider =========
function setMarginIqd(v: number) {
  marginIqd = Math.max(0, Math.min(70000, Math.round(v / 1000) * 1000));
  marginSlider.value = String(marginIqd);
  marginEl.textContent = `${marginIqd.toLocaleString()} IQD`;
  recalcAll();
}

marginResetBtn.addEventListener('click', () => setMarginIqd(0));
marginSlider.addEventListener('input', () => setMarginIqd(Number(marginSlider.value)));

function setMarginEnabled(enabled: boolean) {
  marginSlider.disabled = !enabled;
  marginResetBtn.disabled = !enabled;
  marginSlider.style.opacity = enabled ? '1' : '0.45';
}

setMarginEnabled(false);

// ========= wire inputs =========
wireNumericInput(fxInput, (n) => {
  fxUsdToIqd = n;
  setMarginEnabled(!!fxUsdToIqd);
  // If user clears FX, margin stays stored but not applied.
  recalcAll();
});

wireNumericInput(expOunceInput, () => recalcExpectation());
wireNumericInput(expFxInput, () => recalcExpectation());
wireNumericInput(solveOunceInput, () => recalcSolve());
wireNumericInput(solveFxInput, () => recalcSolve());
wireNumericInput(solve21Input, () => recalcSolve());

expKaratSel.addEventListener('change', recalcExpectation);
expUnitSel.addEventListener('change', recalcExpectation);

function setExpMargin(v: number) {
  const m = Math.max(0, Math.min(70000, Math.round(v / 1000) * 1000));
  expMarginSlider.value = String(m);
  expMarginEl.textContent = `${m.toLocaleString()} IQD`;
  recalcExpectation();
}
expMarginResetBtn.addEventListener('click', () => setExpMargin(0));
expMarginSlider.addEventListener('input', () => setExpMargin(Number(expMarginSlider.value)));
setExpMargin(0);

// ========= last update label =========
function setLastUpdate(d: Date | null) {
  lastUpdate = d;
  lastUpdateEl.textContent = d ? fmtDateTime(d) : '—';
}

// ========= calculations =========
function setDeltaBadge(el: HTMLElement, state: DeltaState, currency: Currency) {
  const arr = el.querySelector('.arr') as HTMLElement;
  const pct = el.querySelector('.pct') as HTMLElement;
  const amt = el.querySelector('.amt') as HTMLElement;

  el.classList.remove('up', 'down', 'neutral');
  el.classList.add(state.dir);

  if (state.dir === 'neutral') {
    arr.textContent = '—';
    pct.textContent = '—';
    amt.textContent = '—';
    return;
  }
  arr.textContent = state.dir === 'up' ? '▲' : '▼';
  pct.textContent = formatPct(state.pct);
  amt.textContent = formatDeltaMoney(state.amt, currency);
}

function computeKaratBaseUsd(ounceUsd: number, k: Karat, u: Unit) {
  if (u === 'mithqal') return priceKaratPerMithqalFromOunce(ounceUsd, k);
  return priceKaratPerGramFromOunce(ounceUsd, k);
}

function recalcAll() {
  if (liveOunceUsd == null) return;

  // Ounce always shown in USD and never converted
  ounceEl.textContent = formatMoney(liveOunceUsd, 'USD');

  const ounceDelta: DeltaState = (ounceDeltaEl as any)._deltaState || makeDelta();
  setDeltaBadge(ounceDeltaEl, ounceDelta, fxUsdToIqd ? 'IQD' : 'USD');

  // Karats
  for (const r of rows) {
    const baseUsd = computeKaratBaseUsd(liveOunceUsd, r.karat, unit);
    const showCcy: Currency = fxUsdToIqd ? 'IQD' : 'USD';
    const fx = fxUsdToIqd;

    const price = fx ? baseUsd * fx + marginIqd : baseUsd;
    r.elPrice.textContent = showCcy === 'USD'
      ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${Math.round(price).toLocaleString()} IQD`;

    // delta amounts should ONLY be converted, not recalculated
    const deltaAmt = fx ? r.delta.amt * fx : r.delta.amt;
    const delta: DeltaState = { ...r.delta, amt: deltaAmt };
    setDeltaBadge(r.elDelta, delta, showCcy);

    const unitLabel = (r.elPrice.closest('[data-k]')!.querySelector('[data-k-unit]') as HTMLElement);
    unitLabel.textContent = unit === 'mithqal' ? 'per mithqal (5g)' : 'per gram';
  }

  recalcExpectation();
  recalcSolve();
}

function recalcExpectation() {
  const ounce = toNumberLoose(expOunceInput.value);
  const fx = toNumberLoose(expFxInput.value);
  const karat = Number(expKaratSel.value) as Karat;
  const u = expUnitSel.value as Unit;
  const margin = Number(expMarginSlider.value);

  if (ounce == null) {
    expResultEl.textContent = '—';
    return;
  }

  const baseUsd = computeKaratBaseUsd(ounce, karat, u);

  if (!fx) {
    // USD result
    expResultEl.textContent = `$${baseUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return;
  }
  const iqd = baseUsd * fx + margin;
  expResultEl.textContent = `${Math.round(iqd).toLocaleString()} IQD`;
}

function recalcSolve() {
  const ounce = toNumberLoose(solveOunceInput.value);
  const fx = toNumberLoose(solveFxInput.value);
  const local21 = toNumberLoose(solve21Input.value);

  if (ounce == null || fx == null || local21 == null) {
    solveOut.textContent = '—';
    solveApply.disabled = true;
    return;
  }

  const computed21 = priceKaratPerMithqalFromOunce(ounce, 21) * fx;
  const margin = local21 - computed21;
  const m = Math.round(margin / 1000) * 1000;

  solveOut.textContent = `${m.toLocaleString()} IQD`;
  (solveApply as any)._margin = m;
  solveApply.disabled = false;

  // Requirement: automatically set the main margin slider to the solved value (once the inputs are valid).
  // Only do this if the main FX is already enabled (IQD mode), otherwise we just preview the solved number.
  if (fxUsdToIqd) {
    setMarginIqd(m);
  } else {
    // Move the thumb visually for preview (does not apply margin unless user enables FX).
    marginSlider.value = String(m);
    marginEl.textContent = `${m.toLocaleString()} IQD`;
  }
}

solveApply.addEventListener('click', () => {
  const m = (solveApply as any)._margin as number | undefined;
  if (typeof m === 'number' && Number.isFinite(m)) {
    fxInput.value = fxInput.value || '1,500'; // gentle default if empty
    fxUsdToIqd = toNumberLoose(fxInput.value);
    setMarginEnabled(!!fxUsdToIqd);
    setMarginIqd(m);
    toast('Main margin synced');
  }
});

// ========= live polling / deltas =========
function updateDeltaStates(newOunce: number) {
  if (liveOunceUsd == null) {
    prevOunceUsd = newOunce;
    return;
  }
  prevOunceUsd = liveOunceUsd;
  const diff = newOunce - prevOunceUsd;
  const pct = prevOunceUsd !== 0 ? (diff / prevOunceUsd) * 100 : 0;
  const dir: DeltaState['dir'] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral';
  const ounceState: DeltaState = { dir, pct, amt: diff };
  (ounceDeltaEl as any)._deltaState = ounceState;

  // Karats have different deltas based on their price computations
  for (const r of rows) {
    const prevUsd = computeKaratBaseUsd(prevOunceUsd!, r.karat, unit);
    const nextUsd = computeKaratBaseUsd(newOunce, r.karat, unit);
    const d = nextUsd - prevUsd;
    const p = prevUsd !== 0 ? (d / prevUsd) * 100 : 0;
    r.delta = { dir: d > 0 ? 'up' : d < 0 ? 'down' : 'neutral', pct: p, amt: d };
  }
}

async function pollOnce() {
  const data = await fetchLiveGoldXAU();
  const price = data.price;

  if (liveOunceUsd == null) {
    liveOunceUsd = price;
    updateDeltaStates(price);
    setLastUpdate(new Date(data.updatedAt));
    recalcAll();
    return { changed: true, data };
  }

  if (price !== liveOunceUsd) {
    updateDeltaStates(price);
    liveOunceUsd = price;
    const d = new Date(data.updatedAt);
    setLastUpdate(d);
    recalcAll();
    return { changed: true, data };
  }

  // not changed: keep old delta colors and lastUpdate
  recalcAll();
  return { changed: false, data };
}

async function startLive() {
  try {
    await pollOnce();
  } catch (e) {
    toast('Gold API unavailable (check connection)');
  }
  setInterval(async () => {
    try {
      await pollOnce();
    } catch {}
  }, 5000);
}

// ========= chart (Supabase) =========
const chartEl = el<HTMLElement>('#chart');
const yWheelEl = el<HTMLElement>('.chart-ywheel');
const liveLabel = el<HTMLElement>('[data-chart-live]');

let chartCtrl: ReturnType<typeof mountGoldChart> | null = null;
let timeframe: Timeframe = '24h';

async function loadHistory(tf: Timeframe): Promise<GoldPoint[]> {
  // For performance, limit query size per timeframe.
  // 24h: last 2000 points, 7d: 6000, months: 12000, years: 20000
  const limit = tf === '24h' ? 2000 : tf === '7d' ? 6000 : tf === 'months' ? 12000 : 20000;

  const { data, error } = await supabase
    .from('gold_prices')
    .select('ts, price')
    .order('ts', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const points: GoldPoint[] = (data || []).map((r: any) => ({ ts: r.ts, price: r.price }));
  points.sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  return points;
}

async function initChart() {
  let initial: GoldPoint[] = [];
  try {
    initial = await loadHistory('years');
    historyCountEl.textContent = initial.length.toLocaleString();
  } catch {
    historyCountEl.textContent = '0';
    toast('Supabase history not reachable');
  }

  if (initial.length) {
    const last = initial[initial.length - 1];
    liveLabel.textContent = `${last.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • ${fmtDateTime(new Date(last.ts))}`;
  } else {
    liveLabel.textContent = `Waiting for first tick… (published ${fmtDateTime(APP_PUBLISHED_AT)})`;
  }

  chartCtrl = mountGoldChart({
    el: chartEl,
    yWheelEl,
    toast,
    initial,
    tzOffsetMinutes: -new Date().getTimezoneOffset(),
  });
  chartCtrl.setTimeframe(timeframe);

  ozCountEl.textContent = '1';

  // realtime subscription (new points inserted by edge function)
  supabase
    .channel('gold_prices_live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'gold_prices' },
      (payload) => {
        const row = payload.new as any;
        if (row?.ts && typeof row.price === 'number') {
          chartCtrl?.pushPoint({ ts: row.ts, price: row.price });
          historyCountEl.textContent = (Number(historyCountEl.textContent.replace(/,/g, '')) + 1).toLocaleString();

          // update UI if we have live ounce too
          if (liveOunceUsd != null && row.price !== liveOunceUsd) {
            liveOunceUsd = row.price;
            setLastUpdate(new Date(row.ts));
            recalcAll();
          }
        }
      }
    )
    .subscribe();
}

// timeframe buttons
document.querySelectorAll<HTMLButtonElement>('[data-tf-btn]').forEach((b) => {
  b.addEventListener('click', () => {
    timeframe = b.dataset.tfBtn as Timeframe;
    setTfActive(timeframe);
    chartCtrl?.setTimeframe(timeframe);
  });
});

refreshBtn.addEventListener('click', async () => {
  toast('Refreshing…');
  try {
    const pts = await loadHistory('years');
    historyCountEl.textContent = pts.length.toLocaleString();
    chartCtrl?.destroy();
    chartCtrl = mountGoldChart({
      el: chartEl,
      yWheelEl,
      toast,
      initial: pts,
      tzOffsetMinutes: -new Date().getTimezoneOffset(),
    });
    chartCtrl.setTimeframe(timeframe);
    toast('Done');
  } catch {
    toast('Refresh failed (Supabase offline?)');
  }
});

// ========= PWA SW =========
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {}
}
registerSW();

startLive();
initChart();

// Set initial margin UI
setMarginIqd(0);
setLastUpdate(null);
