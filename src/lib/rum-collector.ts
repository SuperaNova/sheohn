// Zero-dependency RUM collector: hand-rolled PerformanceObserver usage for
// LCP/CLS/INP plus a pageview beacon. No web-vitals package, by design.

type Metric = 'lcp' | 'cls' | 'inp';

let lcpValue: number | undefined;
let clsValue = 0;
let inpValue: number | undefined;
let finalized = false;

function send(
  route: string,
  metric: Metric | 'pageview',
  value?: number,
): void {
  if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
  try {
    // A Blob body lets sendBeacon send application/json (strings default to text/plain).
    const blob = new Blob([JSON.stringify({ route, metric, value })], {
      type: 'application/json',
    });
    navigator.sendBeacon('/api/vitals', blob);
  } catch {
    // A dropped beacon must never break the page.
  }
}

function observe(
  type: string,
  callback: (entries: PerformanceObserverEntryList) => void,
  options?: Record<string, unknown>,
): void {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const observer = new PerformanceObserver(callback);
    observer.observe({
      type,
      buffered: true,
      ...options,
    } as PerformanceObserverInit);
  } catch {
    // Entry type unsupported in this browser — skip that metric only.
  }
}

function observeLcp(): void {
  observe('largest-contentful-paint', (list) => {
    const entries = list.getEntries() as (PerformanceEntry & {
      renderTime?: number;
      loadTime?: number;
    })[];
    const last = entries[entries.length - 1];
    if (last) lcpValue = last.renderTime || last.loadTime || last.startTime;
  });
}

// Simplified CLS: sums non-user-initiated shifts over the page lifetime, not session windows.
function observeCls(): void {
  observe('layout-shift', (list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    })[]) {
      if (!entry.hadRecentInput) clsValue += entry.value;
    }
  });
}

// Simplified INP: the largest interaction duration seen, not session percentiles.
function observeInp(): void {
  observe(
    'event',
    (list) => {
      for (const entry of list.getEntries()) {
        if (inpValue === undefined || entry.duration > inpValue) {
          inpValue = entry.duration;
        }
      }
    },
    { durationThreshold: 40 },
  );
}

function finalize(route: string): void {
  if (finalized) return;
  finalized = true;
  if (lcpValue !== undefined) send(route, 'lcp', lcpValue);
  send(route, 'cls', clsValue);
  if (inpValue !== undefined) send(route, 'inp', inpValue);
}

export function initRumCollector(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Captured once so vitals attribute to the measured page, not the post-navigation one.
  const initialRoute = window.location.pathname;

  // Real vitals exist only for the initial navigation, so observers attach once.
  observeLcp();
  observeCls();
  observeInp();

  const onHide = () => finalize(initialRoute);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);

  // Fires on load and after every view-transition swap, so pageviews include client navigation.
  document.addEventListener('astro:page-load', () => {
    send(window.location.pathname, 'pageview');
  });

  // astro:page-load's first firing is bound to window 'load'; if this ran after it, send now.
  if (document.readyState === 'complete') {
    send(initialRoute, 'pageview');
  }
}
