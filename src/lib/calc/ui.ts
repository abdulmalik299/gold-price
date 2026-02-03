import { formatCalc, safeEval } from './engine';

export type CalcHistoryItem = { expr: string; result: string; at: string };

export function mountCalculator(el: HTMLElement) {
  let expr = '';
  let live = '0';
  let history: CalcHistoryItem[] = [];

  const exprEl = el.querySelector('[data-calc-expr]') as HTMLElement;
  const resEl = el.querySelector('[data-calc-res]') as HTMLElement;
  const histBtn = el.querySelector('[data-calc-toggle]') as HTMLButtonElement;
  const clearHistBtn = el.querySelector('[data-calc-clear]') as HTMLButtonElement;
  const histList = el.querySelector('[data-calc-list]') as HTMLElement;

  const persist = () => {
    localStorage.setItem('goldlux.calc.expr', expr);
    localStorage.setItem('goldlux.calc.history', JSON.stringify(history.slice(0, 50)));
  };

  const restore = () => {
    expr = localStorage.getItem('goldlux.calc.expr') || '';
    const h = localStorage.getItem('goldlux.calc.history');
    if (h) {
      try {
        history = JSON.parse(h);
      } catch {
        history = [];
      }
    }
  };

  const renderHistory = () => {
    histList.innerHTML = history
      .slice(0, 50)
      .map(
        (h) => `
      <div class="hitem">
        <div class="e">${escapeHtml(h.expr)}</div>
        <div class="r">${escapeHtml(h.result)}</div>
        <div style="margin-top:6px;color:rgba(246,243,234,0.55);font-size:11px">${escapeHtml(
          h.at
        )}</div>
      </div>
    `
      )
      .join('');
  };

  const update = () => {
    exprEl.textContent = expr || '';
    const r = safeEval(expr);
    live = r.ok ? formatCalc(r.value) : 'Error';
    resEl.textContent = live;
    persist();
  };

  const insert = (t: string) => {
    expr += t;
    update();
  };

  const backspace = () => {
    expr = expr.slice(0, -1);
    update();
  };

  const clearAll = () => {
    expr = '';
    update();
  };

  const toggleSign = () => {
    // crude but effective: wrap last number in (-1*...)
    const m = expr.match(/(.*?)(\d+(?:\.\d+)?)(?!.*\d)/);
    if (!m) {
      expr = expr ? `-((${expr}))` : '-0';
      update();
      return;
    }
    const before = m[1];
    const num = m[2];
    expr = `${before}(-1*${num})`;
    update();
  };

  const evaluate = () => {
    const r = safeEval(expr);
    if (r.ok) {
      const res = formatCalc(r.value);
      history.unshift({ expr: expr || '0', result: res, at: new Date().toLocaleString() });
      expr = res.replace(/e/g, 'e'); // keep
      renderHistory();
      update();
    } else {
      resEl.textContent = 'Error';
    }
  };

  const onKey = (key: string) => {
    switch (key) {
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        insert(key);
        break;
      case '.':
        insert('.');
        break;
      case '+':
        insert('+');
        break;
      case '-':
        insert('−');
        break;
      case '*':
        insert('×');
        break;
      case '/':
        insert('÷');
        break;
      case '(':
      case ')':
        insert(key);
        break;
      case '%':
        insert('%');
        break;
      case '^':
        insert('^');
        break;
      case 'sqrt':
        insert('sqrt(');
        break;
      case 'sin':
      case 'cos':
      case 'tan':
      case 'log':
      case 'ln':
        insert(`${key}(`);
        break;
      case 'sign':
        toggleSign();
        break;
      case 'del':
        backspace();
        break;
      case 'ac':
        clearAll();
        break;
      case '=':
        evaluate();
        break;
    }
  };

  const btns = el.querySelectorAll('[data-calc-key]');
  btns.forEach((b) => {
    b.addEventListener('click', () => onKey((b as HTMLElement).dataset.calcKey || ''));
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Enter') return void evaluate();
    if (k === 'Backspace') return void backspace();
    if (k === 'Escape') return void clearAll();
    if ('0123456789.+-*/()%'.includes(k)) return void onKey(k);
  });

  histBtn.addEventListener('click', () => {
    histList.classList.toggle('show');
    histBtn.textContent = histList.classList.contains('show') ? 'Hide' : 'Show';
  });
  clearHistBtn.addEventListener('click', () => {
    history = [];
    renderHistory();
    persist();
  });

  restore();
  renderHistory();
  update();

  return { getExpression: () => expr, setExpression: (s: string) => ((expr = s), update()) };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]!));
}
