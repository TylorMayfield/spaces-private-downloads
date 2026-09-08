import { createHash, timingSafeEqual } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const EXPIRES_IN = 60;
export const files = Object.freeze({
  'iris-report': Object.freeze({ owner: 'iris', key: 'private/iris/report.txt', filename: 'iris-report.txt' }),
  'milo-report': Object.freeze({ owner: 'milo', key: 'private/milo/report.txt', filename: 'milo-report.txt' }),
});
const noStore = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Authorization',
};
const digest = (value) => createHash('sha256').update(value).digest();

export function allowLocalRequest(request, env = process.env) {
  const host = new URL(request.url).hostname;
  return ['localhost', '127.0.0.1', '[::1]'].includes(host) &&
    (env.NODE_ENV !== 'production' || env.LOCAL_REHEARSAL === '1');
}

export function authenticate(header, env = process.env) {
  const accounts = { iris: env.DEMO_IRIS_PASSWORD, milo: env.DEMO_MILO_PASSWORD };
  if (Object.values(accounts).some((password) => !password || password.length < 24)) {
    throw new Error('Configure both demo passwords with at least 24 characters.');
  }
  if (!header || header.length > 4096 || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(header)) return null;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator === -1) return null;
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  if (!Object.hasOwn(accounts, username)) return null;
  return timingSafeEqual(digest(password), digest(accounts[username])) ? username : null;
}

export function spacesConfig(env = process.env) {
  const region = env.SPACES_REGION;
  const bucket = env.SPACES_BUCKET;
  if (!region || !/^[a-z]{3}[0-9]+$/.test(region)) throw new Error('Invalid Spaces region.');
  if (!bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Use a bucket name without dots.');
  if (!env.SPACES_KEY || !env.SPACES_SECRET) throw new Error('Missing Spaces credentials.');
  return {
    bucket,
    client: new S3Client({
      endpoint: `https://${region}.digitaloceanspaces.com`,
      region: 'us-east-1',
      forcePathStyle: false,
      credentials: { accessKeyId: env.SPACES_KEY, secretAccessKey: env.SPACES_SECRET },
    }),
  };
}

export async function signDownload(file, env = process.env) {
  const { bucket, client } = spacesConfig(env);
  try {
    return await getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket,
      Key: file.key,
      ResponseContentDisposition: `attachment; filename="${file.filename}"`,
      ResponseCacheControl: 'private, no-store',
    }), { expiresIn: EXPIRES_IN });
  } finally {
    client.destroy();
  }
}

function json(body, status, extraHeaders = {}) {
  return Response.json(body, { status, headers: { ...noStore, ...extraHeaders } });
}

// The signer is injectable so tests can prove rejected requests never reach it.
export async function handleDownload(request, id, { env = process.env, sign = signDownload } = {}) {
  if (!allowLocalRequest(request, env)) return json({ error: 'This demo only runs locally.' }, 403);
  try {
    const user = authenticate(request.headers.get('authorization'), env);
    if (!user) return json({ error: 'Sign in with a demo account.' }, 401, {
      'WWW-Authenticate': 'Basic realm="Private download rehearsal", charset="UTF-8"',
    });
    const file = Object.hasOwn(files, id) ? files[id] : null;
    // Same response for a missing ID and a file owned by another account.
    if (!file || file.owner !== user) return json({ error: 'File not found.' }, 404);
    const url = await sign(file, env);
    return json({ url, expiresIn: EXPIRES_IN }, 200);
  } catch {
    // Never log request headers, credentials, signed URLs, or SDK exceptions.
    return json({ error: 'Downloads are unavailable. Check the server configuration.' }, 503);
  }
}
