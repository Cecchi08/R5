import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import authRouter from '../routes/auth.js';
import oauthRouter from '../routes/oauth.js';
import { validEmail, validName, validPassword } from '../auth/validation.js';
import { returnUrl } from '../auth/config.js';
import { providers, providerConfig, authorizationUrl, fetchIdentity } from '../auth/providers.js';
import { hash, challengeFor, socialUser, consumeState, exchangeCode } from '../auth/store.js';

const random = () => randomBytes(32).toString('base64url');
const createdUsers = new Set();
const createdStates = new Set();

async function call(router, method, path, input = {}) {
  const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
  const response = {
    statusCode: 200, cookies: {},
    status(code) { this.statusCode = code; return this; },
    set() { return this; },
    json(data) { this.data = data; return this; },
    redirect(url) { this.url = url; this.statusCode = 302; return this; },
    cookie(name, value, options) { this.cookies[name] = { value, options }; return this; },
    clearCookie(name, options) { this.cleared = { name, options }; return this; },
  };
  const handler = route.stack.at(-1).handle;
  await handler({ body: {}, query: {}, params: {}, headers: {}, ...input }, response, error => { if (error) throw error; });
  return response;
}

after(async () => {
  for (const state of createdStates) await pool.query('DELETE FROM oauth_states WHERE state_hash = ?', [state]);
  for (const id of createdUsers) await pool.query('DELETE FROM users WHERE id = ?', [id]);
  await pool.end();
});

test('validaciones rechazan tipos, formatos, longitudes y contraseñas truncadas por bcrypt', () => {
  for (const value of [null, {}, [], 4, 'a@b', 'a b@c.com', 'x'.repeat(101) + '@a.com']) assert.equal(validEmail(value), false);
  assert.equal(validEmail('mateo@example.com'), true);
  assert.equal(validName('María José'), true);
  assert.equal(validName('1234'), false);
  assert.equal(validName('  '), false);
  for (const value of [null, {}, 'abcdefgh', 'Abc123', 'Ab1' + 'á'.repeat(35)]) assert.equal(validPassword(value), false);
  assert.equal(validPassword('Segura123'), true);
});

test('el retorno OAuth solo admite orígenes y páginas de acceso autorizados', () => {
  assert.equal(returnUrl('http://localhost:5173/login'), 'http://localhost:5173/login');
  for (const value of ['https://evil.example/login', 'http://localhost:5173.evil.example/login', 'http://localhost:5173/admin', '//evil.example', 'http://user@localhost:5173/login', {}]) assert.equal(returnUrl(value), null);
});

test('todos los proveedores intercambian el código y recuperan una identidad', async t => {
  const fixtures = {
    google: { sub: '123', name: 'Usuario Google', email: 'test@example.com', email_verified: true },
    facebook: { id: '123', name: 'Usuario Facebook', email: 'test@example.com' },
    github: { id: 123, login: 'usuario' },
    x: { data: { id: '123', name: 'Usuario X' } },
    discord: { id: '123', username: 'usuario', email: 'test@example.com', verified: true },
    twitch: { data: [{ id: '123', display_name: 'usuario', email: 'test@example.com' }] },
  };
  for (const [id, provider] of Object.entries(providers)) {
    process.env[`${provider.env}_CLIENT_ID`] = 'test-client';
    process.env[`${provider.env}_CLIENT_SECRET`] = 'test-secret';
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      requests.push({ url, options });
      const data = options.method === 'POST' ? { access_token: 'test-access' } : url.endsWith('/user/emails') ? [{ email: 'test@example.com', primary: true, verified: true }] : fixtures[id];
      return { ok: true, json: async () => data };
    });
    const state = random(), verifier = random();
    const authorize = new URL(authorizationUrl(id, state, verifier));
    assert.equal(authorize.searchParams.get('state'), state);
    assert.equal(authorize.searchParams.get('redirect_uri'), `http://localhost:4000/api/auth/${id}/callback`);
    if (provider.pkce) assert.equal(authorize.searchParams.get('code_challenge'), challengeFor(verifier));
    const identity = await fetchIdentity(id, 'provider-code', verifier);
    assert.equal(identity.subject, '123');
    assert.equal(identity.email, id === 'x' ? null : 'test@example.com');
    assert.equal(requests[0].options.body.get('code'), 'provider-code');
    if (provider.pkce) assert.equal(requests[0].options.body.get('code_verifier'), verifier);
    if (id === 'x') assert.match(requests[0].options.headers.Authorization, /^Basic /);
    t.mock.restoreAll();
  }
  assert.equal(providerConfig('__proto__'), null);
});

test('un proveedor con error o sin identificador no permite autenticarse', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  await assert.rejects(fetchIdentity('google', 'code', random()), /provider_failed/);
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async (url, options) => ({ ok: true, json: async () => options.method === 'POST' ? { access_token: 'test' } : { name: 'Sin identificador' } }));
  await assert.rejects(fetchIdentity('google', 'code', random()), /provider_failed/);
});

test('registro e ingreso reales: normalización, hash, duplicados y rol seguro', async () => {
  const email = `r6-test-${randomUUID()}@example.com`;
  const registered = await call(authRouter, 'post', '/register', { body: { nombre: 'Prueba Registro', email: ` ${email.toUpperCase()} `, password: 'Segura123', rol: 'admin' } });
  assert.equal(registered.statusCode, 201);
  createdUsers.add(registered.data.user.id);
  assert.equal(registered.data.user.rol, 'user');
  assert.equal(registered.data.user.email, email);
  const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [registered.data.user.id]);
  assert.notEqual(rows[0].password, 'Segura123');
  assert.match(rows[0].password, /^\$2/);
  const login = await call(authRouter, 'post', '/login', { body: { email, password: 'Segura123' } });
  assert.equal(jwt.verify(login.data.token, process.env.JWT_SECRET).id, registered.data.user.id);
  const wrong = await call(authRouter, 'post', '/login', { body: { email, password: 'Incorrecta123' } });
  assert.equal(wrong.statusCode, 401);
  const duplicate = await call(authRouter, 'post', '/register', { body: { nombre: 'Prueba Registro', email, password: 'Segura123' } });
  assert.equal(duplicate.statusCode, 409);
  const invalid = await call(authRouter, 'post', '/register', { body: { nombre: {}, email: [], password: 123 } });
  assert.equal(invalid.statusCode, 400);
  await assert.rejects(socialUser({ provider: 'google', subject: randomUUID(), nombre: 'Prueba', email }), /account_exists/);
});

test('identidades sociales persistentes, sin correo y sin duplicación', async () => {
  const identity = { provider: 'x', subject: randomUUID(), nombre: 'Usuario X', email: null };
  const user = await socialUser(identity);
  createdUsers.add(user.id);
  assert.equal(user.email, null);
  assert.equal(user.rol, 'user');
  assert.equal((await socialUser(identity)).id, user.id);
  const [rows] = await pool.query('SELECT password FROM users WHERE id = ?', [user.id]);
  assert.equal(rows[0].password, null);
});

test('flujo social completo: state, cookie, retorno, PKCE local y código de un solo uso', async t => {
  const verifier = random();
  const start = await call(oauthRouter, 'get', '/:provider/start', { params: { provider: 'google' }, query: { return_to: 'http://localhost:5174/', challenge: challengeFor(verifier) } });
  const state = new URL(start.url).searchParams.get('state');
  createdStates.add(hash(state));
  const cookie = start.cookies.r6_oauth_google;
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.sameSite, 'lax');
  await assert.rejects(consumeState(state, random(), 'google'), /invalid_state/);
  await assert.rejects(consumeState(state, cookie.value, 'github'), /invalid_state/);
  const subject = randomUUID();
  t.mock.method(globalThis, 'fetch', async (url, options) => ({ ok: true, json: async () => options.method === 'POST' ? { access_token: 'test' } : { sub: subject, name: 'Prueba OAuth' } }));
  const callback = await call(oauthRouter, 'get', '/:provider/callback', { params: { provider: 'google' }, query: { state, code: 'authorized-code' }, headers: { cookie: `r6_oauth_google=${cookie.value}` } });
  assert.equal(new URL(callback.url).origin, 'http://localhost:5174');
  assert.equal(callback.cleared.options.maxAge, undefined);
  const code = new URLSearchParams(new URL(callback.url).hash.slice(1)).get('oauth_code');
  assert.ok(code);
  const [accounts] = await pool.query('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_id = ?', ['google', subject]);
  createdUsers.add(accounts[0].user_id);
  await assert.rejects(consumeState(state, cookie.value, 'google'), /invalid_state/);
  await assert.rejects(exchangeCode(code, random()), /invalid_code/);
  const exchange = await call(oauthRouter, 'post', '/exchange', { body: { code, verifier } });
  assert.equal(exchange.data.user.id, accounts[0].user_id);
  assert.equal(jwt.verify(exchange.data.token, process.env.JWT_SECRET).id, accounts[0].user_id);
  assert.equal((await call(oauthRouter, 'post', '/exchange', { body: { code, verifier } })).statusCode, 401);
});

test('cancelación, vencimiento y proveedores no configurados tienen salida controlada', async () => {
  const verifier = random();
  const input = { params: { provider: 'discord' }, query: { return_to: 'http://localhost:5173/register', challenge: challengeFor(verifier) } };
  const start = await call(oauthRouter, 'get', '/:provider/start', input);
  const state = new URL(start.url).searchParams.get('state');
  createdStates.add(hash(state));
  const cancelled = await call(oauthRouter, 'get', '/:provider/callback', { params: input.params, query: { state, error: 'access_denied' }, headers: { cookie: `r6_oauth_discord=${start.cookies.r6_oauth_discord.value}` } });
  assert.equal(cancelled.url, 'http://localhost:5173/register#oauth_error=cancelled');
  const expired = await call(oauthRouter, 'get', '/:provider/start', input);
  const expiredState = new URL(expired.url).searchParams.get('state');
  createdStates.add(hash(expiredState));
  await pool.query('UPDATE oauth_states SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE state_hash = ?', [hash(expiredState)]);
  await assert.rejects(consumeState(expiredState, expired.cookies.r6_oauth_discord.value, 'discord'), /invalid_state/);
  delete process.env.DISCORD_CLIENT_SECRET;
  const unavailable = await call(oauthRouter, 'get', '/:provider/start', input);
  assert.equal(unavailable.url, 'http://localhost:5173/register#oauth_error=unavailable');
  const malicious = await call(oauthRouter, 'get', '/:provider/start', { ...input, query: { ...input.query, return_to: 'https://evil.example/login' } });
  assert.equal(malicious.statusCode, 400);
});
