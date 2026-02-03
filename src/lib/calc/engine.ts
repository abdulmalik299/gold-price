/**
 * Samsung-like calculator engine (safe, no eval()).
 * Supports:
 *  - +, −, ×, ÷
 *  - %, parentheses
 *  - unary ±
 *  - sqrt, x^y
 *  - sin, cos, tan, log, ln
 *
 * Output: number or error.
 */

export type CalcFn = 'sin' | 'cos' | 'tan' | 'sqrt' | 'log' | 'ln';
export type Token =
  | { t: 'num'; v: number }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: 'lpar' }
  | { t: 'rpar' }
  | { t: 'fn'; v: CalcFn }
  | { t: 'pct' };

const prec: Record<string, number> = {
  '^': 4,
  '*': 3,
  '/': 3,
  '+': 2,
  '-': 2,
};

const rightAssoc = new Set(['^']);

export function tokenize(expr: string): Token[] {
  const s = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  const out: Token[] = [];
  let i = 0;

  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isAlpha = (c: string) => /[a-z]/i.test(c);

  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\n' || c === '\t') {
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ t: 'lpar' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rpar' });
      i++;
      continue;
    }
    if (c === '%') {
      out.push({ t: 'pct' });
      i++;
      continue;
    }

    if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c as any });
      i++;
      continue;
    }

    if (isAlpha(c)) {
      let j = i;
      while (j < s.length && isAlpha(s[j])) j++;
      const name = s.slice(i, j).toLowerCase();
      if (['sin', 'cos', 'tan', 'sqrt', 'log', 'ln'].includes(name)) {
        out.push({ t: 'fn', v: name as any });
        i = j;
        continue;
      }
      throw new Error(`Unknown identifier: ${name}`);
    }

    if (isDigit(c) || c === '.') {
      let j = i;
      while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) throw new Error('Invalid number');
      out.push({ t: 'num', v: n });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character: ${c}`);
  }

  return out;
}

export function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  const pushOp = (op: Token) => {
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.t === 'fn') {
        output.push(stack.pop()!);
        continue;
      }
      if (top.t !== 'op') break;
      const pTop = prec[top.v];
      const pCur = prec[(op as any).v];
      if (pTop > pCur || (pTop === pCur && !rightAssoc.has((op as any).v))) {
        output.push(stack.pop()!);
        continue;
      }
      break;
    }
    stack.push(op);
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.t === 'num') output.push(t);
    else if (t.t === 'fn') stack.push(t);
    else if (t.t === 'pct') output.push(t);
    else if (t.t === 'op') pushOp(t);
    else if (t.t === 'lpar') stack.push(t);
    else if (t.t === 'rpar') {
      while (stack.length && stack[stack.length - 1].t !== 'lpar') {
        output.push(stack.pop()!);
      }
      if (!stack.length) throw new Error('Mismatched parentheses');
      stack.pop(); // pop lpar
      // if a function is on top, pop it too
      if (stack.length && stack[stack.length - 1].t === 'fn') {
        output.push(stack.pop()!);
      }
    }
  }

  while (stack.length) {
    const t = stack.pop()!;
    if (t.t === 'lpar' || t.t === 'rpar') throw new Error('Mismatched parentheses');
    output.push(t);
  }
  return output;
}

function applyFn(fn: CalcFn, x: number) {
  switch (fn) {
    case 'sin':
      return Math.sin((x * Math.PI) / 180);
    case 'cos':
      return Math.cos((x * Math.PI) / 180);
    case 'tan':
      return Math.tan((x * Math.PI) / 180);
    case 'sqrt':
      return Math.sqrt(x);
    case 'log':
      return Math.log10(x);
    case 'ln':
      return Math.log(x);
  }
}

export function evalRpn(rpn: Token[]): number {
  const st: number[] = [];
  for (const t of rpn) {
    if (t.t === 'num') st.push(t.v);
    else if (t.t === 'pct') {
      if (!st.length) throw new Error('Invalid %');
      st.push(st.pop()! / 100);
    } else if (t.t === 'fn') {
      if (!st.length) throw new Error('Invalid function');
      st.push(applyFn(t.v, st.pop()!));
    } else if (t.t === 'op') {
      const b = st.pop();
      const a = st.pop();
      if (a == null || b == null) throw new Error('Invalid expression');
      let v = 0;
      switch (t.v) {
        case '+':
          v = a + b;
          break;
        case '-':
          v = a - b;
          break;
        case '*':
          v = a * b;
          break;
        case '/':
          v = a / b;
          break;
        case '^':
          v = Math.pow(a, b);
          break;
      }
      st.push(v);
    } else {
      throw new Error('Invalid token');
    }
  }
  if (st.length !== 1) throw new Error('Invalid expression');
  const v = st[0];
  if (!Number.isFinite(v)) throw new Error('Math error');
  return v;
}

export function safeEval(expr: string): { ok: true; value: number } | { ok: false; error: string } {
  try {
    // quick fix for unary minus: turn leading '-' into '0-'
    let s = expr.trim();
    if (!s) return { ok: true, value: 0 };
    s = s.replace(/(^|\()\s*-/g, '$10-');
    const rpn = toRpn(tokenize(s));
    return { ok: true, value: evalRpn(rpn) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export function formatCalc(n: number) {
  // Samsung-like: avoid too many decimals, keep precision
  if (!Number.isFinite(n)) return 'Error';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e10 || abs < 1e-6)) return n.toExponential(6).replace('e+', 'e');
  // trim trailing zeros
  const s = n.toFixed(10).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return s.length > 14 ? n.toPrecision(12) : s;
}
