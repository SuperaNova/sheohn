import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  extractInlineScriptHashes,
  replaceScriptSrc,
  scriptSrcHashes,
  scriptSrcTokens,
} from './csp-hashes';

const hashOf = (body: string) =>
  `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://vercel.live; style-src 'self' 'unsafe-inline'; report-uri /api/csp-report";

describe('extractInlineScriptHashes', () => {
  it('hashes inline and module scripts over the raw body', () => {
    const html =
      '<script>console.log(1)</script><script type="module"> a </script>';
    expect(extractInlineScriptHashes(html)).toEqual(
      [hashOf('console.log(1)'), hashOf(' a ')].sort(),
    );
  });

  it('skips src, non-JS types and empty bodies', () => {
    const html = [
      '<script src="/a.js"></script>',
      '<script type="application/ld+json">{"a":1}</script>',
      '<script type="importmap">{}</script>',
      '<script>   </script>',
    ].join('');
    expect(extractInlineScriptHashes(html)).toEqual([]);
  });

  it('normalizes CRLF to LF before hashing, like the HTML parser', () => {
    expect(extractInlineScriptHashes('<script>a();\r\nb()</script>')).toEqual([
      hashOf('a();\nb()'),
    ]);
  });

  it('dedupes repeated scripts', () => {
    const html = '<script>x()</script><script>x()</script>';
    expect(extractInlineScriptHashes(html)).toEqual([hashOf('x()')]);
  });
});

describe('replaceScriptSrc', () => {
  it('drops unsafe-inline, keeps sources, swaps stale hashes', () => {
    const stale = replaceScriptSrc(CSP, ["'sha256-old'"]);
    const next = replaceScriptSrc(stale, ["'sha256-b'", "'sha256-a'"]);
    expect(scriptSrcTokens(next)).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      'https://vercel.live',
      "'sha256-a'",
      "'sha256-b'",
    ]);
    expect(scriptSrcHashes(next)).toEqual(["'sha256-a'", "'sha256-b'"]);
  });

  it('leaves other directives byte-identical', () => {
    const next = replaceScriptSrc(CSP, ["'sha256-a'"]);
    expect(next).toBe(
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://vercel.live 'sha256-a'; style-src 'self' 'unsafe-inline'; report-uri /api/csp-report",
    );
  });

  it('throws without script-src', () => {
    expect(() => replaceScriptSrc("default-src 'self'", [])).toThrow();
  });
});
