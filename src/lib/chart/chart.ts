import { createChart, ColorType, LineStyle, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { GoldPoint, Timeframe } from './types';
import { formatNumber, fmtDateTime } from '../format';

export type ChartController = {
  setTimeframe: (tf: Timeframe) => void;
  pushPoint: (p: GoldPoint) => void;
  destroy: () => void;
};

type WorkerOut =
  | {
      type: 'processed';
      timeframe: Timeframe;
      series: { time: number; value: number }[];
      min: number;
      max: number;
    };

export function mountGoldChart(opts: {
  el: HTMLElement;
  yWheelEl: HTMLElement;
  toast: (msg: string) => void;
  initial: GoldPoint[];
  tzOffsetMinutes: number;
}): ChartController {
  const { el, yWheelEl, toast, initial, tzOffsetMinutes } = opts;

  const chart: IChartApi = createChart(el, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'rgba(0,0,0,0.0)' },
      textColor: 'rgba(246,243,234,0.72)',
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial',
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.06)' },
      horzLines: { color: 'rgba(255,255,255,0.06)' },
    },
    rightPriceScale: {
      borderColor: 'rgba(255,255,255,0.10)',
      scaleMargins: { top: 0.12, bottom: 0.14 },
    },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.10)',
      timeVisible: true,
      secondsVisible: false,
    },
    crosshair: {
      mode: 1,
      vertLine: {
        color: 'rgba(243,194,76,0.55)',
        width: 1,
        style: LineStyle.Solid,
        labelBackgroundColor: 'rgba(0,0,0,0.55)',
      },
      horzLine: {
        color: 'rgba(243,194,76,0.55)',
        width: 1,
        style: LineStyle.Solid,
        labelBackgroundColor: 'rgba(0,0,0,0.55)',
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  });

  const series: ISeriesApi<'Line'> = chart.addLineSeries({
    color: 'rgba(243,194,76,0.95)',
    lineWidth: 2,
    priceLineVisible: true,
    lastValueVisible: true,
  });

  // "Plus-style ruler": we add an extra crosshair overlay via a custom HTML layer
  const ruler = document.createElement('div');
  ruler.style.position = 'absolute';
  ruler.style.inset = '0';
  ruler.style.pointerEvents = 'none';
  ruler.style.opacity = '0';
  ruler.innerHTML = `
    <div class="r-v" style="position:absolute;top:0;bottom:0;width:1px;background:rgba(246,243,234,0.22)"></div>
    <div class="r-h" style="position:absolute;left:0;right:0;height:1px;background:rgba(246,243,234,0.22)"></div>
    <div class="r-c" style="position:absolute;width:9px;height:9px;border-radius:99px;border:1px solid rgba(246,243,234,.35);box-shadow:0 0 0 6px rgba(243,194,76,.08)"></div>
  `;
  el.appendChild(ruler);
  const rv = ruler.querySelector('.r-v') as HTMLDivElement;
  const rh = ruler.querySelector('.r-h') as HTMLDivElement;
  const rc = ruler.querySelector('.r-c') as HTMLDivElement;

  chart.subscribeCrosshairMove((p) => {
    if (!p || p.point == null || !p.time) {
      ruler.style.opacity = '0';
      return;
    }
    ruler.style.opacity = '1';
    rv.style.left = `${p.point.x}px`;
    rh.style.top = `${p.point.y}px`;
    rc.style.left = `${p.point.x - 4}px`;
    rc.style.top = `${p.point.y - 4}px`;

    const price = p.seriesData.get(series) as any;
    if (price?.value != null) {
      // show value in title bar (via custom event)
      el.dispatchEvent(
        new CustomEvent('goldchart:hover', {
          detail: {
            value: price.value as number,
            time: p.time as number,
          },
        })
      );
    }
  });

  // Wheel on Y-axis area to zoom price scale (lightweight-charts doesn't distinguish well yet)
  // We emulate by scaling the visible price range.
  let manualScale = 1.0;
  yWheelEl.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      const dir = Math.sign(ev.deltaY);
      manualScale *= dir > 0 ? 1.06 : 0.94;
      manualScale = Math.max(0.35, Math.min(3.2, manualScale));
      // approximate: adjust scale margins to emulate
      chart.applyOptions({
        rightPriceScale: {
          scaleMargins: { top: 0.12 * manualScale, bottom: 0.14 * manualScale },
        },
      });
      toast(`Price scale ×${manualScale.toFixed(2)}`);
    },
    { passive: false }
  );

  // worker for resampling / smoothing
  const worker = new Worker(new URL('../../workers/chartWorker.ts', import.meta.url), {
    type: 'module',
  });

  let allPoints: GoldPoint[] = [...initial].sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
  let timeframe: Timeframe = '24h';

  const process = () => {
    worker.postMessage({ type: 'process', points: sliceForTimeframe(allPoints, timeframe), timeframe, tzOffsetMinutes });
  };

  worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
    const msg = ev.data;
    if (msg.type === 'processed') {
      series.setData(msg.series);
      chart.timeScale().fitContent();
    }
  };

  function sliceForTimeframe(points: GoldPoint[], tf: Timeframe) {
    const now = Date.now();
    const ms = (iso: string) => new Date(iso).getTime();
    if (tf === '24h') return points.filter((p) => now - ms(p.ts) <= 24 * 60 * 60 * 1000);
    if (tf === '7d') return points.filter((p) => now - ms(p.ts) <= 7 * 24 * 60 * 60 * 1000);
    if (tf === 'months') return points.filter((p) => now - ms(p.ts) <= 365 * 24 * 60 * 60 * 1000);
    // years: all since publish (limited in query)
    return points;
  }

  process();

  const onHover = (ev: Event) => {
    const e = ev as CustomEvent<{ value: number; time: number }>;
    const { value, time } = e.detail;
    const d = new Date(time * 1000);
    const title = document.querySelector('[data-chart-live]') as HTMLElement | null;
    if (title) {
      title.textContent = `${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • ${fmtDateTime(d)}`;
    }
  };
  el.addEventListener('goldchart:hover', onHover);

  return {
    setTimeframe(tf) {
      timeframe = tf;
      process();
    },
    pushPoint(p) {
      allPoints.push(p);
      allPoints.sort((a, b) => +new Date(a.ts) - +new Date(b.ts));
      process();
    },
    destroy() {
      el.removeEventListener('goldchart:hover', onHover);
      worker.terminate();
      chart.remove();
    },
  };
}
