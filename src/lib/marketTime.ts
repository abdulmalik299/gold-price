const MARKET_OPEN_HOUR = 2

function getLastFridayOpen(reference: Date) {
  const d = new Date(reference)
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() - 1)
  }
  d.setHours(MARKET_OPEN_HOUR, 0, 0, 0)
  return d
}

export function getLastMarketOpenMs(nowMs = Date.now()) {
  const now = new Date(nowMs)
  const candidate = new Date(now)
  candidate.setHours(MARKET_OPEN_HOUR, 0, 0, 0)

  if (now.getTime() < candidate.getTime()) {
    candidate.setDate(candidate.getDate() - 1)
  }

  const day = candidate.getDay()
  if (day === 6 || day === 0) {
    return getLastFridayOpen(candidate).getTime()
  }

  return candidate.getTime()
}
