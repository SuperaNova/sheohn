import { describe, expect, test } from 'vitest';
import {
  computeManifest,
  diffManifests,
  hashFact,
  type ManifestEntry,
} from './brain-diff';

describe('hashFact', () => {
  test('is deterministic for the same text', () => {
    expect(hashFact('My name is Jared.')).toBe(hashFact('My name is Jared.'));
  });

  test('changes when the text changes, even by one character', () => {
    expect(hashFact('My name is Jared.')).not.toBe(
      hashFact('My name is Jared!'),
    );
  });

  test('is prefixed with fact_ and truncated to 12 hex chars', () => {
    const id = hashFact('My name is Jared.');
    expect(id).toMatch(/^fact_[0-9a-f]{12}$/);
  });
});

describe('computeManifest', () => {
  test('maps each fact to its hashed-ID entry, in input order', () => {
    const facts = ['fact one', 'fact two'];
    expect(computeManifest(facts)).toEqual([
      { id: hashFact('fact one') },
      { id: hashFact('fact two') },
    ]);
  });

  test('returns an empty manifest for an empty facts list', () => {
    expect(computeManifest([])).toEqual([]);
  });
});

describe('diffManifests', () => {
  test('no-op diff: identical manifests produce no add/remove', () => {
    const manifest: ManifestEntry[] = computeManifest(['a', 'b']);
    expect(diffManifests(manifest, manifest)).toEqual({
      toAdd: [],
      toRemove: [],
    });
  });

  test('pure addition: a new fact is added with nothing removed', () => {
    const previous = computeManifest(['a']);
    const next = computeManifest(['a', 'b']);
    expect(diffManifests(previous, next)).toEqual({
      toAdd: [{ id: hashFact('b') }],
      toRemove: [],
    });
  });

  test('pure removal: a deleted fact is removed with nothing added', () => {
    const previous = computeManifest(['a', 'b']);
    const next = computeManifest(['a']);
    expect(diffManifests(previous, next)).toEqual({
      toAdd: [],
      toRemove: [{ id: hashFact('b') }],
    });
  });

  test('mixed add+remove: an edited fact removes the old hash and adds the new one', () => {
    const previous = computeManifest(['a', 'b']);
    const next = computeManifest(['a', 'b (edited)']);
    expect(diffManifests(previous, next)).toEqual({
      toAdd: [{ id: hashFact('b (edited)') }],
      toRemove: [{ id: hashFact('b') }],
    });
  });

  test('starting from an empty manifest reports every fact as toAdd', () => {
    const next = computeManifest(['a', 'b', 'c']);
    expect(diffManifests([], next)).toEqual({ toAdd: next, toRemove: [] });
  });
});
