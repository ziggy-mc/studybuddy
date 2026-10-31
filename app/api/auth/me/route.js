import { getCurrentUser } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { json } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return json({ user: null, cloudCount: 0 });
    const row = getDatabase().prepare('SELECT COUNT(*) AS count FROM study_sets WHERE owner_id = ?').get(user.id);
    return json({ user, cloudCount: row.count });
  } catch (error) {
    console.error('Unable to read current account:', error.message);
    return json({ error: 'Account information is temporarily unavailable.' }, 500);
  }
}
