import type { Page } from "playwright";

export type Vitals = {
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  domContentLoadedMs: number | null;
  loadMs: number | null;
  requestCount: number;
  transferBytes: number;
};

export type VitalsCheck = {
  key: string;
  label: string;
  status: "pass" | "warning" | "error";
  message: string;
};

/** Thresholds follow Google's "good / needs improvement / poor" bands. */
const THRESHOLDS = {
  lcpMs: { good: 2500, poor: 4000, unit: "ms", label: "LCP" },
  cls: { good: 0.1, poor: 0.25, unit: "", label: "CLS" },
  tbtMs: { good: 200, poor: 600, unit: "ms", label: "TBT" },
  fcpMs: { good: 1800, poor: 3000, unit: "ms", label: "FCP" },
  ttfbMs: { good: 800, poor: 1800, unit: "ms", label: "TTFB" },
} as const;

/** Starts observers before navigation so no entry is missed. */
export const OBSERVER_SCRIPT = `(() => {
  window.__sitebot = { lcp: 0, cls: 0, longTasks: [] };
  const record = (type, handler) => {
    try {
      new PerformanceObserver(handler).observe({ type, buffered: true });
    } catch {}
  };
  record('largest-contentful-paint', (list) => {
    for (const entry of list.getEntries()) window.__sitebot.lcp = entry.startTime;
  });
  record('layout-shift', (list) => {
    for (const entry of list.getEntries())
      if (!entry.hadRecentInput) window.__sitebot.cls += entry.value;
  });
  record('longtask', (list) => {
    for (const entry of list.getEntries())
      window.__sitebot.longTasks.push({ start: entry.startTime, duration: entry.duration });
  });
})()`;

export async function readVitals(
  page: Page,
  traffic: { requestCount: number; transferBytes: number },
): Promise<Vitals> {
  const raw = await page.evaluate(() => {
    const store = (window as any).__sitebot ?? { lcp: 0, cls: 0, longTasks: [] };
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const fcp = performance
      .getEntriesByName("first-contentful-paint")
      .at(0)?.startTime;
    return {
      lcp: store.lcp,
      cls: store.cls,
      longTasks: store.longTasks as { start: number; duration: number }[],
      fcp: fcp ?? null,
      ttfb: nav ? nav.responseStart - nav.requestStart : null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
      load: nav ? nav.loadEventEnd : null,
    };
  });

  const loadEnd = raw.load ?? Number.POSITIVE_INFINITY;
  return {
    lcpMs: round(raw.lcp),
    cls: raw.cls === null ? null : Math.round(raw.cls * 1000) / 1000,
    tbtMs: round(totalBlockingTime(raw.longTasks, raw.fcp ?? 0, loadEnd)),
    fcpMs: round(raw.fcp),
    ttfbMs: round(raw.ttfb),
    domContentLoadedMs: round(raw.domContentLoaded),
    loadMs: round(raw.load),
    ...traffic,
  };
}

export function evaluateVitals(vitals: Vitals): VitalsCheck[] {
  const checks: VitalsCheck[] = [];
  for (const [key, band] of Object.entries(THRESHOLDS)) {
    const value = vitals[key as keyof typeof THRESHOLDS];
    if (value === null) continue;
    const status = value <= band.good ? "pass" : value <= band.poor ? "warning" : "error";
    checks.push({
      key,
      label: band.label,
      status,
      message: `${format(value, band.unit)} (${status === "pass" ? "good" : status === "warning" ? "needs improvement" : "poor"})`,
    });
  }
  return checks;
}

/**
 * Total Blocking Time sums the part of each long task past 50ms, counting only
 * tasks inside the load window. Later polling or animation tasks do not block
 * the initial render and would wildly inflate the number.
 */
function totalBlockingTime(
  tasks: { start: number; duration: number }[],
  from: number,
  to: number,
): number {
  return tasks
    .filter((task) => task.start >= from && task.start <= to)
    .reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);
}

function format(value: number, unit: string) {
  return unit === "ms" ? `${Math.round(value)}ms` : String(value);
}

function round(value: number | null | undefined) {
  return value === null || value === undefined ? null : Math.round(value);
}
