import { NextResponse } from 'next/server';
import { randomToken, setStateCookie } from '@/lib/auth';
import { clientAddress, json } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(request) {
  const bucket = rateLimit(`oauth:${clientAddress(request)}`, 10, 10 * 60 * 1000);
  if (!bucket.ok) return json({ error: 'Too many sign-in attempts. Please try again shortly.' }, 429);

  const { DISCORD_CLIENT_ID, DISCORD_REDIRECT_URI } = process.env;
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    return json({ error: 'Discord sign-in is not configured yet.' }, 503);
  }

  const state = randomToken(24);
  await setStateCookie(state);
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    redirect_uri: DISCORD_REDIRECT_URI,
    scope: 'identify',
    state,
    prompt: 'consent',
  });
  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
