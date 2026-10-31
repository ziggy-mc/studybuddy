import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { clearStateCookie, createSession, getStateCookie } from '@/lib/auth';
import { getDatabase } from '@/lib/db';
import { clientAddress, json } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

function redirectToApp(path = '/') {
  return NextResponse.redirect(new URL(path, process.env.APP_URL || 'http://localhost:3000'));
}

export async function GET(request) {
  const bucket = rateLimit(`oauth-callback:${clientAddress(request)}`, 20, 10 * 60 * 1000);
  if (!bucket.ok) return json({ error: 'Too many sign-in attempts. Please try again shortly.' }, 429);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = await getStateCookie();
  const failed = url.searchParams.has('error');

  const validStateFormat = typeof state === 'string' && /^[a-f0-9]{48}$/i.test(state);
  const suppliedState = validStateFormat ? Buffer.from(state) : Buffer.alloc(0);
  const expectedState = savedState ? Buffer.from(savedState) : Buffer.alloc(0);
  if (failed || !code || !validStateFormat || !savedState || suppliedState.length !== expectedState.length ||
      !crypto.timingSafeEqual(suppliedState, expectedState)) {
    await clearStateCookie();
    return redirectToApp('/?auth=failed');
  }

  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } = process.env;
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_REDIRECT_URI) {
    await clearStateCookie();
    return redirectToApp('/?auth=not-configured');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      cache: 'no-store',
    });
    if (!tokenResponse.ok) throw new Error('Discord token exchange failed');
    const tokenData = await tokenResponse.json();

    const profileResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    });
    if (!profileResponse.ok) throw new Error('Discord profile request failed');
    const profile = await profileResponse.json();
    if (!profile.id || !profile.username) throw new Error('Discord profile was incomplete');

    const db = getDatabase();
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, discord_id, display_name, avatar_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        display_name = excluded.display_name,
        avatar_hash = excluded.avatar_hash
    `).run(userId, String(profile.id), profile.global_name || profile.username, profile.avatar || null, now);
    const user = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(String(profile.id));
    if (!user) throw new Error('Account could not be saved');

    await createSession(user.id);
    await clearStateCookie();
    return redirectToApp('/?auth=success');
  } catch (error) {
    console.error('Discord OAuth callback failed:', error.message);
    await clearStateCookie();
    return redirectToApp('/?auth=failed');
  }
}
