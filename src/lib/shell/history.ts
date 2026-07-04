// localStorage-backed shell command history. Capped at MAX_HISTORY entries
// so a long-lived session can't grow the stored array unboundedly.

const STORAGE_KEY = 'sheohn-shell-history';
/** Cap on persisted history length — oldest entries fall off the front. */
const MAX_HISTORY = 200;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Reads persisted history, most recent last. Never throws. */
export function getHistory(): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

/**
 * Appends `entry` to history (skipping blank input and immediate repeats of
 * the last entry) and persists it, capped to MAX_HISTORY. Returns the new
 * history array so callers can update in-memory state without a re-read.
 */
export function pushHistory(entry: string): string[] {
  const trimmed = entry.trim();
  const current = getHistory();
  if (!trimmed) return current;
  if (current[current.length - 1] === trimmed) return current;

  const next = [...current, trimmed].slice(-MAX_HISTORY);
  if (hasStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable or full — history just won't persist this run.
    }
  }
  return next;
}

/** Clears persisted history. */
export function clearHistory(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up if storage isn't available.
  }
}
