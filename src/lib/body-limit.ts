// True when a declared content-length already exceeds the cap, so the body can be refused unread.
export function isDeclaredBodyTooLarge(
  contentLength: string | null,
  maxBytes: number,
): boolean {
  if (contentLength === null) return false;
  const declared = Number(contentLength);
  return Number.isFinite(declared) && declared > maxBytes;
}
