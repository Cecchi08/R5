import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { providers, providerConfig } from '../auth/oauth/providers/index.js';
import { authorizationUrl, exchangeAuthorizationCode, fetchIdentity } from '../auth/oauth/client.js';
import { challengeFor, randomSecret } from '../auth/crypto.js';
import { requestJson } from '../auth/oauth/http.js';

function configure(t) {
  const previous = {};
  const values = { BACKEND_URL: 'http://localhost:4000', FACEBOOK_API_VERSION: 'v23.0' };
  for (const provider of Object.values(providers)) {
    values[`${provider.env}_CLIENT_ID`] = 'test-client';
    values[`${provider.env}_CLIENT_SECRET`] = 'test-secret';
  }
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
}

test('los seis módulos generan Authorization Code con state, callback y PKCE cuando corresponde', t => {
  configure(t);
  const state = randomSecret(), verifier = randomSecret();
  assert.deepEqual(Object.keys(providers), ['google', 'facebook', 'github', 'x', 'discord', 'twitch']);
  for (const id of Object.keys(providers)) {
    const config = providerConfig(id);
    const url = new URL(authorizationUrl(id, state, verifier));
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), state);
    assert.equal(url.searchParams.get('redirect_uri'), `http://localhost:4000/api/auth/${id}/callback`);
    assert.equal(url.searchParams.get('scope'), config.scope);
    assert.equal(url.searchParams.has('client_secret'), false);
    assert.equal(url.searchParams.get('code_challenge_method'), config.pkce ? 'S256' : null);
  }
  assert.equal(new URL(authorizationUrl('meta', state, verifier)).searchParams.get('redirect_uri'), 'http://localhost:4000/api/auth/facebook/callback');
  assert.equal(new URL(authorizationUrl('twitter', state, verifier)).hostname, 'x.com');
});

test('PKCE usa el vector S256 del RFC 7636 y X rechaza verificadores inválidos antes de acceder a la red', async t => {
  configure(t);
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.equal(challengeFor(verifier), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe haber una petición'); });
  for (const value of [undefined, '', 'short', 'a'.repeat(129), ' '.repeat(43)]) {
    assert.throws(() => authorizationUrl('x', randomSecret(), value), /invalid_verifier/);
    await assert.rejects(exchangeAuthorizationCode('x', 'code', value), /invalid_verifier/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('X envía autenticación Basic y el verificador original en el cuerpo del intercambio', async t => {
  configure(t);
  const verifier = randomSecret();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.x.com/2/oauth2/token');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(Buffer.from(options.headers.Authorization.slice(6), 'base64').toString(), 'test-client:test-secret');
    assert.equal(options.body.get('grant_type'), 'authorization_code');
    assert.equal(options.body.get('code_verifier'), verifier);
    assert.equal(options.body.has('client_secret'), false);
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => ({ access_token: 'token', token_type: 'bearer' }) };
  });
  assert.equal(await exchangeAuthorizationCode('x', 'code', verifier), 'token');
});

test('cada proveedor recupera su perfil con los encabezados correctos y sin exponer tokens en la identidad', async t => {
  configure(t);
  const fixtures = {
    google: { sub: '123', name: 'Persona', email: 'TEST@example.com', email_verified: true },
    facebook: { id: '123', name: 'Persona', email: 'TEST@example.com' },
    github: { id: 123, login: 'persona' },
    x: { data: { id: '123', name: 'Persona' } },
    discord: { id: '123', username: 'persona', email: 'TEST@example.com', verified: true },
    twitch: { data: [{ id: '123', display_name: 'Persona', email: 'TEST@example.com' }] },
  };
  for (const id of Object.keys(providers)) {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      calls.push(url);
      if (options.method === 'POST') {
        if (id !== 'x') assert.equal(options.body.get('client_secret'), 'test-secret');
        return { ok: true, json: async () => ({ access_token: 'private-token' }) };
      }
      assert.equal(options.headers.Authorization, 'Bearer private-token');
      assert.equal(new URL(url).searchParams.has('access_token'), false);
      if (id === 'twitch') assert.equal(options.headers['Client-Id'], 'test-client');
      if (id === 'facebook') assert.equal(new URL(url).searchParams.get('appsecret_proof'), createHmac('sha256', 'test-secret').update('private-token').digest('hex'));
      const data = url.endsWith('/user/emails') ? [{ email: 'TEST@example.com', primary: true, verified: true }] : fixtures[id];
      return { ok: true, json: async () => data };
    });
    const identity = await fetchIdentity(id, 'code', randomSecret());
    assert.equal(identity.provider, id);
    assert.equal(identity.subject, '123');
    assert.equal(identity.email, id === 'x' ? null : 'test@example.com');
    assert.equal(JSON.stringify(identity).includes('private-token'), false);
    assert.equal(calls.length, id === 'github' ? 3 : 2);
    t.mock.restoreAll();
  }
});

test('correos sin verificar no se incorporan a la identidad', async t => {
  configure(t);
  for (const id of ['google', 'discord', 'github']) {
    t.mock.method(globalThis, 'fetch', async (url, options) => ({
      ok: true,
      json: async () => options.method === 'POST' ? { access_token: 'token' }
        : url.endsWith('/user/emails') ? [{ email: 'unverified@example.com', primary: true, verified: false }]
          : { id: '123', sub: '123', name: 'Persona', email: 'unverified@example.com', verified: false, email_verified: false },
    }));
    assert.equal((await fetchIdentity(id, 'code', randomSecret())).email, null);
    t.mock.restoreAll();
  }
});

test('respuestas OAuth inválidas, errores HTTP y fallos de red se convierten en errores controlados', async t => {
  configure(t);
  for (const data of [{ error: 'invalid_grant' }, {}, { access_token: 42 }, { access_token: 'token', token_type: 'mac' }, { access_token: 'token\r\n' }]) {
    t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => data }));
    await assert.rejects(exchangeAuthorizationCode('google', 'code', randomSecret()), /provider_failed/);
    t.mock.restoreAll();
  }
  for (const result of ['http', 'json', 'network', 'redirect']) {
    t.mock.method(globalThis, 'fetch', async () => {
      if (result === 'network' || result === 'redirect') throw new TypeError('fetch failed');
      return { ok: result !== 'http', status: 401, json: async () => { throw new SyntaxError('invalid JSON'); } };
    });
    await assert.rejects(requestJson('https://example.com'), error => error.code === 'provider_failed');
    t.mock.restoreAll();
  }
});

test('proveedores desconocidos o deshabilitados y parámetros vacíos no inician peticiones', async t => {
  configure(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('No debe haber una petición'); });
  for (const id of ['__proto__', 'constructor', 'unknown']) {
    assert.equal(providerConfig(id), null);
    assert.throws(() => authorizationUrl(id, randomSecret(), randomSecret()), /unknown_provider/);
  }
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.throws(() => authorizationUrl('google', randomSecret(), randomSecret()), /unavailable/);
  assert.throws(() => authorizationUrl('x', '', randomSecret()), /invalid_state/);
  await assert.rejects(exchangeAuthorizationCode('x', '', randomSecret()), /invalid_code/);
  assert.equal(fetch.mock.callCount(), 0);
});
