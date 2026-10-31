const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportJson(set) {
  const payload = {
    format: 'studydeck-set',
    version: 1,
    exportedAt: new Date().toISOString(),
    studySet: set,
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${safeName(set.title)}.json`);
}

export function exportCsv(set) {
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Term', 'Definition', 'Notes', 'Starred'], ...set.cards.map((card) => [card.term, card.definition, card.notes, card.starred ? 'Yes' : 'No'])];
  const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
  downloadBlob(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `${safeName(set.title)}.csv`);
}

export function safeName(value) {
  return String(value || 'study-set').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'study-set';
}

function validDate(value, fallback) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function cleanTags(tags) {
  return Array.isArray(tags)
    ? [...new Set(tags.slice(0, 20).map((tag) => String(tag ?? '').trim().slice(0, 40)).filter(Boolean))]
    : [];
}

function restoreCardsAndProgress(source) {
  if (!Array.isArray(source.cards) || source.cards.length < 1 || source.cards.length > 500) {
    throw new Error('Each imported study set must contain between 1 and 500 cards.');
  }

  const idMap = new Map();
  const cards = source.cards.map((card, index) => {
    const oldId = card && typeof card.id === 'string' ? card.id : String(index);
    const id = crypto.randomUUID();
    idMap.set(oldId, id);
    return {
      id,
      term: String(card?.term || '').trim().slice(0, 2000),
      definition: String(card?.definition || '').trim().slice(0, 5000),
      notes: String(card?.notes || '').trim().slice(0, 2000),
      starred: Boolean(card?.starred),
      order: index,
    };
  }).filter((card) => card.term && card.definition);

  if (!cards.length) throw new Error('No valid term-and-definition cards were found in this file.');

  const oldIds = new Set(cards.map((card) => card.id));
  const mapProgressIds = (values) => Array.isArray(values)
    ? [...new Set(values.map((value) => idMap.get(String(value))).filter((id) => id && oldIds.has(id)))]
    : [];
  const progress = source.progress && typeof source.progress === 'object' ? source.progress : {};

  return {
    cards,
    progress: {
      known: mapProgressIds(progress.known),
      review: mapProgressIds(progress.review),
      attempts: Math.max(0, Math.floor(Number(progress.attempts) || 0)),
      correct: Math.max(0, Math.floor(Number(progress.correct) || 0)),
    },
  };
}

export async function importJsonFile(file) {
  if (!file || file.size > MAX_BACKUP_BYTES) throw new Error('This JSON file is larger than 20 MB.');
  const raw = JSON.parse(await file.text());
  const set = raw?.format === 'studydeck-set' ? raw.studySet : raw?.studySet || raw;
  if (!set || typeof set !== 'object' || Array.isArray(set)) throw new Error('This JSON file is not a valid StudyDeck export.');

  const restored = restoreCardsAndProgress(set);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: String(set.title || 'Imported study set').slice(0, 120),
    description: String(set.description || '').slice(0, 1000),
    category: String(set.category || 'Uncategorized').slice(0, 80),
    tags: cleanTags(set.tags),
    createdAt: validDate(set.createdAt, now),
    updatedAt: now,
    lastStudiedAt: validDate(set.lastStudiedAt, null),
    ...restored,
    source: 'local',
  };
}

export function exportLibrary(sets) {
  const payload = {
    format: 'studydeck-library',
    version: 1,
    exportedAt: new Date().toISOString(),
    studySets: sets,
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'studydeck-library-backup.json');
}

export async function importLibraryFile(file) {
  if (!file || file.size > MAX_BACKUP_BYTES) throw new Error('This library backup is larger than 20 MB.');
  const raw = JSON.parse(await file.text());
  const sourceSets = raw?.format === 'studydeck-library' ? raw.studySets : null;
  if (!Array.isArray(sourceSets)) throw new Error('This file is not a StudyDeck library backup. Export your library as JSON and try again.');
  if (sourceSets.length > 500) throw new Error('This backup contains too many study sets.');
  const now = new Date().toISOString();
  const imported = [];
  for (const source of sourceSets) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const restored = restoreCardsAndProgress(source);
    imported.push({
      id: crypto.randomUUID(),
      title: String(source.title || 'Imported study set').slice(0, 120),
      description: String(source.description || '').slice(0, 1000),
      category: String(source.category || 'Uncategorized').slice(0, 80),
      tags: cleanTags(source.tags),
      createdAt: validDate(source.createdAt, now),
      updatedAt: now,
      lastStudiedAt: validDate(source.lastStudiedAt, null),
      ...restored,
      source: 'local',
    });
  }
  if (!imported.length) throw new Error('No valid study sets were found in the backup.');
  return imported;
}
