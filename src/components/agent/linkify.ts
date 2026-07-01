// The agent streams plain text that may contain markdown links
// ([label](url)) or bare URLs (the resume fallback link). Splitting into
// segments lets each piece render through Svelte's normal auto-escaping
// instead of dangerouslySetInnerHTML. URLs are protocol-validated
// (http/https/mailto only) so a prompt-injected javascript: link can never
// become clickable.
export type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'link'; label: string; href: string };

function safeHref(url: string): string | null {
  try {
    const u = new URL(url, 'https://sheohn.dev');
    if (
      u.protocol === 'http:' ||
      u.protocol === 'https:' ||
      u.protocol === 'mailto:'
    ) {
      return u.href;
    }
  } catch {
    /* malformed URL — fall through */
  }
  return null;
}

export function linkify(text: string): Segment[] {
  const segments: Segment[] = [];
  // markdown link  OR  bare http(s) url
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|((?:https?:\/\/)[^\s<>()]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      segments.push({ kind: 'text', value: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      const label = m[1];
      const href = safeHref(m[2] ?? '');
      segments.push(
        href ? { kind: 'link', label, href } : { kind: 'text', value: m[0] },
      );
    } else {
      const label = m[3] ?? '';
      const href = safeHref(label);
      segments.push(
        href ? { kind: 'link', label, href } : { kind: 'text', value: m[0] },
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length)
    segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}
