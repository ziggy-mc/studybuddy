import test from 'node:test';
import assert from 'node:assert/strict';
import { importJsonFile, importLibraryFile } from '../lib/export.js';

function makeFile(value) {
  const text = JSON.stringify(value);
  return { size: Buffer.byteLength(text), text: async () => text };
}

const sourceSet = {
  title: 'Biology',
  description: 'Chapter review',
  category: 'Science',
  tags: ['exam'],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastStudiedAt: '2026-02-01T00:00:00.000Z',
  cards: [
    { id: 'old-a', term: 'Cell', definition: 'Basic unit of life', starred: true },
    { id: 'old-b', term: 'Tissue', definition: 'Group of similar cells' },
  ],
  progress: { known: ['old-a'], review: ['old-b'], attempts: 8, correct: 6 },
};

test('imports one set with remapped card IDs and restored progress', async () => {
  const result = await importJsonFile(makeFile({ format: 'studydeck-set', version: 1, studySet: sourceSet }));
  assert.equal(result.title, 'Biology');
  assert.notEqual(result.cards[0].id, 'old-a');
  assert.deepEqual(result.progress.known, [result.cards[0].id]);
  assert.deepEqual(result.progress.review, [result.cards[1].id]);
  assert.equal(result.progress.attempts, 8);
  assert.equal(result.progress.correct, 6);
  assert.equal(result.lastStudiedAt, sourceSet.lastStudiedAt);
});

test('imports a library backup without retaining cloud links', async () => {
  const result = await importLibraryFile(makeFile({ format: 'studydeck-library', studySets: [{ ...sourceSet, cloudId: 'remote-id' }] }));
  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'local');
  assert.equal('cloudId' in result[0], false);
  assert.deepEqual(result[0].progress.review, [result[0].cards[1].id]);
});

test('rejects oversized library backups', async () => {
  await assert.rejects(importLibraryFile({ size: 21 * 1024 * 1024, text: async () => '{}' }), /larger than 20 MB/);
});
