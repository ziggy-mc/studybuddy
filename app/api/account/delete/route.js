import { destroySession, requireUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { assertSameOrigin, json, readJson } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function DELETE(request) {
  if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const { user, response } = await requireUser();
  if (response) return response;
  const bucket = rateLimit(`account-delete:${user.id}`, 3, 60 * 60 * 1000);
  if (!bucket.ok) return json({ error: 'Too many account deletion attempts. Please try again later.' }, 429);
  const body = await readJson(request);
  if (body?.confirm !== 'DELETE') return json({ error: 'Confirmation is required.' }, 400);
  getDatabase().prepare('DELETE FROM users WHERE id = ?').run(user.id);
  await destroySession();
  return json({ ok: true });
}
