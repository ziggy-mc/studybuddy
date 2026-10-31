import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const component = readFileSync(new URL('../components/StudySession.js', import.meta.url), 'utf8');

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

test('standalone flashcards reuse the working Memorization checkpoint card structure', () => {
  assert.match(component, /className="checkpoint-card-stage flashcard-page-card-stage"/);
  assert.ok(component.includes("className={`checkpoint-flashcard flashcard-page-card ${flipped ? 'is-flipped' : ''}`}"));
  assert.match(component, /checkpoint-flashcard-inner flashcard-page-card-inner/);
  assert.match(component, /checkpoint-flashcard-face checkpoint-back/);
  assert.doesNotMatch(component, /className=\{`flashcard \${flipped/);
});

test('standalone flashcard stage fills its available width and stays centered', () => {
  const stage = cssRule('.flashcard-page-card-stage');
  assert.match(stage, /display:\s*block/);
  assert.match(stage, /width:\s*100%/);
  assert.match(stage, /max-width:\s*740px/);
  assert.match(stage, /min-width:\s*0/);
  assert.match(stage, /margin:\s*0 auto/);
});

test('standalone flashcard button and inner face cannot collapse to content width', () => {
  const card = cssRule('.flashcard-page-card');
  const inner = cssRule('.flashcard-page-card .flashcard-page-card-inner');
  for (const rule of [card, inner]) {
    assert.match(rule, /display:\s*block/);
    assert.match(rule, /min-width:\s*0/);
    assert.match(rule, /min-height:\s*235px/);
  }
  assert.match(card, /width:\s*100%/);
  assert.match(inner, /width:\s*100%/);
});

test('long terms and notes wrap by words rather than one character at a time', () => {
  const term = cssRule('.flashcard-page-card .checkpoint-flashcard-face strong');
  const note = cssRule('.flashcard-page-card-note');
  for (const rule of [term, note]) {
    assert.match(rule, /width:\s*100%/);
    assert.match(rule, /min-width:\s*0/);
    assert.match(rule, /overflow-wrap:\s*break-word/);
    assert.match(rule, /word-break:\s*normal/);
  }
});

test('mobile checkpoint-style flashcards retain a usable minimum height', () => {
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.flashcard-page-card, \.flashcard-page-card \.flashcard-page-card-inner \{\s*min-height:\s*210px;/);
});

test('keyboard controls recognize the reused checkpoint flashcard button', () => {
  assert.match(component, /target\.classList\.contains\('checkpoint-flashcard'\)/);
});
