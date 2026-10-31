export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const expected = process.env.APP_URL || new URL(request.url).origin;
  try {
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

export function clientAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip'))?.trim() || 'unknown';
}
