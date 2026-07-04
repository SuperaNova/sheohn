import { expect, test } from 'vitest';
import { tokenize } from './lexer';

test('tokenizes plain space-separated args', () => {
  expect(tokenize('ls projects')).toEqual([['ls', 'projects']]);
});

test('keeps double-quoted spaces in one token', () => {
  expect(tokenize('echo "hello world"')).toEqual([['echo', 'hello world']]);
});

test('keeps single-quoted spaces in one token', () => {
  expect(tokenize("echo 'hello world'")).toEqual([['echo', 'hello world']]);
});

test('handles mixed adjacent quotes joined into one token', () => {
  expect(tokenize(`echo 'foo'"bar"baz`)).toEqual([['echo', 'foobarbaz']]);
});

test('does not split a pipe character inside quotes', () => {
  expect(tokenize('echo "a|b"')).toEqual([['echo', 'a|b']]);
});

test('splits an unquoted pipe into a two-stage pipeline', () => {
  expect(tokenize('cat facts.json | grep -i GDG')).toEqual([
    ['cat', 'facts.json'],
    ['grep', '-i', 'GDG'],
  ]);
});

test('supports a longer pipeline with more than two stages', () => {
  expect(tokenize('ls | grep p | grep r')).toEqual([
    ['ls'],
    ['grep', 'p'],
    ['grep', 'r'],
  ]);
});

test('returns an empty pipeline for empty input', () => {
  expect(tokenize('')).toEqual([]);
});

test('returns an empty pipeline for whitespace-only input', () => {
  expect(tokenize('   \t  ')).toEqual([]);
});

test('trims leading and trailing whitespace around tokens', () => {
  expect(tokenize('   ls   projects   ')).toEqual([['ls', 'projects']]);
});

test('drops empty stages from leading/trailing pipes', () => {
  expect(tokenize('| ls |')).toEqual([['ls']]);
});

test('produces an empty-string token for an empty quoted argument', () => {
  expect(tokenize('echo ""')).toEqual([['echo', '']]);
});
