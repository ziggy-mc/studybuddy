import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDatabase } from '@/lib/db';

const SESSION_COOKIE = 'studydeck_session';
const STATE_COOKIE = 'studydeck_oauth_state';
const SESSION_DAYS = 30;

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function setStateCookie(state) {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, cookieOptions(10 * 60));
}

export async function clearStateCookie() {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, '', cookieOptions(0));
}

export async function getStateCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(STATE_COOKIE)?.value || null;
}

export async function createSession(userId) {
  const db = getDatabase();
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
  db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), userId, hashToken(token), expires.toISOString(), now.toISOString());
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(SESSION_DAYS * 24 * 60 * 60));
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) getDatabase().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  cookieStore.set(SESSION_COOKIE, '', cookieOptions(0));
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDatabase();
  const row = db.prepare(`
    SELECT users.id, users.discord_id, users.display_name, users.avatar_hash, users.created_at, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(hashToken(token));
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    if (row) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    return null;
  }
  return {
    id: row.id,
    discordId: row.discord_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_hash
      ? `https://cdn.discordapp.com/avatars/${row.discord_id}/${row.avatar_hash}.png?size=96`
      : null,
    createdAt: row.created_at,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: Response.json({ error: 'Sign in to use cloud storage.' }, { status: 401 }) };
  return { user, response: null };
}
