import { getDatabase } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { assertSameOrigin, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
import { validateSet } from '@/lib/validation';

export const runtime = 'nodejs';

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

export async function GET(_request, context) {
  const { id } = await context.params;
  try {
    const user = await getCurrentUser();
    // Deliberately indistinguishable from an unknown ID for guests and non-owners.
    if (!user) return json({ error: 'Study set not found.' }, 404);
    const bucket = rateLimit(`cloud-read-one:${user.id}`, 120, 60_000);
    if (!bucket.ok) return json({ error: 'Too many requests. Please try again shortly.' }, 429);
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT s.id AS set_id, s.title, s.description, s.category, s.tags_json,
             s.created_at, s.updated_at, s.progress_json, s.last_studied_at,
             c.id AS card_id, c.term, c.definition, c.notes, c.starred, c.display_order
      FROM study_sets s LEFT JOIN flashcards c ON c.study_set_id = s.id
      WHERE s.id = ? AND s.owner_id = ? ORDER BY c.display_order ASC
    `).all(id, user.id);
    if (!rows.length) return json({ error: 'Study set not found.' }, 404);
    const first = rows[0];
    return json({
      set: {
        id: first.set_id,
        cloudId: first.set_id,
        source: 'cloud',
        title: first.title,
        description: first.description,
        category: first.category || 'Uncategorized',
        tags: parseJson(first.tags_json, []),
        createdAt: first.created_at,
        updatedAt: first.updated_at,
        lastStudiedAt: first.last_studied_at || null,
        progress: parseJson(first.progress_json, { known: [], review: [], attempts: 0, correct: 0 }),
        cards: rows.filter((row) => row.card_id).map((row) => ({
          id: row.card_id,
          term: row.term,
          definition: row.definition,
          notes: row.notes,
          starred: Boolean(row.starred),
          order: row.display_order,
        })),
      },
    });
  } catch (error) {
    console.error('Cloud set read failed:', error.message);
    return json({ error: 'Study set not found.' }, 404);
  }
}

export async function PUT(request, context) {
  const { id } = await context.params;
  if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Study set not found.' }, 404);
  const bucket = rateLimit(`cloud-update:${user.id}`, 40, 60_000);
  if (!bucket.ok) return json({ error: 'Too many requests. Please try again shortly.' }, 429);

  const parsed = validateSet(await readJson(request));
  if (parsed.error) return json({ error: parsed.error }, 400);
  const db = getDatabase();
  const existing = db.prepare('SELECT id, progress_json FROM study_sets WHERE id = ? AND owner_id = ?').get(id, user.id);
  if (!existing) return json({ error: 'Study set not found.' }, 404);

  try {
    const now = new Date().toISOString();
    const cardIds = new Set(parsed.value.cards.map((card) => card.id));
    const savedProgress = parseJson(existing.progress_json, { known: [], review: [], attempts: 0, correct: 0 });
    const known = (savedProgress.known || []).filter((cardId) => cardIds.has(cardId));
    const knownSet = new Set(known);
    const review = (savedProgress.review || []).filter((cardId) => cardIds.has(cardId) && !knownSet.has(cardId));
    const progress = { ...savedProgress, known, review };
    const update = db.transaction(() => {
      const result = db.prepare(`
        UPDATE study_sets
        SET title = ?, description = ?, category = ?, tags_json = ?, progress_json = ?, updated_at = ?
        WHERE id = ? AND owner_id = ?
      `).run(parsed.value.title, parsed.value.description, parsed.value.category, JSON.stringify(parsed.value.tags), JSON.stringify(progress), now, id, user.id);
      if (!result.changes) return false;
      db.prepare('DELETE FROM flashcards WHERE study_set_id = ?').run(id);
      const insertCard = db.prepare(`
        INSERT INTO flashcards (id, study_set_id, term, definition, notes, display_order, starred)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      parsed.value.cards.forEach((card) => insertCard.run(card.id, id, card.term, card.definition, card.notes, card.order, card.starred ? 1 : 0));
      return true;
    });
    if (!update()) return json({ error: 'Study set not found.' }, 404);
    return json({ ok: true, id, updatedAt: now });
  } catch (error) {
    console.error('Cloud set update failed:', error.message);
    return json({ error: 'The study set could not be updated.' }, 500);
  }
}

export async function PATCH(request, context) {
  const { id } = await context.params;
  if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Study set not found.' }, 404);
  const bucket = rateLimit(`cloud-progress:${user.id}`, 180, 60_000);
  if (!bucket.ok) return json({ error: 'Too many progress updates. Please try again shortly.' }, 429);
  const body = await readJson(request);
  if (!body || !body.progress || typeof body.progress !== 'object' || Array.isArray(body.progress)) {
    return json({ error: 'Invalid study progress.' }, 400);
  }
  try {
    const db = getDatabase();
    const ownedSet = db.prepare('SELECT id FROM study_sets WHERE id = ? AND owner_id = ?').get(id, user.id);
    if (!ownedSet) return json({ error: 'Study set not found.' }, 404);
    const cardIds = new Set(db.prepare('SELECT id FROM flashcards WHERE study_set_id = ?').all(id).map((row) => row.id));
    const incoming = body.progress;
    const known = Array.isArray(incoming.known) ? [...new Set(incoming.known.filter((value) => typeof value === 'string' && cardIds.has(value)))].slice(0, 500) : [];
    const knownSet = new Set(known);
    const review = Array.isArray(incoming.review) ? [...new Set(incoming.review.filter((value) => typeof value === 'string' && cardIds.has(value) && !knownSet.has(value)))].slice(0, 500) : [];
    const previous = db.prepare('SELECT progress_json FROM study_sets WHERE id = ? AND owner_id = ?').get(id, user.id);
    const oldProgress = parseJson(previous.progress_json, {});
    const attempts = Number.isSafeInteger(incoming.attempts) && incoming.attempts >= 0 ? Math.min(incoming.attempts, 1000000000) : oldProgress.attempts || 0;
    const correct = Number.isSafeInteger(incoming.correct) && incoming.correct >= 0 ? Math.min(incoming.correct, attempts) : oldProgress.correct || 0;
    const progress = { known, review, attempts, correct };
    const now = new Date().toISOString();
    db.prepare('UPDATE study_sets SET progress_json = ?, last_studied_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?')
      .run(JSON.stringify(progress), now, now, id, user.id);
    return json({ ok: true, progress, lastStudiedAt: now, updatedAt: now });
  } catch (error) {
    console.error('Cloud progress update failed:', error.message);
    return json({ error: 'Study progress could not be saved.' }, 500);
  }
}

export async function DELETE(request, context) {
  const { id } = await context.params;
  if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: 'Study set not found.' }, 404);
  const bucket = rateLimit(`cloud-delete:${user.id}`, 30, 60_000);
  if (!bucket.ok) return json({ error: 'Too many requests. Please try again shortly.' }, 429);
  const result = getDatabase().prepare('DELETE FROM study_sets WHERE id = ? AND owner_id = ?').run(id, user.id);
  if (!result.changes) return json({ error: 'Study set not found.' }, 404);
  return json({ ok: true });
}
