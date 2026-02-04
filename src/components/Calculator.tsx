import React from 'react'
import { formatWithCommas } from '../lib/format'
import { getJSON, setJSON } from '../lib/storage'

type HistItem = { expr: string; result: string; at: number }

const OPS = new Set(['+', '−', '×', '÷'])
const PREC: Record<string, number> = { '+': 1, '−': 1, '×': 2, '÷': 2 }
const isDigit = (ch: string) => /\d/.test(ch)
function countUnclosedParens(value: string) {
  let count = 0
  for (const ch of value) {
    if (ch === '(') count += 1
    else if (ch === ')') count -= 1
  }
  return count
}
function tokenize(expr: string): string[] {
  const out: string[] = []
  let num = ''
  const pushNum = () => {
    if (num !== '') { out.push(num); num = '' }
  }
  for (const ch of expr) {
    if (/\d|\./.test(ch)) num += ch
    else if (ch === ',') continue
    else if (OPS.has(ch) || ch === '(' || ch === ')') { pushNum(); out.push(ch) }
    else if (ch === ' ') continue
  }
  pushNum()
  return out
}

function toRpn(tokens: string[]): string[] {
  const out: string[] = []
  const stack: string[] = []
  for (const t of tokens) {
    if (!isNaN(Number(t))) out.push(t)
    else if (OPS.has(t)) {
      while (stack.length) {
        const top = stack[stack.length - 1]
        if (OPS.has(top) && PREC[top] >= PREC[t]) out.push(stack.pop()!)
        else break
      }
      stack.push(t)
    } else if (t === '(') stack.push(t)
    else if (t === ')') {
      while (stack.length && stack[stack.length - 1] !== '(') out.push(stack.pop()!)
      if (stack[stack.length - 1] === '(') stack.pop()
    }
  }
  while (stack.length) out.push(stack.pop()!)
  return out
}

function evalRpn(rpn: string[]): number {
  const s: number[] = []
  for (const t of rpn) {
    if (!isNaN(Number(t))) s.push(Number(t))
    else {
      const b = s.pop() ?? 0
      const a = s.pop() ?? 0
      if (t === '+') s.push(a + b)
      else if (t === '−') s.push(a - b)
      else if (t === '×') s.push(a * b)
      else if (t === '÷') s.push(b === 0 ? NaN : a / b)
    }
  }
  return s.pop() ?? 0
}

function formatResult(n: number) {
  if (!Number.isFinite(n)) return 'Error'
  // Keep up to 10 decimals but trim trailing zeros.
  const s = n.toFixed(10).replace(/\.0+$|(?<=\..*?)0+$/g, '')
  const parts = s.split('.')
  const i = Number(parts[0])
  const head = formatWithCommas(i, 0)
  return parts.length === 2 ? `${head}.${parts[1]}` : head
}

export default function Calculator() {
  const [expr, setExpr] = React.useState<string>(() => getJSON('calcExpr', ''))
  const [preview, setPreview] = React.useState<string>('0')
  const [hist, setHist] = React.useState<HistItem[]>(() => getJSON('calcHist', []))
  const [showHist, setShowHist] = React.useState<boolean>(() => getJSON('calcShowHist', false))

  React.useEffect(() => setJSON('calcExpr', expr), [expr])
  React.useEffect(() => setJSON('calcHist', hist), [hist])
  React.useEffect(() => setJSON('calcShowHist', showHist), [showHist])

  React.useEffect(() => {
    try {
      if (!expr.trim()) { setPreview('0'); return }
      const rpn = toRpn(tokenize(expr))
      const val = evalRpn(rpn)
      setPreview(formatResult(val))
    } catch {
      setPreview('Error')
    }
  }, [expr])

  const press = (v: string) => setExpr((p) => {
    const last = p.slice(-1)
    const openParens = countUnclosedParens(p)

    if (v === '(') {
      if (!p) return '('
      if (isDigit(last) || last === ')') return `${p}×(`
      if (last === '(') return p
      if (OPS.has(last)) return `${p}(`
      return p
    }

    if (v === ')') {
      if (!p || openParens <= 0) return p
      if (OPS.has(last) || last === '(' || last === ')') return p
      return `${p})`
    }

    if (OPS.has(v)) {
      if (!p) return p
      if (OPS.has(last) || last === '(') return p
      return `${p}${v}`
    }

    return `${p}${v}`
  })
  const clear = () => setExpr('')
  const back = () => setExpr((p) => p.slice(0, -1))

  const equals = () => {
    try {
      const rpn = toRpn(tokenize(expr))
      const val = evalRpn(rpn)
      const res = formatResult(val)
      const next: HistItem = { expr: expr || '0', result: res, at: Date.now() }
      setHist((h) => [next, ...h].slice(0, 60))
      setExpr(res === 'Error' ? '' : res)
    } catch {
      setExpr('')
    }
  }

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); equals(); return }
    if (e.key === 'Backspace') { e.preventDefault(); back(); return }
    if (e.key === 'Escape') { e.preventDefault(); clear(); return }
  }

  return (
    <div className="card calc">
      <div className="cardTop">
        <div className="cardTitle">Advanced Calculator</div>
        <div className="inlineRight">
          <button className="chip" type="button" onClick={() => setShowHist((s) => !s)}>
            <span className="chipGlow" />
            {showHist ? 'Hide history' : 'Show history'}
          </button>
        </div>
      </div>

      <div className="calcBody">
        <div className="calcDisplay" onKeyDown={key} tabIndex={0}>
          <div className="calcExpr">{expr || '0'}</div>
          <div className="calcPreview">{preview}</div>
        </div>

        <div className="calcGrid">
          <button className="cBtn cAlt" onClick={() => press('(')} type="button">(</button>
          <button className="cBtn cAlt" onClick={() => press(')')} type="button">)</button>
          <button className="cBtn cAlt" onClick={back} type="button">⌫</button>
          <button className="cBtn cOp" onClick={() => press('÷')} type="button">÷</button>

          <button className="cBtn" onClick={() => press('7')} type="button">7</button>
          <button className="cBtn" onClick={() => press('8')} type="button">8</button>
          <button className="cBtn" onClick={() => press('9')} type="button">9</button>
          <button className="cBtn cOp" onClick={() => press('×')} type="button">×</button>

          <button className="cBtn" onClick={() => press('4')} type="button">4</button>
          <button className="cBtn" onClick={() => press('5')} type="button">5</button>
          <button className="cBtn" onClick={() => press('6')} type="button">6</button>
          <button className="cBtn cOp" onClick={() => press('−')} type="button">−</button>

          <button className="cBtn" onClick={() => press('1')} type="button">1</button>
          <button className="cBtn" onClick={() => press('2')} type="button">2</button>
          <button className="cBtn" onClick={() => press('3')} type="button">3</button>
          <button className="cBtn cOp" onClick={() => press('+')} type="button">+</button>

          <button className="cBtn cAlt" onClick={clear} type="button">C</button>
          <button className="cBtn" onClick={() => press('0')} type="button">0</button>
          <button className="cBtn" onClick={() => press('.')} type="button">.</button>
          <button className="cBtn cEq" onClick={equals} type="button">=</button>
        </div>

        {showHist ? (
          <div className="calcHist">
            <div className="calcHistTop">
              <div className="calcHistTitle">History</div>
              <button className="chip" type="button" onClick={() => setHist([])}>
                <span className="chipGlow" />
                Clear
              </button>
            </div>
            {hist.length === 0 ? <div className="mutedTiny">No history yet.</div> : null}
            <div className="calcHistList">
              {hist.map((h) => (
                <button
                  key={h.at}
                  type="button"
                  className="histRow"
                  onClick={() => setExpr(h.result === 'Error' ? '' : h.result)}
                >
                  <div className="histExpr">{h.expr}</div>
                  <div className="histRes">{h.result}</div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mutedTiny">
        Keyboard: Enter (=), Backspace (delete), Esc (clear). Division uses the symbol <b>÷</b>.
      </div>
    </div>
  )
}
