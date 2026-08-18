import { describe, expect, test } from 'vitest';
import { buildKnownRoutes, isKnownRoute, normalizeRoute } from './rum-routes';

describe('buildKnownRoutes', () => {
  test('combines static routes with per-project routes', () => {
    expect(buildKnownRoutes([{ id: 'animo' }, { id: 'crucible' }])).toEqual([
      '/',
      '/about',
      '/projects',
      '/projects/animo',
      '/projects/crucible',
    ]);
  });

  test('is just the static routes with no projects', () => {
    expect(buildKnownRoutes([])).toEqual(['/', '/about', '/projects']);
  });
});

describe('normalizeRoute', () => {
  test('passes a clean path through unchanged', () => {
    expect(normalizeRoute('/about')).toBe('/about');
  });

  test('strips a query string', () => {
    expect(normalizeRoute('/projects?utm_source=x')).toBe('/projects');
  });

  test('strips a hash fragment', () => {
    expect(normalizeRoute('/about#bio')).toBe('/about');
  });

  test('strips both query and hash together', () => {
    expect(normalizeRoute('/projects/animo?ref=x#top')).toBe('/projects/animo');
  });

  test('strips a trailing slash on a non-root path', () => {
    expect(normalizeRoute('/projects/')).toBe('/projects');
  });

  test('keeps the root path as a single slash', () => {
    expect(normalizeRoute('/')).toBe('/');
  });

  test('root with only a query string still normalizes to /', () => {
    expect(normalizeRoute('/?theme=dark')).toBe('/');
  });
});

describe('isKnownRoute', () => {
  const known = buildKnownRoutes([{ id: 'animo' }]);

  test('accepts an exact known route', () => {
    expect(isKnownRoute('/projects/animo', known)).toBe(true);
  });

  test('accepts a known route with query/hash noise, matching after normalizing', () => {
    expect(isKnownRoute('/about?x=1#y', known)).toBe(true);
  });

  test('rejects an unknown path', () => {
    expect(isKnownRoute('/projects/not-a-real-slug', known)).toBe(false);
  });

  test('rejects an arbitrary attacker-controlled string', () => {
    expect(isKnownRoute('/../../etc/passwd', known)).toBe(false);
    expect(isKnownRoute('https://evil.example.com', known)).toBe(false);
  });
});
