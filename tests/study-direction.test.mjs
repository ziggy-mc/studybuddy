import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildChoiceOptions,
  getAnswerText,
  getQuestionText,
  resolveAnswerSide,
  selectQuestionCards,
} from '../lib/study.js';

const cards = [
  { id: 'a', term: 'Mitochondria', definition: 'Produces most cellular ATP' },
  { id: 'b', term: 'Ribosome', definition: 'Builds proteins' },
  { id: 'c', term: 'Nucleus', definition: 'Stores most of the cell DNA' },
  { id: 'd', term: 'Cell membrane', definition: 'Controls what enters and leaves' },
  { id: 'e', term: 'Cytoplasm', definition: 'Jelly-like fluid inside the cell' },
  { id: 'f', term: 'Chloroplast', definition: 'Site of photosynthesis' },
];

test('answer direction maps the visible prompt and expected answer correctly', () => {
  assert.equal(getQuestionText(cards[0], 'definition'), 'Mitochondria');
  assert.equal(getAnswerText(cards[0], 'definition'), 'Produces most cellular ATP');
  assert.equal(getQuestionText(cards[0], 'term'), 'Produces most cellular ATP');
  assert.equal(getAnswerText(cards[0], 'term'), 'Mitochondria');
});

test('random answer direction resolves to one of the two supported sides', () => {
  for (let index = 0; index < 100; index += 1) {
    assert.ok(['term', 'definition'].includes(resolveAnswerSide('random')));
  }
});

test('multiple-choice distractors use the selected answer side', () => {
  const choices = buildChoiceOptions(cards, cards[0], 'term');
  assert.equal(choices.length, 4);
  assert.ok(choices.some((choice) => choice.id === cards[0].id));
  assert.equal(new Set(choices.map((choice) => choice.term)).size, choices.length);
});

test('practice-test retry uses a completely fresh question group when enough unseen cards remain', () => {
  const previous = ['a', 'b', 'c'];
  for (let run = 0; run < 100; run += 1) {
    const selected = selectQuestionCards(cards, 3, previous);
    assert.equal(selected.length, 3);
    assert.equal(new Set(selected.map((card) => card.id)).size, 3);
    assert.ok(selected.every((card) => !previous.includes(card.id)));
  }
});

test('practice-test retry uses all remaining unseen cards before reusing prior questions', () => {
  const selected = selectQuestionCards(cards.slice(0, 4), 3, ['a', 'b', 'c']);
  assert.equal(selected.length, 3);
  assert.ok(selected.some((card) => card.id === 'd'));
});

test('full-set retry changes order when a random shuffle returns the same order', () => {
  const sameOrder = cards.map((card) => card.id);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.999999;
    const selected = selectQuestionCards(cards, cards.length, sameOrder);
    assert.notDeepEqual(selected.map((card) => card.id), sameOrder);
  } finally {
    Math.random = originalRandom;
  }
});

test('test setup passes the full question pool and supports direction selection for every study setup', () => {
  const workspace = readFileSync(new URL('../components/SetWorkspace.js', import.meta.url), 'utf8');
  assert.match(workspace, /setupMode === 'test' \|\| setupMode === 'matching'\s*\? \[\.\.\.readyCards\]/);
  assert.match(workspace, /What should you answer\?/);
  assert.match(workspace, /setAnswerSide\('definition'\)/);
  assert.match(workspace, /setAnswerSide\('term'\)/);
  assert.match(workspace, /setAnswerSide\('random'\)/);
});

test('study session uses prompt direction for Learn, test questions, checkpoint cards, and matching', () => {
  const session = readFileSync(new URL('../components/StudySession.js', import.meta.url), 'utf8');
  assert.match(session, /getQuestionText\(current, learnAnswerSide\)/);
  assert.match(session, /getAnswerText\(current, learnAnswerSide\)/);
  assert.match(session, /getQuestionText\(testQuestion\?\.card, testQuestion\?\.answerSide\)/);
  assert.match(session, /getAnswerText\(testQuestion\.card, testQuestion\.answerSide\)/);
  assert.match(session, /createMatching\(cards, options\.answerSide, matching\.selectedCardIds\)/);
  assert.match(session, /matching\.left\.length/);
  assert.match(session, /matching\.right\.map/);
  assert.doesNotMatch(session, /matching\.(terms|definitions)/);
  assert.match(session, /matching-column-label">Prompts/);
  assert.match(session, /matching-column-label">Answers/);
});

test('mobile editor places card actions below the full-width question and answer fields', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.workspace-card > label:nth-of-type\(1\), \.workspace-card > label:nth-of-type\(2\), \.workspace-card \.card-notes-field \{ grid-column: 2; grid-row: auto; width: 100%; min-width: 0; padding-right: 0;/);
  assert.match(css, /\.workspace-card \.edit-card-actions \{ grid-column: 2; grid-row: auto; justify-self: start;/);
  assert.doesNotMatch(css, /\.edit-card-row label:nth-of-type\(1\) \{ padding-right: 105px; \}/);
});
