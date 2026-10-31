import { destroySession } from '@/lib/auth';
import { assertSameOrigin, json } from '@/lib/http';

export const runtime = 'nodejs';

export async function POST(request) {
  if (!assertSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  await destroySession();
  return json({ ok: true });
}
