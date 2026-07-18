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
    // A raw string body defaults to text/plain; a Blob lets sendBeacon set
    // application/json so the endpoint's content-type guard accepts it.
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

// Simplified cumulative-sum CLS: sums every non-user-initiated shift for the
// page's lifetime, rather than the full session-windowing algorithm.
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

// Simplified INP: tracks the single largest interaction `duration` seen,
// rather than the full INP session-percentile algorithm.
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

  // Captured once: vitals must attribute to the page actually measured, not
  // wherever the visitor ends up after an SPA navigation.
  const initialRoute = window.location.pathname;

  // Real LCP/CLS/INP only exist for the initial navigation, so observers are
  // attached once here, never re-attached on a view-transition swap.
  observeLcp();
  observeCls();
  observeInp();

  const onHide = () => finalize(initialRoute);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);

  // Fires on the initial load AND after every Astro view-transition swap, so
  // /stats pageviews reflect client-side navigation too.
  document.addEventListener('astro:page-load', () => {
    send(window.location.pathname, 'pageview');
  });

  // astro:page-load's initial firing is bound to window 'load'; if this
  // (client:idle) runs after 'load' already happened, that firing is missed.
  if (document.readyState === 'complete') {
    send(initialRoute, 'pageview');
  }
}
