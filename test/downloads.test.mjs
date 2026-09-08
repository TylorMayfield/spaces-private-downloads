import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, handleDownload, signDownload, files, spacesConfig } from '../lib/downloads.mjs';

const env = {
  DEMO_IRIS_PASSWORD: 'iris-local-test-password-123456',
  DEMO_MILO_PASSWORD: 'milo-local-test-password-123456',
  SPACES_REGION: 'nyc3', SPACES_BUCKET: 'example-private-downloads',
  SPACES_KEY: 'TESTACCESSKEY', SPACES_SECRET: 'test-secret-not-a-real-cloud-credential',
};
const auth = (name, password = env[`DEMO_${name.toUpperCase()}_PASSWORD`]) => `Basic ${Buffer.from(`${name}:${password}`).toString('base64')}`;
const request = (authorization) => new Request('http://localhost/api/downloads/iris-report', {
  headers: authorization ? { authorization } : {},
});

for (const header of [undefined, 'Bearer iris', 'Basic !!!', auth('iris', 'incorrect'), auth('__proto__', 'anything')]) {
  test(`rejects unauthenticated request ${String(header).slice(0, 14)}`, async () => {
    let called = false;
    const result = await handleDownload(request(header), 'iris-report', { env, sign: async () => { called = true; } });
    assert.equal(result.status, 401);
    assert.equal(called, false);
    assert.match(result.headers.get('www-authenticate'), /^Basic /);
    assert.match(result.headers.get('cache-control'), /no-store/);
  });
}
for (const id of ['milo-report', 'unknown', '../../private/milo/report.txt', '__proto__', 'constructor']) {
  test(`ownership and allowlist reject ${id}`, async () => {
    let called = false;
    const result = await handleDownload(request(auth('iris')), id, { env, sign: async () => { called = true; } });
    assert.equal(result.status, 404);
    assert.deepEqual(await result.json(), { error: 'File not found.' });
    assert.equal(called, false);
  });
}
test('each owner signs only the server-side mapped object', async () => {
  for (const owner of ['iris', 'milo']) {
    let signed;
    const result = await handleDownload(request(auth(owner)), `${owner}-report`, {
      env, sign: async (file) => { signed = file; return 'https://example.invalid/signed'; },
    });
    assert.equal(result.status, 200);
    assert.equal(signed, files[`${owner}-report`]);
    assert.deepEqual(await result.json(), { url: 'https://example.invalid/signed', expiresIn: 60 });
    assert.match(result.headers.get('cache-control'), /private, no-store/);
    assert.equal(result.headers.get('referrer-policy'), 'no-referrer');
  }
});
test('short or missing passwords fail closed', async () => {
  assert.throws(() => authenticate(auth('iris'), { ...env, DEMO_MILO_PASSWORD: '' }));
  const result = await handleDownload(request(auth('iris')), 'iris-report', { env: { ...env, DEMO_IRIS_PASSWORD: 'short' } });
  assert.equal(result.status, 503);
});
test('signer errors reveal no private diagnostic data', async () => {
  const result = await handleDownload(request(auth('iris')), 'iris-report', {
    env, sign: async () => { throw new Error('SECRET_SIGNED_URL'); },
  });
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /SECRET_SIGNED_URL/);
  assert.match(result.headers.get('cache-control'), /no-store/);
});
test('actual SDK signs origin GET for 60 seconds with attachment and no-store', async () => {
  const url = new URL(await signDownload(files['iris-report'], env));
  assert.equal(url.hostname, 'example-private-downloads.nyc3.digitaloceanspaces.com');
  assert.equal(url.pathname, '/private/iris/report.txt');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  assert.equal(url.searchParams.get('response-cache-control'), 'private, no-store');
  assert.equal(url.searchParams.get('response-content-disposition'), 'attachment; filename="iris-report.txt"');
  assert.match(url.searchParams.get('X-Amz-Signature'), /^[0-9a-f]{64}$/);
  assert.ok(!url.toString().includes(env.SPACES_SECRET));
});
test('configuration rejects arbitrary endpoints and dotted bucket names', () => {
  assert.throws(() => spacesConfig({ ...env, SPACES_REGION: 'https://attacker.invalid' }));
  assert.throws(() => spacesConfig({ ...env, SPACES_BUCKET: 'bucket.with.dots' }));
});
test('public hosts and production without explicit local flag are rejected', async () => {
  for (const [url, runtimeEnv] of [
    ['https://demo.example/api/downloads/iris-report', env],
    ['http://localhost/api/downloads/iris-report', { ...env, NODE_ENV: 'production' }],
  ]) {
    let called = false;
    const response = await handleDownload(new Request(url, { headers: { authorization: auth('iris') } }), 'iris-report', {
      env: runtimeEnv, sign: async () => { called = true; },
    });
    assert.equal(response.status, 403);
    assert.equal(called, false);
  }
});
