import { authenticate, allowLocalRequest } from '../../lib/server-downloads.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', Vary: 'Authorization' };
export async function GET(request) {
  if (!allowLocalRequest(request)) return new Response('This demo only runs locally.', { status: 403, headers });
  try {
    const user = authenticate(request.headers.get('authorization'));
    if (!user) return new Response('Sign in with iris or milo.', { status: 401, headers: {
      ...headers, 'WWW-Authenticate': 'Basic realm="Private download rehearsal", charset="UTF-8"',
    } });
    return new Response(`<!doctype html><html lang="en"><head><meta name="referrer" content="no-referrer"><title>Signed in</title></head><body><p>Signed in as ${user}.</p><a href="/">Return to downloads</a></body></html>`, {
      headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response('Configure both demo passwords before signing in.', { status: 503, headers });
  }
}
