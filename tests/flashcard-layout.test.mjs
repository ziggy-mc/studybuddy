import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

test('dedicated flashcard stage cannot shrink to its text content', () => {
  const stage = cssRule('.flashcard-stage');
  assert.match(stage, /display:\s*grid/);
  assert.match(stage, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(stage, /width:\s*100%/);
  assert.match(stage, /max-width:\s*740px/);
  assert.match(stage, /min-width:\s*0/);
});

test('dedicated flashcard has a defined responsive box size', () => {
  const card = cssRule('.flashcard-session .flashcard');
  assert.match(card, /width:\s*100%/);
  assert.match(card, /min-width:\s*0/);
  assert.match(card, /height:\s*330px/);
  assert.match(card, /flex:\s*0\s+0\s+auto/);
  assert.doesNotMatch(card, /overflow-wrap:\s*anywhere/);
});

test('flashcard text uses normal word wrapping instead of inherited anywhere wrapping', () => {
  const term = cssRule('.flashcard-face > strong');
  const notes = cssRule('.flashcard-face > small');
  const hint = cssRule('.flashcard-face > .flip-hint');

  for (const rule of [term, notes, hint]) {
    assert.match(rule, /width:\s*100%/);
    assert.match(rule, /min-width:\s*0/);
    assert.match(rule, /overflow-wrap:\s*break-word/);
    assert.match(rule, /word-break:\s*normal/);
  }
});

test('mobile flashcards keep a usable fixed card height', () => {
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.flashcard-session \.flashcard\s*\{[^}]*height:\s*280px;[^}]*min-height:\s*280px;/);
});
