import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChoiceOptions, getMemorizationQuestionType, normalizeAnswer } from '../lib/study.js';

const cards = [
  { id: 'a', term: 'Cell', definition: 'Basic unit of life' },
  { id: 'b', term: 'Tissue', definition: 'Group of similar cells' },
  { id: 'c', term: 'Organ', definition: 'Structure made of tissues' },
  { id: 'd', term: 'Organ system', definition: 'Group of organs working together' },
  { id: 'e', term: 'Organism', definition: 'An individual living thing' },
];

test('builds multiple-choice options with one correct answer and unique distractors', () => {
  const options = buildChoiceOptions(cards, cards[0]);
  assert.equal(options.length, 4);
  assert.equal(options.filter((option) => option.id === 'a').length, 1);
  assert.equal(new Set(options.map((option) => option.id)).size, options.length);
});

test('normalizes typed answers without punctuation differences', () => {
  assert.equal(normalizeAnswer('Water-movement!'), normalizeAnswer('water movement'));
});

test('returns no distractors when every card has the same answer', () => {
  const repeated = [{ id: 'x', definition: 'Same' }, { id: 'y', definition: 'Same' }];
  assert.equal(buildChoiceOptions(repeated, repeated[0]).length, 1);
});


test('creates a flashcard checkpoint after seven completed questions', async () => {
  const { getCheckpointCards } = await import('../lib/study.js');
  const cards = Array.from({ length: 16 }, (_, index) => ({ id: String(index + 1) }));
  assert.equal(getCheckpointCards(cards, 6, 7).length, 0);
  assert.deepEqual(getCheckpointCards(cards, 7, 7).map((card) => card.id), ['1', '2', '3', '4', '5', '6', '7']);
});

test('starts each checkpoint with the next group and includes the final partial group', async () => {
  const { getCheckpointCards } = await import('../lib/study.js');
  const cards = Array.from({ length: 16 }, (_, index) => ({ id: String(index + 1) }));
  assert.deepEqual(getCheckpointCards(cards, 14, 7).map((card) => card.id), ['8', '9', '10', '11', '12', '13', '14']);
  assert.deepEqual(getCheckpointCards(cards, 16, 7).map((card) => card.id), ['15', '16']);
});

test('advanced memorization alternates multiple choice and written recall', () => {
  const cards = [
    { id: 'a', term: 'A', definition: 'Answer A' },
    { id: 'b', term: 'B', definition: 'Answer B' },
    { id: 'c', term: 'C', definition: 'Answer C' },
    { id: 'd', term: 'D', definition: 'Answer D' },
  ];
  assert.equal(getMemorizationQuestionType(cards, 0), 'choice');
  assert.equal(getMemorizationQuestionType(cards, 1), 'typed');
  assert.equal(getMemorizationQuestionType(cards, 2), 'choice');
  assert.equal(getMemorizationQuestionType(cards, 3), 'typed');
});

test('advanced memorization falls back to written recall without distinct choices', () => {
  const cards = [
    { id: 'a', term: 'A', definition: 'Same answer' },
    { id: 'b', term: 'B', definition: 'Same answer' },
  ];
  assert.equal(getMemorizationQuestionType(cards, 0), 'typed');
});
