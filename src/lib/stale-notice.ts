import { now } from '../data/now';
import { siteNotice, type SiteNoticeMode } from '../data/site-notice';

function parseIsoDate(iso: string): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number);
  return [year ?? 0, month ?? 1, day ?? 1];
}

/** Whole months from an ISO date to `to` (UTC), floored; negative clamps to 0. */
export function monthsBetween(fromIso: string, to: Date): number {
  const [year, month, day] = parseIsoDate(fromIso);
  let months =
    (to.getUTCFullYear() - year) * 12 + (to.getUTCMonth() + 1 - month);
  if (to.getUTCDate() < day) months -= 1;
  return Math.max(0, months);
}

/** Stale only strictly after the review date plus `months` calendar months. */
export function isInfoStale(
  reviewedOn: string,
  today: Date,
  months: number,
): boolean {
  const [year, month, day] = parseIsoDate(reviewedOn);
  const threshold = Date.UTC(year, month - 1 + months, day);
  const todayStart = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return todayStart > threshold;
}

function formatDate(iso: string): string {
  const [year, month, day] = parseIsoDate(iso);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function noticeText(input: {
  reviewedOn: string;
  today: Date;
  months: number;
  mode: SiteNoticeMode;
  message: string;
}): string {
  if (input.mode === 'on') {
    return (
      input.message ||
      'site under light maintenance · some info may be out of date'
    );
  }
  return `info last reviewed ${formatDate(input.reviewedOn)} · older than ${input.months} months, some of this is probably out of date`;
}

/** Honored only on loopback hosts, mirroring the theme override in BaseLayout. */
export function parseNoticeOverride(
  search: string,
  hostname: string,
): 'on' | 'off' | null {
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return null;
  const value = new URLSearchParams(search).get('notice');
  return value === 'on' || value === 'off' ? value : null;
}

// Precedence: override > automated (hide) > mode 'off' > mode 'on' > auto staleness.
export function resolveNotice(input: {
  mode: SiteNoticeMode;
  reviewedOn: string;
  today: Date;
  months: number;
  message: string;
  override: 'on' | 'off' | null;
  automated: boolean;
}): { show: boolean; text: string } {
  const textFor = (mode: SiteNoticeMode) =>
    noticeText({
      reviewedOn: input.reviewedOn,
      today: input.today,
      months: input.months,
      mode,
      message: input.message,
    });
  if (input.override === 'off') return { show: false, text: '' };
  if (input.override === 'on') {
    return { show: true, text: textFor(input.mode === 'on' ? 'on' : 'auto') };
  }
  if (input.automated) return { show: false, text: '' };
  if (input.mode === 'off') return { show: false, text: '' };
  if (input.mode === 'on') return { show: true, text: textFor('on') };
  if (isInfoStale(input.reviewedOn, input.today, input.months)) {
    return { show: true, text: textFor('auto') };
  }
  return { show: false, text: '' };
}

export function freshnessNote(
  reviewedOn: string,
  today: Date,
  months: number,
): string {
  const elapsed = monthsBetween(reviewedOn, today);
  const unit = elapsed === 1 ? 'month' : 'months';
  const base = `FRESHNESS: Jared last reviewed these facts on ${reviewedOn} (${elapsed} ${unit} ago).`;
  if (!isInfoStale(reviewedOn, today, months)) return base;
  return `${base} Anything about what he is doing now, his role, or his availability may be out of date; say so briefly when it is relevant, then answer from the facts.`;
}

/** Browser-only; shared by the notice island and the boot log so they agree. */
export function currentNotice(): { show: boolean; text: string } {
  if (typeof window === 'undefined') return { show: false, text: '' };
  return resolveNotice({
    mode: siteNotice.mode,
    reviewedOn: now.updated,
    today: new Date(),
    months: siteNotice.staleAfterMonths,
    message: siteNotice.message,
    override: parseNoticeOverride(
      window.location.search,
      window.location.hostname,
    ),
    automated: navigator.webdriver === true,
  });
}
