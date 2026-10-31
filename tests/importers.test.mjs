import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePastedText, spreadsheetCards, pdfItemsToText, extractFile } from '../lib/importers.js';

test('auto-detects term - definition pairs', () => {
  const cards = parsePastedText('Mitosis - Cell division\nMeiosis: Division that produces gametes');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].term, 'Mitosis');
  assert.equal(cards[1].definition, 'Division that produces gametes');
});

test('parses tab separated rows', () => {
  const cards = parsePastedText('Cell\tBasic unit of life\nTissue\tGroup of similar cells');
  assert.equal(cards.length, 2);
  assert.equal(cards[1].term, 'Tissue');
});

test('parses alternating term and definition lines', () => {
  const cards = parsePastedText('Cell\nBasic unit of life\nOrgan\nGroup of tissues', 'alternating');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].definition, 'Basic unit of life');
});

test('uses selected spreadsheet columns and skips headers', () => {
  const cards = spreadsheetCards([['Term', 'Definition', 'Extra'], ['A', 'First', 'x'], ['B', 'Second', 'y']], 0, 1, true);
  assert.equal(cards.length, 2);
  assert.equal(cards[1].definition, 'Second');
});

test('parses explicitly labeled question-and-answer lines', () => {
  const cards = parsePastedText('Question: What is osmosis?\nAnswer: Movement of water across a membrane.\nQuestion: What is diffusion?\nAnswer: Movement from high to low concentration.');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].term, 'What is osmosis?');
  assert.equal(cards[1].definition, 'Movement from high to low concentration.');
});

test('parses separated paragraph blocks', () => {
  const cards = parsePastedText('Mitochondria\nOrganelle that produces most cellular ATP.\n\nRibosome\nStructure where proteins are made.', 'paragraphs');
  assert.equal(cards.length, 2);
  assert.equal(cards[1].term, 'Ribosome');
  assert.equal(cards[1].definition, 'Structure where proteins are made.');
});


test('preserves PDF line breaks so text imports can detect separate cards', () => {
  const text = pdfItemsToText([
    { str: 'Mitosis - Cell division', transform: [1, 0, 0, 1, 50, 700] },
    { str: 'Meiosis - Produces gametes', transform: [1, 0, 0, 1, 50, 680] },
  ]);
  assert.equal(text, 'Mitosis - Cell division\nMeiosis - Produces gametes');
  assert.equal(parsePastedText(text).length, 2);
});

test('reports an empty uploaded file with a useful error', async () => {
  const emptyFile = { name: 'empty.txt', size: 0, text: async () => '' };
  await assert.rejects(extractFile(emptyFile), /file is empty/i);
});

test('extracts a text upload and creates editable card candidates', async () => {
  const content = 'Mitosis - Cell division\nMeiosis - Produces gametes';
  const file = { name: 'biology.txt', size: Buffer.byteLength(content), text: async () => content };
  const result = await extractFile(file);
  assert.equal(result.kind, 'text');
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[1].term, 'Meiosis');
});

test('explains that Drive shortcut files must be exported', async () => {
  const file = { name: 'notes.gdoc', size: 10, text: async () => '' };
  await assert.rejects(extractFile(file), /Google Docs/);
});
