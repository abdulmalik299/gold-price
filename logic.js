/* Luxury Gold Dashboard — production-ready vanilla JS
   - Live XAU ounce price with direction persistence
   - Mithqal karat calculations + IQD conversion + margin
   - Expectation calculator
   - Find Margin (auto-set live slider)
   - Samsung-like calculator with history (localStorage)
   - Advanced chart w/ seeded JSON + localStorage persistence + Worker smoothing
*/

(() => {
  'use strict';

  // ---------- Constants ----------
  const API_URL = 'https://api.gold-api.com/price/XAU';
  const OUNCE_GRAMS = 31.1035;
  const MITHQAL_GRAMS = 5;

  const KARATS = {
    24: { factor: 1.0, label: '24k' },
    22: { factor: 0.916, label: '22k' },
    21: { factor: 0.875, label: '21k' },
    18: { factor: 0.75, label: '18k' },
  };

  const BAGHDAD_TZ = 'Asia/Baghdad';
  const NOISE_MIN_USD = 0.10;

  const LS = {
    chartPoints: 'lux_gold_chart_points_v1',
    calcHistory: 'lux_gold_calc_history_v1',
    calcState: 'lux_gold_calc_state_v1',
  };

  // ---------- DOM ----------
  const el = {
    connectionPill: document.getElementById('connectionPill'),
    connectionDot: document.getElementById('connectionDot'),
    connectionText: document.getElementById('connectionText'),
    lastUpdated: document.getElementById('lastUpdated'),

    liveOuncePrice: document.getElementById('liveOuncePrice'),
    liveArrow: document.getElementById('liveArrow'),
    liveChangeAmount: document.getElementById('liveChangeAmount'),
    livePct: document.getElementById('livePct'),
    liveDeltaWrap: document.getElementById('liveDelta'),

    usdToIqd: document.getElementById('usdToIqd'),
    marginSlider: document.getElementById('marginSlider'),
    marginValue: document.getElementById('marginValue'),
    marginHint: document.getElementById('marginHint'),

    karatGrid: document.getElementById('karatGrid'),
    liveKaratSelect: document.getElementById('liveKaratSelect'),
    liveUnitSelect: document.getElementById('liveUnitSelect'),
    liveSelectedPrice: document.getElementById('liveSelectedPrice'),

    expOunce: document.getElementById('expOunce'),
    expUsdToIqd: document.getElementById('expUsdToIqd'),
    expMarginSlider: document.getElementById('expMarginSlider'),
    expMarginValue: document.getElementById('expMarginValue'),
    expMarginHint: document.getElementById('expMarginHint'),
    expKaratSelect: document.getElementById('expKaratSelect'),
    expUnitSelect: document.getElementById('expUnitSelect'),
    expResult: document.getElementById('expResult'),

    fmKaratSelect: document.getElementById('fmKaratSelect'),
    fmLocalPrice: document.getElementById('fmLocalPrice'),
    fmTaxes: document.getElementById('fmTaxes'),
    fmHint: document.getElementById('fmHint'),

    forceRefreshBtn: document.getElementById('forceRefreshBtn'),

    // Chart
    chartCanvas: document.getElementById('priceChart'),
    pointsCount: document.getElementById('pointsCount'),
    tfButtons: Array.from(document.querySelectorAll('.timeframe .seg')),

    // Calculator
    calcExpression: document.getElementById('calcExpression'),
    calcResult: document.getElementById('calcResult'),
    calcKeys: document.getElementById('calcKeys'),
    calcHistory: document.getElementById('calcHistory'),
    historyList: document.getElementById('historyList'),
    toggleHistoryBtn: document.getElementById('toggleHistoryBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  };

  // ---------- Utilities ----------
  function fmtNumber(n, decimals = 2) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function fmtInt(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return Math.round(num).toLocaleString('en-US');
  }

  function toBaghdadTimestamp(ms = Date.now()) {
    // Format: YYYY-MM-DD HH:MM:SS
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BAGHDAD_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(ms));

    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
  }

  function parseNumericInput(value) {
    if (value == null) return null;
    const v = String(value).trim();
    if (!v) return null;
    const num = Number(v);
    return Number.isFinite(num) ? num : null;
  }

  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }

  function roundToStep(value, step) {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value / step) * step;
  }

  function setInputNumeric(elm) {
    // Allow digits + one dot; block other characters
    elm.addEventListener('beforeinput', (e) => {
      if (e.inputType === 'insertText' && e.data != null) {
        const char = e.data;
        if (!/[0-9.]/.test(char)) e.preventDefault();
        if (char === '.' && elm.value.includes('.')) e.preventDefault();
      }
    });

    elm.addEventListener('input', () => {
      // Clean any pasted content
      const cleaned = elm.value
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*)\./g, '$1'); // keep only first dot
      if (elm.value !== cleaned) elm.value = cleaned;
    });
  }

  function setPillOnline(isOnline) {
    el.connectionText.textContent = isOnline ? 'Online' : 'Offline';
    el.connectionDot.style.background = isOnline ? 'var(--green)' : 'var(--red)';
    el.connectionDot.style.boxShadow = isOnline
      ? '0 0 0 4px rgba(38,208,124,.14)'
      : '0 0 0 4px rgba(255,77,109,.14)';
  }

  function setDirectional(elAmount, elPct, elArrow, delta, pct, lastDirRef) {
    // lastDirRef is object with .dir = 'up'|'down'|null
    if (!Number.isFinite(delta) || !Number.isFinite(pct)) {
      // Keep previous color/direction; do not reset during operation
      elAmount.textContent = '—';
      elPct.textContent = '—';
      if (!lastDirRef.dir) elArrow.textContent = '—';
      return;
    }

    if (delta > 0) lastDirRef.dir = 'up';
    else if (delta < 0) lastDirRef.dir = 'down';
    // If delta == 0, keep prior direction.

    const dir = lastDirRef.dir;
    const clsUp = dir === 'up';
    const clsDown = dir === 'down';

    elArrow.textContent = clsUp ? '▲' : clsDown ? '▼' : '—';
    elAmount.textContent = `${fmtNumber(Math.abs(delta), 2)}`;
    elPct.textContent = `${fmtNumber(Math.abs(pct), 2)}%`;

    elAmount.classList.toggle('up', clsUp);
    elAmount.classList.toggle('down', clsDown);
    elPct.classList.toggle('up', clsUp);
    elPct.classList.toggle('down', clsDown);
    elArrow.classList.toggle('up', clsUp);
    elArrow.classList.toggle('down', clsDown);
  }

  // ---------- Calculations ----------
  function pricePerMithqalFromOunce(ounceUSD, karatFactor, usdToIqdOr1) {
    return (ounceUSD / OUNCE_GRAMS) * karatFactor * MITHQAL_GRAMS * usdToIqdOr1;
  }

  function applyMargin(value, margin) {
    return Number.isFinite(value) ? (value + margin) : value;
  }

  function unitConvert(mithqalValue, unit) {
    if (!Number.isFinite(mithqalValue)) return null;
    if (unit === 'gram') return mithqalValue / MITHQAL_GRAMS;
    return mithqalValue;
  }

  // ---------- State ----------
  const state = {
    isOnline: navigator.onLine,
    live: {
      ounce: null,
      prevOunce: null,
      lastDir: { dir: null },
      lastUpdatedMs: null,
      // per karat previous values (computed on live changes)
      prevKarat: { 24: null, 22: null, 21: null, 18: null },
      lastKaratDir: {
        24: { dir: null },
        22: { dir: null },
        21: { dir: null },
        18: { dir: null },
      },
    },
    ui: {
      currentTF: '24H',
    },
    chart: {
      points: [], // {t:number(ms), p:number}
      worker: null,
      chart: null,
      lastSavedPrice: null,
    },
    calc: {
      expr: '',
      res: '0',
      history: [],
      showHistory: false,
    }
  };

  // ---------- Build Karat Cards ----------
  function buildKaratCards() {
    const order = [24, 22, 21, 18];
    el.karatGrid.innerHTML = '';
    for (const k of order) {
      const card = document.createElement('div');
      card.className = 'karat';
      card.dataset.karat = String(k);
      card.innerHTML = `
        <div class="k-title">
          <span>${KARATS[k].label}</span>
          <span class="k-tag dim">per mithqal</span>
        </div>
        <div class="k-value" id="kValue_${k}">—</div>
        <div class="k-change">
          <div class="k-delta" id="kDelta_${k}">—</div>
          <div class="k-pct" id="kPct_${k}">—</div>
        </div>
      `;
      el.karatGrid.appendChild(card);
    }
  }

  // ---------- Live Rendering ----------
  function currencyMode() {
    const usdToIqd = parseNumericInput(el.usdToIqd.value);
    if (usdToIqd && usdToIqd > 0) return { mode: 'IQD', rate: usdToIqd };
    return { mode: 'USD', rate: 1 };
  }

  function renderMarginUI() {
    const { mode } = currencyMode();
    const enabled = mode === 'IQD';
    el.marginSlider.disabled = !enabled;
    el.marginHint.textContent = enabled ? 'Margin is applied per mithqal (IQD only).' : 'Enable IQD conversion to apply margin.';
    el.marginValue.textContent = `${fmtInt(el.marginSlider.value)} IQD`;
    el.marginValue.style.opacity = enabled ? '1' : '.6';
  }

  function renderLiveHeader() {
    const ounce = state.live.ounce;
    if (!Number.isFinite(ounce)) {
      el.liveOuncePrice.textContent = '$—';
      return;
    }
    el.liveOuncePrice.textContent = `$${fmtNumber(ounce, 2)}`;
  }

  function renderLiveChange() {
    const prev = state.live.prevOunce;
    const cur = state.live.ounce;
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) {
      // no comparison yet
      setDirectional(el.liveChangeAmount, el.livePct, el.liveArrow, NaN, NaN, state.live.lastDir);
      return;
    }
    const delta = cur - prev;
    const pct = (delta / prev) * 100;
    setDirectional(el.liveChangeAmount, el.livePct, el.liveArrow, delta, pct, state.live.lastDir);
  }

  function formatMoney(value, mode) {
    if (!Number.isFinite(value)) return '—';
    if (mode === 'IQD') return `${fmtInt(value)} IQD`;
    // USD
    return `$${fmtNumber(value, 2)}`;
  }

  function computeLiveKaratBase(karat) {
    const ounce = state.live.ounce;
    if (!Number.isFinite(ounce)) return null;
    const { rate, mode } = currencyMode();
    const base = pricePerMithqalFromOunce(ounce, KARATS[karat].factor, rate);
    if (!Number.isFinite(base)) return null;
    return { base, mode };
  }

  function renderKaratCards() {
    const { mode } = currencyMode();
    const margin = mode === 'IQD' ? parseInt(el.marginSlider.value, 10) : 0;

    for (const kStr of Object.keys(KARATS)) {
      const k = Number(kStr);
      const valueEl = document.getElementById(`kValue_${k}`);
      const deltaEl = document.getElementById(`kDelta_${k}`);
      const pctEl = document.getElementById(`kPct_${k}`);

      const computed = computeLiveKaratBase(k);
      if (!computed) {
        valueEl.textContent = '—';
        deltaEl.textContent = '—';
        pctEl.textContent = '—';
        continue;
      }

      const base = computed.base;
      const finalValue = (mode === 'IQD') ? applyMargin(base, margin) : base;

      valueEl.textContent = formatMoney(finalValue, mode);

      // Change indicators based on previous base values (derived from live price movement only)
      const prevBase = state.live.prevKarat[k];
      if (!Number.isFinite(prevBase) || prevBase === 0) {
        deltaEl.textContent = '—';
        pctEl.textContent = '—';
      } else {
        const delta = base - prevBase;
        const pct = (delta / prevBase) * 100;
        const dirRef = state.live.lastKaratDir[k];
        // For per-karat: show amount and percent; amount differs by factor
        // Persist direction if delta == 0
        if (delta > 0) dirRef.dir = 'up';
        else if (delta < 0) dirRef.dir = 'down';

        const dir = dirRef.dir;
        deltaEl.textContent = `${dir === 'down' ? '▼' : dir === 'up' ? '▲' : '—'} ${fmtNumber(Math.abs(delta) * (mode === 'IQD' ? 1 : 1), mode === 'IQD' ? 0 : 2)}${mode === 'IQD' ? ' IQD' : ''}`;
        pctEl.textContent = `${fmtNumber(Math.abs(pct), 2)}%`;

        deltaEl.classList.toggle('up', dir === 'up');
        deltaEl.classList.toggle('down', dir === 'down');
        pctEl.classList.toggle('up', dir === 'up');
        pctEl.classList.toggle('down', dir === 'down');
      }
    }
  }

  function renderLiveSelected() {
    const karat = Number(el.liveKaratSelect.value);
    const unit = el.liveUnitSelect.value;
    const { mode } = currencyMode();
    const margin = mode === 'IQD' ? parseInt(el.marginSlider.value, 10) : 0;

    const computed = computeLiveKaratBase(karat);
    if (!computed) {
      el.liveSelectedPrice.textContent = '—';
      return;
    }
    let v = computed.base;
    if (mode === 'IQD') v = applyMargin(v, margin);

    const converted = unitConvert(v, unit);
    if (!Number.isFinite(converted)) {
      el.liveSelectedPrice.textContent = '—';
      return;
    }

    if (mode === 'IQD') {
      el.liveSelectedPrice.textContent = `${fmtInt(converted)} IQD`;
    } else {
      el.liveSelectedPrice.textContent = `$${fmtNumber(converted, 2)}`;
    }
  }

  function updateAllLiveUI() {
    renderMarginUI();
    renderLiveHeader();
    renderLiveChange();
    renderKaratCards();
    renderLiveSelected();
    updateFindMarginUI();
  }

  // ---------- Expectation ----------
  function expectationMode() {
    const rate = parseNumericInput(el.expUsdToIqd.value);
    return (rate && rate > 0) ? { mode: 'IQD', rate } : { mode: 'USD', rate: 1 };
  }

  function renderExpectation() {
    const ounce = parseNumericInput(el.expOunce.value);
    const karat = Number(el.expKaratSelect.value);
    const unit = el.expUnitSelect.value;
    const { mode, rate } = expectationMode();

    const enabled = mode === 'IQD';
    el.expMarginSlider.disabled = !enabled;
    el.expMarginHint.textContent = enabled ? 'Margin is applied per mithqal (IQD only).' : 'Fill USD→IQD to enable margin.';
    el.expMarginValue.textContent = `${fmtInt(el.expMarginSlider.value)} IQD`;
    el.expMarginValue.style.opacity = enabled ? '1' : '.6';

    if (!Number.isFinite(ounce) || ounce <= 0) {
      el.expResult.textContent = '—';
      return;
    }

    let base = pricePerMithqalFromOunce(ounce, KARATS[karat].factor, rate);
    if (!Number.isFinite(base)) {
      el.expResult.textContent = '—';
      return;
    }

    if (mode === 'IQD') base = applyMargin(base, parseInt(el.expMarginSlider.value, 10));
    const converted = unitConvert(base, unit);

    el.expResult.textContent = (mode === 'IQD')
      ? `${fmtInt(converted)} IQD`
      : `$${fmtNumber(converted, 2)}`;
  }

  // ---------- Find Margin (Taxes) ----------
  function updateFindMarginUI() {
    const { mode } = currencyMode();
    const rate = parseNumericInput(el.usdToIqd.value);
    const local = parseNumericInput(el.fmLocalPrice.value);
    const karat = Number(el.fmKaratSelect.value);

    if (mode !== 'IQD' || !rate) {
      el.fmTaxes.textContent = '—';
      el.fmHint.textContent = 'Requires USD→IQD input in Live section (IQD mode).';
      return;
    }

    el.fmHint.textContent = 'Enter your local price per mithqal to estimate margin.';

    const computed = computeLiveKaratBase(karat); // base in IQD (no margin) because rate is used
    if (!computed || !Number.isFinite(computed.base) || !Number.isFinite(local)) {
      el.fmTaxes.textContent = '—';
      return;
    }

    // Intent: local market price = base + taxes; estimate taxes = local - base
    const taxes = local - computed.base;
    const shown = Number.isFinite(taxes) ? taxes : NaN;

    el.fmTaxes.textContent = `${fmtInt(shown)} IQD`;

    // Auto-set live margin slider: clamp 0..70000 and nearest 1000
    const rounded = roundToStep(clamp(shown, 0, 70000), 1000);
    if (Number.isFinite(rounded)) {
      el.marginSlider.value = String(rounded);
      renderMarginUI(); // updates label immediately
    }
  }

  // ---------- Live Fetch / Polling ----------
  let pollTimer = null;
  let nextDelayMs = 1000;

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function scheduleNextPoll(delayMs) {
    stopPolling();
    pollTimer = setTimeout(pollOnce, delayMs);
  }

  async function fetchWithTimeout(url, timeoutMs = 6000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  function extractPrice(payload) {
    // gold-api responses can vary; attempt common keys
    const candidates = ['price', 'value', 'rate', 'xau', 'usd'];
    for (const k of candidates) {
      if (payload && typeof payload[k] === 'number') return payload[k];
      if (payload && typeof payload[k] === 'string' && payload[k].trim()) {
        const n = Number(payload[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    // sometimes nested
    if (payload && payload.data) return extractPrice(payload.data);
    return null;
  }

  function onNewLivePrice(price) {
    const prev = state.live.ounce;
    // Update only when changed
    if (Number.isFinite(prev) && Number.isFinite(price) && price === prev) {
      updateAllLiveUI(); // still refresh derived UI from inputs instantly
      return;
    }

    state.live.prevOunce = prev;
    state.live.ounce = price;
    state.live.lastUpdatedMs = Date.now();

    // update per-karat previous base values based on last base computation (no margin)
    for (const kStr of Object.keys(KARATS)) {
      const k = Number(kStr);
      const computedPrev = (Number.isFinite(prev))
        ? pricePerMithqalFromOunce(prev, KARATS[k].factor, currencyMode().rate)
        : null;

      // For prevKarat, we store base based on previous live price and current rate (user input)
      // However, change indicators must be connected ONLY to live price movement, not inputs.
      // To ensure that, we store prev base values using rate=1 always (USD base), and compare USD bases.
      // Then display amount in current mode by scaling if needed.
      // We'll store USD base in state and compute delta in USD base.
    }
  }

  // We'll keep USD-base previous values for change to isolate from user input changes
  function updatePrevKaratUSDBase(prevOunceUSD) {
    for (const kStr of Object.keys(KARATS)) {
      const k = Number(kStr);
      state.live.prevKarat[k] = Number.isFinite(prevOunceUSD)
        ? pricePerMithqalFromOunce(prevOunceUSD, KARATS[k].factor, 1)
        : null;
    }
  }

  function computeCurrentKaratUSDBase(karat) {
    const ounce = state.live.ounce;
    if (!Number.isFinite(ounce)) return null;
    return pricePerMithqalFromOunce(ounce, KARATS[karat].factor, 1);
  }

  // Override renderKaratCards to use USD-base for deltas, but display amount in selected currency
  function renderKaratCards() {
    const { mode, rate } = currencyMode();
    const margin = mode === 'IQD' ? parseInt(el.marginSlider.value, 10) : 0;

    for (const kStr of Object.keys(KARATS)) {
      const k = Number(kStr);
      const valueEl = document.getElementById(`kValue_${k}`);
      const deltaEl = document.getElementById(`kDelta_${k}`);
      const pctEl = document.getElementById(`kPct_${k}`);

      const ounce = state.live.ounce;
      if (!Number.isFinite(ounce)) {
        valueEl.textContent = '—';
        deltaEl.textContent = '—';
        pctEl.textContent = '—';
        continue;
      }

      // Current base in display currency (rate applied)
      const baseDisplay = pricePerMithqalFromOunce(ounce, KARATS[k].factor, rate);
      const finalValue = (mode === 'IQD') ? applyMargin(baseDisplay, margin) : baseDisplay;
      valueEl.textContent = formatMoney(finalValue, mode);

      // Deltas based on USD-base, to avoid slider/input affecting indicators
      const prevUSD = state.live.prevKarat[k];
      const curUSD = computeCurrentKaratUSDBase(k);

      if (!Number.isFinite(prevUSD) || !Number.isFinite(curUSD) || prevUSD === 0) {
        deltaEl.textContent = '—';
        pctEl.textContent = '—';
        continue;
      }

      const deltaUSD = curUSD - prevUSD;
      const pct = (deltaUSD / prevUSD) * 100;

      const dirRef = state.live.lastKaratDir[k];
      if (deltaUSD > 0) dirRef.dir = 'up';
      else if (deltaUSD < 0) dirRef.dir = 'down';

      const dir = dirRef.dir;
      const arrow = dir === 'down' ? '▼' : dir === 'up' ? '▲' : '—';

      // Show amount in the same currency mode as the displayed card (without margin impact)
      const deltaShown = (mode === 'IQD') ? (Math.abs(deltaUSD) * rate) : Math.abs(deltaUSD);
      const deltaText = (mode === 'IQD')
        ? `${arrow} ${fmtInt(deltaShown)} IQD`
        : `${arrow} ${fmtNumber(deltaShown, 2)}`;

      deltaEl.textContent = deltaText;
      pctEl.textContent = `${fmtNumber(Math.abs(pct), 2)}%`;

      deltaEl.classList.toggle('up', dir === 'up');
      deltaEl.classList.toggle('down', dir === 'down');
      pctEl.classList.toggle('up', dir === 'up');
      pctEl.classList.toggle('down', dir === 'down');
    }
  }

  async function pollOnce() {
    if (!navigator.onLine) {
      state.isOnline = false;
      setPillOnline(false);
      scheduleNextPoll(2000);
      return;
    }

    state.isOnline = true;
    setPillOnline(true);

    try {
      const payload = await fetchWithTimeout(API_URL, 6500);
      const price = extractPrice(payload);
      if (!Number.isFinite(price)) throw new Error('Unrecognized API response');

      // Update change refs
      const prev = state.live.ounce;
      if (Number.isFinite(prev) && price !== prev) {
        updatePrevKaratUSDBase(prev);
      } else if (!Number.isFinite(prev)) {
        // First tick: no prev deltas
        updatePrevKaratUSDBase(null);
      }

      state.live.prevOunce = prev;
      state.live.ounce = price;

      // Only update timestamp when price changes
      if (!Number.isFinite(prev) || price !== prev) {
        state.live.lastUpdatedMs = Date.now();
        el.lastUpdated.textContent = toBaghdadTimestamp(state.live.lastUpdatedMs);
        // Add chart point (noise filtered)
        maybeSaveChartPoint(price, state.live.lastUpdatedMs);
      }

      // Reset delay after success
      nextDelayMs = 1000;

      updateAllLiveUI();
      scheduleNextPoll(1000);
    } catch (err) {
      // Backoff
      nextDelayMs = Math.min(30000, Math.round(nextDelayMs * 1.6));
      scheduleNextPoll(nextDelayMs);
      // Keep UI stable; do not reset indicators.
      updateAllLiveUI();
    }
  }

  // ---------- Chart Persistence + Worker ----------
  function loadSeedChartHistory() {
    // Seed from JSON file, then merge with localStorage points.
    return fetch('./chart-history.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(seed => Array.isArray(seed) ? seed : [])
      .catch(() => []);
  }

  function loadLocalChartHistory() {
    try {
      const raw = localStorage.getItem(LS.chartPoints);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLocalChartHistory(points) {
    try {
      localStorage.setItem(LS.chartPoints, JSON.stringify(points));
    } catch {
      // ignore
    }
  }

  function normalizePoints(points) {
    // Keep valid and sorted, unique by timestamp
    const map = new Map();
    for (const p of points) {
      if (!p) continue;
      const t = Number(p.t ?? p.time ?? p.timestamp);
      const price = Number(p.p ?? p.price ?? p.value);
      if (!Number.isFinite(t) || !Number.isFinite(price)) continue;
      map.set(t, { t, p: price });
    }
    return Array.from(map.values()).sort((a,b) => a.t - b.t);
  }

  function maybeSaveChartPoint(price, timeMs) {
    // Noise reduction: only save if delta >= $0.10 vs last saved point
    const last = state.chart.lastSavedPrice;
    if (Number.isFinite(last) && Math.abs(price - last) < NOISE_MIN_USD) return;

    state.chart.lastSavedPrice = price;
    state.chart.points.push({ t: timeMs, p: price });

    // Trim to max ~ 7 days in storage (to keep it fast)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = timeMs - sevenDaysMs;
    state.chart.points = state.chart.points.filter(pt => pt.t >= cutoff);

    saveLocalChartHistory(state.chart.points);
    requestChartRender(); // render only when saved
  }

  function initWorker() {
    state.chart.worker = new Worker('./worker.js');
    state.chart.worker.addEventListener('message', (e) => {
      const { ok, tf, labels, values } = e.data || {};
      if (!ok) return;
      if (tf !== state.ui.currentTF) return;

      // Update chart dataset
      if (state.chart.chart) {
        state.chart.chart.data.labels = labels;
        state.chart.chart.data.datasets[0].data = values;
        state.chart.chart.update('none');
      }

      el.pointsCount.textContent = fmtInt(values.length);
    });
  }

  function requestChartRender() {
    if (!state.chart.worker) return;
    const tf = state.ui.currentTF;
    const payload = { type: 'process', tf, points: state.chart.points };
    state.chart.worker.postMessage(payload);
  }

  function initChart() {
    const ctx = el.chartCanvas.getContext('2d');

    // Crosshair-like plugin: draw vertical line at active tooltip index
    const crosshairPlugin = {
      id: 'luxCrosshair',
      afterDraw(chart) {
        const tooltip = chart.tooltip;
        if (!tooltip || !tooltip.getActiveElements || tooltip.getActiveElements().length === 0) return;
        const { ctx, chartArea: { top, bottom } } = chart;
        const active = tooltip.getActiveElements()[0];
        const x = active.element.x;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(214,178,94,.28)';
        ctx.stroke();
        ctx.restore();
      }
    };

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'XAU (USD/oz)',
          data: [],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
          segment: {
            borderColor: (ctx) => {
              const y0 = ctx.p0.parsed.y;
              const y1 = ctx.p1.parsed.y;
              if (!Number.isFinite(y0) || !Number.isFinite(y1)) return 'rgba(214,178,94,.55)';
              return (y1 >= y0) ? 'rgba(38,208,124,.9)' : 'rgba(255,77,109,.9)';
            }
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, labels: { color: '#e9e9ef', boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` $${fmtNumber(ctx.parsed.y, 2)}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: 'rgba(233,233,239,.75)', maxRotation: 0, autoSkip: true },
            grid: { color: 'rgba(255,255,255,.06)' }
          },
          y: {
            ticks: {
              color: 'rgba(233,233,239,.75)',
              callback: (v) => `$${fmtNumber(v, 0)}`
            },
            grid: { color: 'rgba(255,255,255,.06)' }
          }
        }
      },
      plugins: [crosshairPlugin]
    });

    state.chart.chart = chart;
  }

  // ---------- Timeframe Buttons ----------
  function setActiveTF(tf) {
    state.ui.currentTF = tf;
    el.tfButtons.forEach(b => b.classList.toggle('active', b.dataset.tf === tf));
    requestChartRender();
  }

  // ---------- Calculator ----------
  const CALC_KEYS = [
    { t: 'C', a: 'clear', cls: 'danger' },
    { t: '⌫', a: 'back' },
    { t: '(', a: '(' , cls: 'op' },
    { t: ')', a: ')' , cls: 'op' },
    { t: '7', a: '7' },
    { t: '8', a: '8' },
    { t: '9', a: '9' },
    { t: '÷', a: '÷', cls: 'op' },
    { t: '4', a: '4' },
    { t: '5', a: '5' },
    { t: '6', a: '6' },
    { t: '×', a: '×', cls: 'op' },
    { t: '1', a: '1' },
    { t: '2', a: '2' },
    { t: '3', a: '3' },
    { t: '−', a: '−', cls: 'op' },
    { t: '0', a: '0', wide: true },
    { t: '.', a: '.' },
    { t: '%', a: '%', cls: 'op' },
    { t: '=', a: 'eq', cls: 'equal' },
    { t: '+', a: '+', cls: 'op' },
  ];

  function loadCalcHistory() {
    try {
      const raw = localStorage.getItem(LS.calcHistory);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }

  function saveCalcHistory() {
    try {
      localStorage.setItem(LS.calcHistory, JSON.stringify(state.calc.history.slice(0, 100)));
    } catch {}
  }

  function saveCalcState() {
    try {
      localStorage.setItem(LS.calcState, JSON.stringify({ expr: state.calc.expr, res: state.calc.res, show: state.calc.showHistory }));
    } catch {}
  }

  function loadCalcState() {
    try {
      const raw = localStorage.getItem(LS.calcState);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj.expr === 'string') state.calc.expr = obj.expr;
      if (obj && typeof obj.res === 'string') state.calc.res = obj.res;
      if (obj && typeof obj.show === 'boolean') state.calc.showHistory = obj.show;
    } catch {}
  }

  function buildCalcKeys() {
    el.calcKeys.innerHTML = '';
    for (const k of CALC_KEYS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `key ${k.cls || ''} ${k.wide ? 'wide' : ''}`.trim();
      btn.textContent = k.t;
      btn.dataset.action = k.a;
      el.calcKeys.appendChild(btn);
    }
  }

  function renderCalc() {
    el.calcExpression.textContent = state.calc.expr || ' ';
    el.calcResult.textContent = state.calc.res || '0';
    el.calcHistory.classList.toggle('show', state.calc.showHistory);
    saveCalcState();
  }

  function renderHistory() {
    el.historyList.innerHTML = '';
    const items = state.calc.history.slice(0, 50);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dim';
      empty.style.padding = '8px';
      empty.textContent = 'No history yet.';
      el.historyList.appendChild(empty);
      return;
    }

    for (const h of items) {
      const div = document.createElement('div');
      div.className = 'h-item';
      div.innerHTML = `<div class="h-exp">${escapeHtml(h.expr)}</div><div class="h-res">${escapeHtml(h.res)}</div>`;
      div.addEventListener('click', () => {
        state.calc.expr = h.res; // pick result for new calc
        state.calc.res = h.res;
        renderCalc();
      });
      el.historyList.appendChild(div);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function normalizeExprForEval(expr) {
    // Replace symbols with JS operators, handle % as (x/100) when trailing, and modulo for between numbers not supported.
    // We'll implement % as percentage operator like Samsung: "50%" => 0.5; "200+10%" => 220 (10% of 200).
    // This is complex, but we can approximate:
    // - Convert "number%" to "(number/100)"
    // - For "A + B%" or "A − B%": treat B% as percentage of A
    // - For "A × B%" or "A ÷ B%": treat B% as B/100
    // We'll do a safe parse by tokenization.
    const tokens = tokenize(expr);
    const rebuilt = applyPercentRules(tokens);
    return rebuilt
      .join('')
      .replace(/×/g,'*')
      .replace(/÷/g,'/')
      .replace(/−/g,'-');
  }

  function tokenize(expr) {
    const s = expr.replace(/\s+/g, '');
    const out = [];
    let num = '';
    const pushNum = () => { if (num) { out.push(num); num=''; } };
    for (let i=0;i<s.length;i++){
      const ch = s[i];
      if (/[0-9.]/.test(ch)) {
        num += ch;
        continue;
      }
      pushNum();
      if ('()+−×÷%'.includes(ch)) out.push(ch);
    }
    pushNum();
    return out;
  }

  function applyPercentRules(tokens) {
    // pass1: convert bare "N %" into "(N/100)"
    const t = [];
    for (let i=0;i<tokens.length;i++){
      const cur = tokens[i];
      const next = tokens[i+1];
      if (isNumber(cur) && next === '%') {
        t.push('(' + cur + '/100)');
        i++; // skip %
      } else {
        t.push(cur);
      }
    }

    // pass2: A (+|−) (B/100)  => A (+|−) (A*(B/100))
    // pass3: A (×|÷) (B/100) => keep
    const out = [];
    for (let i=0;i<t.length;i++){
      const cur = t[i];
      const op = t[i+1];
      const rhs = t[i+2];

      if (isNumber(cur) || cur === ')' ) {
        // We only handle simple A op rhs where rhs contains /100
      }

      if (op && (op === '+' || op === '−') && rhs && String(rhs).includes('/100)')) {
        // Find left expression span since last operator boundary.
        const left = captureLeftExpression(out);
        if (!left) continue;
        // Replace last left in out with itself (already in out), and append op + (left*(rhs))
        out.push(op);
        out.push('(' + left + '*'+ rhs + ')');
        i += 2;
      } else {
        out.push(cur);
      }
    }
    return out;
  }

  function captureLeftExpression(outArr) {
    // Build a string representation of the entire outArr (already safe-ish), but we want last "primary" expression.
    // We'll take everything since last operator at top-level. Simplified.
    let depth = 0;
    let idx = outArr.length - 1;
    for (; idx >= 0; idx--) {
      const tok = outArr[idx];
      if (tok === ')') depth++;
      if (tok === '(') depth--;
      if (depth === 0 && ['+','−','×','÷','*','/','-'].includes(tok)) {
        break;
      }
    }
    const slice = outArr.slice(idx + 1).join('');
    return slice || null;
  }

  function isNumber(tok) {
    return typeof tok === 'string' && tok.length > 0 && !Number.isNaN(Number(tok));
  }

  function safeEval(expr) {
    // Evaluate in a restricted way using Function but with sanitized characters.
    const allowed = /^[0-9+\-*/().\s]+$/;
    if (!allowed.test(expr)) throw new Error('Invalid expression');
    // eslint-disable-next-line no-new-func
    const fn = new Function(`return (${expr});`);
    const v = fn();
    if (!Number.isFinite(v)) throw new Error('NaN');
    return v;
  }

  function calcPress(action) {
    if (action === 'clear') {
      state.calc.expr = '';
      state.calc.res = '0';
      renderCalc();
      return;
    }
    if (action === 'back') {
      state.calc.expr = state.calc.expr.slice(0, -1);
      renderCalc();
      return;
    }
    if (action === 'eq') {
      if (!state.calc.expr.trim()) return;
      try {
        const normalized = normalizeExprForEval(state.calc.expr);
        const value = safeEval(normalized);
        const res = fmtNumber(value, 8).replace(/\.0+$/,'').replace(/(\.[0-9]*?)0+$/,'$1');
        state.calc.res = res;
        state.calc.history.unshift({ expr: state.calc.expr, res });
        state.calc.history = state.calc.history.slice(0, 100);
        saveCalcHistory();
        renderHistory();
        state.calc.expr = res; // carry result
        renderCalc();
      } catch {
        state.calc.res = 'Error';
        renderCalc();
      }
      return;
    }

    // Append tokens
    const map = { '*': '×', '/': '÷', '-': '−' };
    const token = map[action] || action;

    // Basic input rules:
    // - prevent two operators in a row (except minus after operator for negative numbers)
    const ops = ['+','−','×','÷'];
    const last = state.calc.expr.slice(-1);

    if (ops.includes(token)) {
      if (!state.calc.expr && token !== '−') return;
      if (ops.includes(last)) {
        state.calc.expr = state.calc.expr.slice(0, -1) + token;
      } else {
        state.calc.expr += token;
      }
      renderCalc();
      return;
    }

    if (token === '.') {
      // prevent multiple dots in current number
      const parts = state.calc.expr.split(/[+−×÷()]/);
      const cur = parts[parts.length - 1];
      if (cur.includes('.')) return;
    }

    state.calc.expr += token;
    renderCalc();
  }

  // ---------- Init ----------
  function initInputs() {
    setInputNumeric(el.usdToIqd);
    setInputNumeric(el.expOunce);
    setInputNumeric(el.expUsdToIqd);
    setInputNumeric(el.fmLocalPrice);

    el.usdToIqd.addEventListener('input', () => {
      renderMarginUI();
      updateAllLiveUI(); // immediate updates (inputs update results instantly)
      updateFindMarginUI();
    });

    el.marginSlider.addEventListener('input', () => {
      renderMarginUI();
      updateAllLiveUI(); // immediate
    });

    el.liveKaratSelect.addEventListener('change', renderLiveSelected);
    el.liveUnitSelect.addEventListener('change', renderLiveSelected);

    el.expOunce.addEventListener('input', renderExpectation);
    el.expUsdToIqd.addEventListener('input', renderExpectation);
    el.expMarginSlider.addEventListener('input', renderExpectation);
    el.expKaratSelect.addEventListener('change', renderExpectation);
    el.expUnitSelect.addEventListener('change', renderExpectation);

    el.fmKaratSelect.addEventListener('change', updateFindMarginUI);
    el.fmLocalPrice.addEventListener('input', updateFindMarginUI);

    el.forceRefreshBtn.addEventListener('click', () => {
      // Run a poll immediately
      nextDelayMs = 1000;
      pollOnce();
    });

    window.addEventListener('online', () => {
      state.isOnline = true;
      setPillOnline(true);
      nextDelayMs = 1000;
      scheduleNextPoll(250);
    });
    window.addEventListener('offline', () => {
      state.isOnline = false;
      setPillOnline(false);
      // freeze updates (no fetch)
      stopPolling();
      scheduleNextPoll(2000);
    });
  }

  function initTimeframeButtons() {
    el.tfButtons.forEach(btn => {
      btn.addEventListener('click', () => setActiveTF(btn.dataset.tf));
    });
    setActiveTF(state.ui.currentTF);
  }

  function initCalculator() {
    buildCalcKeys();
    loadCalcState();
    state.calc.history = loadCalcHistory();
    renderHistory();
    renderCalc();

    el.calcKeys.addEventListener('click', (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains('key')) return;
      const action = target.dataset.action;
      if (!action) return;
      calcPress(action);
    });

    el.toggleHistoryBtn.addEventListener('click', () => {
      state.calc.showHistory = !state.calc.showHistory;
      renderCalc();
    });

    el.clearHistoryBtn.addEventListener('click', () => {
      state.calc.history = [];
      saveCalcHistory();
      renderHistory();
    });

    window.addEventListener('keydown', (e) => {
      // simple keyboard support
      const k = e.key;
      if (k === 'Enter') { e.preventDefault(); calcPress('eq'); }
      if (k === 'Backspace') { e.preventDefault(); calcPress('back'); }
      if (k === 'Escape') { e.preventDefault(); calcPress('clear'); }
      if (k === '*' ) calcPress('×');
      if (k === '/' ) calcPress('÷');
      if (k === '-' ) calcPress('−');
      if (k === '+' ) calcPress('+');
      if (k === '%' ) calcPress('%');
      if (k === '(' ) calcPress('(');
      if (k === ')' ) calcPress(')');
      if (/[0-9]/.test(k)) calcPress(k);
      if (k === '.' ) calcPress('.');
    });
  }

  async function initChartPipeline() {
    initWorker();
    initChart();
    initTimeframeButtons();

    const seed = await loadSeedChartHistory();
    const local = loadLocalChartHistory();

    const merged = normalizePoints([...seed, ...local]);
    state.chart.points = merged;

    // Set lastSavedPrice from last point
    const last = merged[merged.length - 1];
    state.chart.lastSavedPrice = last ? last.p : null;

    requestChartRender();
  }

  function init() {
    buildKaratCards();
    initInputs();
    initCalculator();
    initChartPipeline();

    // Initial UI state
    setPillOnline(state.isOnline);
    renderMarginUI();
    renderExpectation();
    updateAllLiveUI();

    // Start polling
    scheduleNextPoll(150);
  }

  init();
})(); 
