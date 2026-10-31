import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSet, cleanText } from '../lib/validation.js';

test('validates and normalizes a study set', () => {
  const result = validateSet({
    title: ' Biology ',
    description: ' Review set ',
    category: ' Science ',
    tags: [' exam ', 'exam', 'chapter 2'],
    cards: [{ term: ' Cell ', definition: ' Unit of life ', starred: true }],
  });
  assert.equal(result.error, undefined);
  assert.equal(result.value.title, 'Biology');
  assert.equal(result.value.category, 'Science');
  assert.deepEqual(result.value.tags, ['exam', 'chapter 2']);
  assert.equal(result.value.cards[0].starred, true);
});

test('rejects missing titles and incomplete cards', () => {
  assert.ok(validateSet({ title: '', cards: [{ term: 'A', definition: 'B' }] }).error);
  assert.ok(validateSet({ title: 'Set', cards: [{ term: 'A', definition: '' }] }).error);
});

test('enforces the maximum card count', () => {
  const cards = Array.from({ length: 501 }, (_, index) => ({ term: `T${index}`, definition: `D${index}` }));
  assert.match(validateSet({ title: 'Too many', cards }).error, /between 1 and 500/);
});

test('strips null bytes and truncates untrusted text', () => {
  assert.equal(cleanText('A\u0000B', 10), 'AB');
  assert.equal(cleanText('abcdef', 3), 'abc');
});

test('preserves cloud card identifiers and sanitizes saved progress', () => {
  const result = validateSet({
    title: 'Cloud set',
    cards: [
      { id: 'card-1', term: 'A', definition: 'Alpha' },
      { id: 'card-2', term: 'B', definition: 'Beta' },
    ],
    progress: { known: ['card-1', 'missing'], review: ['card-2', 'card-1'], attempts: 8, correct: 5 },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.value.cards.map((card) => card.id), ['card-1', 'card-2']);
  assert.deepEqual(result.value.progress, { known: ['card-1'], review: ['card-2'], attempts: 8, correct: 5 });
});

test('rejects duplicate card identifiers in cloud updates', () => {
  const result = validateSet({
    title: 'Duplicate IDs',
    cards: [
      { id: 'same', term: 'A', definition: 'Alpha' },
      { id: 'same', term: 'B', definition: 'Beta' },
    ],
  });
  assert.match(result.error, /unique identifier/);
});
