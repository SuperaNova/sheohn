import { expect, test } from 'vitest';
import { linkify } from './linkify';

test('plain text passes through untouched', () => {
  expect(linkify('just some plain text')).toEqual([
    { kind: 'text', value: 'just some plain text' },
  ]);
});

test('a markdown link parses to a link segment', () => {
  expect(linkify('[click here](https://sheohn.dev)')).toEqual([
    { kind: 'link', label: 'click here', href: 'https://sheohn.dev/' },
  ]);
});

test('a javascript: URL in markdown form degrades to text', () => {
  const input = '[click me](javascript:xss)';
  expect(linkify(input)).toEqual([{ kind: 'text', value: input }]);
});

test('a bare javascript: URL degrades to text', () => {
  // The bare-URL branch of the regex only matches http(s), so a bare
  // javascript: URL is never treated as a URL candidate at all — it stays
  // as plain text end-to-end.
  const input = "javascript:alert('x')";
  expect(linkify(input)).toEqual([{ kind: 'text', value: input }]);
});

test('a bare https URL becomes a link', () => {
  expect(linkify('visit https://sheohn.dev today')).toEqual([
    { kind: 'text', value: 'visit ' },
    { kind: 'link', label: 'https://sheohn.dev', href: 'https://sheohn.dev/' },
    { kind: 'text', value: ' today' },
  ]);
});

test('a bare URL with a trailing period links without the period', () => {
  expect(linkify('see https://sheohn.dev.')).toEqual([
    { kind: 'text', value: 'see ' },
    { kind: 'link', label: 'https://sheohn.dev', href: 'https://sheohn.dev/' },
    { kind: 'text', value: '.' },
  ]);
});

test('multiple trailing punctuation characters are fully stripped', () => {
  expect(linkify('is this it https://sheohn.dev?!')).toEqual([
    { kind: 'text', value: 'is this it ' },
    { kind: 'link', label: 'https://sheohn.dev', href: 'https://sheohn.dev/' },
    { kind: 'text', value: '?!' },
  ]);
});

test('text before and after a link is segmented correctly', () => {
  expect(linkify('start [mid](https://sheohn.dev) end')).toEqual([
    { kind: 'text', value: 'start ' },
    { kind: 'link', label: 'mid', href: 'https://sheohn.dev/' },
    { kind: 'text', value: ' end' },
  ]);
});

test('mailto: works in markdown form', () => {
  expect(linkify('[email me](mailto:hello@sheohn.dev)')).toEqual([
    { kind: 'link', label: 'email me', href: 'mailto:hello@sheohn.dev' },
  ]);
});
