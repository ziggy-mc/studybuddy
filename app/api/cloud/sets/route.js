import crypto from 'node:crypto';
import { getDatabase } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { assertSameOrigin, clientAddress, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { validateSet } from '@/lib/validation';

export const runtime = 'nodejs';

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function rowsToSets(rows) {
  const sets = new Map();
  for (const row of rows) {
    if (!sets.has(row.set_id)) {
      sets.set(row.set_id, {
        id: row.set_id,
        cloudId: row.set_id,
        source: 'cloud',
        title: row.title,
        description: row.description,
        category: row.category || 'Uncategorized',
        tags: parseJson(row.tags_json, []),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastStudiedAt: row.last_studied_at || null,
        progress: parseJson(row.progress_json, { known: [], review: [], attempts: 0, correct: 0 }),
        cards: [],
      });
    }
    if (row.card_id) {
      sets.get(row.set_id).cards.push({
        id: row.card_id,
        term: row.term,
        definition: row.definition,
        notes: row.notes,
        starred: Boolean(row.starred),
        order: row.display_order,
      });
    }
  }
  return [...sets.values()];
}

export async function GET() {
  try {
    const { user, response } = await requireUser();
    if (response) return response;
    const bucket = rateLimit(`cloud-read:${user.id}`, 90, 60_000);
    if (!bucket.ok) return json({ error: 'Too many requests. Please try again shortly.' }, 429);
    const rows = getDatabase().prepare(`
      SELECT s.id AS set_id, s.title, s.description, s.category, s.tags_json,
             s.created_at, s.updated_at, s.progress_json, s.last_studied_at,
             c.id AS card_id, c.term, c.definition, c.notes, c.starred, c.display_order
      FROM study_sets s LEFT JOIN flashcards c ON c.study_set_id = s.id
      WHERE s.owner_id = ? ORDER BY s.updated_at DESC, c.display_order ASC
    `).all(user.id);
    const sets = rowsToSets(rows);
    return json({ sets, count: sets.length, limit: 3 });
  } catch (error) {
    console.error('Cloud set listing failed:', error.message);
    return json({ error: 'Cloud study sets are temporarily unavailable.' }, 500);
  }
}

export async function POST(request) {
  if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const address = clientAddress(request);
  const bucket = rateLimit(`cloud-write:${address}`, 30, 60_000);
  if (!bucket.ok) return json({ error: 'Too many requests. Please try again shortly.' }, 429);

  try {
    const { user, response } = await requireUser();
    if (response) return response;
    const userBucket = rateLimit(`cloud-create:${user.id}`, 20, 60_000);
    if (!userBucket.ok) return json({ error: 'Too many save attempts. Please try again shortly.' }, 429);
    const parsed = validateSet(await readJson(request));
    if (parsed.error) return json({ error: parsed.error }, 400);

    const db = getDatabase();
    const setId = crypto.randomUUID();
    const now = new Date().toISOString();
    let newCount = 0;
    const create = db.transaction(() => {
      const existing = db.prepare('SELECT COUNT(*) AS count FROM study_sets WHERE owner_id = ?').get(user.id);
      if (existing.count >= 3) return false;
      db.prepare(`
        INSERT INTO study_sets (id, owner_id, title, description, created_at, updated_at, category, tags_json, progress_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(setId, user.id, parsed.value.title, parsed.value.description, now, now, parsed.value.category, JSON.stringify(parsed.value.tags), JSON.stringify(parsed.value.progress));
      newCount = existing.count + 1;
      const insertCard = db.prepare(`
        INSERT INTO flashcards (id, study_set_id, term, definition, notes, display_order, starred)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      parsed.value.cards.forEach((card) => insertCard.run(card.id, setId, card.term, card.definition, card.notes, card.order, card.starred ? 1 : 0));
      return true;
    });
    const created = create.immediate();
    if (!created) return json({ error: 'Your cloud storage is full (3/3). Delete a cloud set before saving another.' }, 409);
    return json({ ok: true, id: setId, count: newCount }, 201);
  } catch (error) {
    console.error('Cloud set creation failed:', error.message);
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return json({ error: 'This set could not be saved because one of its card identifiers is already in use. Please retry.' }, 409);
    }
    return json({ error: 'The study set could not be saved.' }, 500);
  }
}
