import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';
import pool from '../db.js';
import router from '../routes/oauth.js';
import { providers } from '../auth/oauth/providers/index.js';
import { fetchIdentity } from '../auth/oauth/client.js';
import { requestJson } from '../auth/oauth/http.js';
import { diagnoseEnvironment, environmentReport, formatOAuthError, logOAuthError, publicOAuthError } from '../auth/oauth/diagnostics.js';
import { startOAuth, completeOAuth, exchangeOAuthCode } from '../auth/oauth/controller.js';
import { hash, randomSecret, challengeFor } from '../auth/crypto.js';
import { OAUTH_BASE_PATH } from '../auth/oauth/paths.js';
import { parseOAuthError } from '../../frontend/src/components/auth/oauthError.js';
import { redact } from '../auth/oauth/redact.js';

after(() => pool.end());

function configure(t) {
  const values = { NODE_ENV: 'development', FRONTEND_URLS: 'http://localhost:5173,http://localhost:5174', JWT_SECRET: 'diagnostic-jwt-secret', FACEBOOK_API_VERSION: 'v23.0', META_CLIENT_ID: '', META_CLIENT_SECRET: '' };
  for (const [id, provider] of Object.entries(providers)) {
    values[`${provider.env}_CLIENT_ID`] = `client-${id}`;
    values[`${provider.env}_CLIENT_SECRET`] = `secret-${id}`;
    values[`${provider.env}_REDIRECT_URI`] = `http://localhost:4000/api/auth/${id}/callback`;
  }
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  return t.mock.method(console, 'error', () => {});
}

function response() {
  return { statusCode: 200, cookies: {}, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; },
    redirect(url) { this.url = url; return this; }, cookie(name, value) { this.cookies[name] = value; }, clearCookie() {} };
}
const request = (provider = 'google') => ({ params: { provider }, headers: { accept: 'application/json' }, query: { return_to: 'http://localhost:5173/login', challenge: randomSecret() }, body: {} });

test('diagnostico de seis proveedores, alias y variables especificas sin exponer secretos', t => {
  configure(t);
  for (const id of Object.keys(providers)) assert.deepEqual(diagnoseEnvironment(id), []);
  assert.deepEqual(diagnoseEnvironment('meta'), []);
  assert.equal(diagnoseEnvironment('constructor')[0].code, 'UNKNOWN_PROVIDER');
  process.env.GOOGLE_CLIENT_SECRET = 'secret with whitespace';
  delete process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/auth/google/callback';
  const problems = diagnoseEnvironment('google');
  assert.equal(problems.length, 3);
  assert.equal(problems[0].code, 'MISSING_ENV_VAR');
  assert.equal(problems[1].current, '[REDACTED]');
  assert.match(problems[2].expected, /\/api\/auth\/google\/callback/);
  const report = environmentReport();
  assert.equal(report[0].routeMatches, false);
  assert.equal(report[0].providerRegistration, 'not_verified');
  assert.equal(JSON.stringify(report).includes('secret with whitespace'), false);
  process.env.FACEBOOK_API_VERSION = '23';
  assert.equal(diagnoseEnvironment('facebook')[0].variable, 'FACEBOOK_API_VERSION');
});

test('start valida antes de fetch y SQL, con ausencia parcial y total de credenciales', async t => {
  configure(t);
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected fetch'); });
  const sql = t.mock.method(pool, 'query', async () => { throw new Error('Unexpected SQL'); });
  for (const [id, provider] of Object.entries(providers)) {
    delete process.env[`${provider.env}_CLIENT_SECRET`];
    const res = response();
    await startOAuth(request(id), res);
    assert.equal(res.data.oauthError.code, 'MISSING_ENV_VAR');
    assert.equal(res.data.oauthError.details.variable, `${provider.env}_CLIENT_SECRET`);
    delete process.env[`${provider.env}_CLIENT_ID`];
    const unconfigured = response();
    await startOAuth(request(id), unconfigured);
    assert.equal(unconfigured.data.oauthError.code, 'PROVIDER_NOT_CONFIGURED');
  }
  assert.equal(network.mock.callCount(), 0);
  assert.equal(sql.mock.callCount(), 0);
});

test('HTTP conserva estado y cuerpo filtrado, reconoce mismatch y no revela credenciales reflejadas', async t => {
  const logs = configure(t);
  const code = randomSecret(), verifier = randomSecret();
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    error: 'redirect_uri_mismatch', access_token: 'returned-private-token',
    error_description: `callback not registered; secret-google ${code} ${verifier} returned-private-token`,
  }), { status: 400 }));
  let diagnostic;
  try { await fetchIdentity('google', code, verifier); }
  catch (error) { diagnostic = formatOAuthError('callback', 'google', error); }
  assert.equal(diagnostic.stage, 'token_exchange');
  assert.equal(diagnostic.code, 'REDIRECT_URI_MISMATCH');
  assert.equal(diagnostic.details.httpStatus, 400);
  assert.equal(diagnostic.details.providerResponse.error, 'redirect_uri_mismatch');
  assert.match(diagnostic.hint, /Google Cloud/);
  logOAuthError(diagnostic);
  const output = logs.mock.calls[0].arguments.join('');
  for (const secret of ['secret-google', code, verifier, 'returned-private-token']) assert.equal(output.includes(secret), false);
  assert.match(output, /\[OAUTH ERROR\].*stage=token_exchange/);
});

test('errores JSON, HTML, timeouts y perfiles invalidos identifican la etapa correcta', async t => {
  configure(t);
  const network = t.mock.method(globalThis, 'fetch', async () => {});
  for (const [body, expected] of [
    [JSON.stringify({ error: 'invalid_grant' }), 'TOKEN_EXCHANGE_FAILED'],
    [JSON.stringify({ error: 'invalid_client' }), 'INVALID_CLIENT'],
    [JSON.stringify({ error: 'redirect_mismatch' }), 'REDIRECT_URI_MISMATCH'],
    ['<html>invalid redirect_uri</html>', 'REDIRECT_URI_MISMATCH'],
    ['<html>upstream unavailable</html>', 'TOKEN_EXCHANGE_FAILED'],
  ]) {
    network.mock.mockImplementation(async () => new Response(body, { status: 400 }));
    await assert.rejects(fetchIdentity('github', 'code', randomSecret()), error => {
      const diagnostic = formatOAuthError('callback', 'github', error);
      assert.equal(diagnostic.stage, 'token_exchange');
      assert.equal(diagnostic.code, expected);
      return true;
    });
  }
  network.mock.mockImplementation(async (_url, options) => new Response(JSON.stringify(options.method === 'POST' ? { access_token: 'token' } : { error: 'insufficient_scope' }), { status: options.method === 'POST' ? 200 : 403 }));
  await assert.rejects(fetchIdentity('github', 'code', randomSecret()), error => {
    const diagnostic = formatOAuthError('callback', 'github', error);
    assert.equal(diagnostic.stage, 'userinfo');
    assert.equal(diagnostic.code, 'USERINFO_FAILED');
    assert.equal(diagnostic.details.httpStatus, 403);
    return true;
  });
  network.mock.mockImplementation(async () => { throw new DOMException('secret-google', 'TimeoutError'); });
  await assert.rejects(requestJson('https://example.com/token', {}, { stage: 'token_exchange' }), error => {
    const diagnostic = formatOAuthError('callback', 'google', error);
    assert.equal(diagnostic.details.transport, 'timeout');
    assert.equal(diagnostic.details.source, 'network');
    return true;
  });
});

test('endpoint real de Express informa todos los proveedores y devuelve 404 en produccion', async t => {
  configure(t);
  const app = express();
  app.use(OAUTH_BASE_PATH, router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}/api/auth/diagnostics`;
  const res = await fetch(url);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const report = await res.json();
  assert.equal(report.providers.length, 6);
  assert.ok(report.providers.every(item => item.valid && item.routeMatches));
  assert.equal(JSON.stringify(report).includes('secret-google'), false);
  process.env.NODE_ENV = 'production';
  assert.equal((await fetch(url)).status, 404);
});

test('callback invalido da JSON estructurado o fragmento compatible, sin detalles en produccion', async t => {
  configure(t);
  const req = request();
  req.query = { state: 'invalid', code: 'private-code' };
  const res = response();
  await completeOAuth(req, res);
  assert.equal(res.data.oauthError.code, 'INVALID_STATE');
  assert.equal(res.data.oauthError.stage, 'callback');
  process.env.NODE_ENV = 'production';
  req.headers = {};
  const browser = response();
  await completeOAuth(req, browser);
  const fragment = new URLSearchParams(new URL(browser.url).hash.slice(1));
  assert.equal(fragment.get('oauth_error'), 'invalid_state');
  assert.equal(Object.hasOwn(JSON.parse(fragment.get('oauth_diagnostic')), 'details'), false);
  assert.equal(browser.url.includes('private-code'), false);
});

test('callback separa autorizacion remota de vinculacion SQL y conserva state', async t => {
  configure(t);
  const state = randomSecret(), browser = randomSecret(), verifier = randomSecret();
  const row = { provider: 'google', browser_hash: hash(browser), verifier, return_url: 'http://localhost:5173/login', challenge: challengeFor(randomSecret()) };
  const connection = { beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {}, query: async sql => sql.startsWith('SELECT * FROM oauth_states') ? [[row]] : [{ affectedRows: 1 }] };
  const connections = t.mock.method(pool, 'getConnection', async () => connection);
  const req = request();
  req.query = { state, error: 'redirect_uri_mismatch', error_description: `not allowed ${state}` };
  req.headers.cookie = `r6_oauth_google=${browser}`;
  const res = response();
  await completeOAuth(req, res);
  assert.equal(res.data.oauthError.code, 'REDIRECT_URI_MISMATCH');
  assert.equal(res.data.oauthError.stage, 'authorization');
  assert.equal(JSON.stringify(res.data).includes(state), false);

  req.query = { state, code: 'authorized-code' };
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Response(JSON.stringify(options.method === 'POST' ? { access_token: 'token' } : { sub: '123', name: 'Persona' })));
  let calls = 0;
  connections.mock.mockImplementation(async () => {
    if (++calls === 1) return connection;
    throw Object.assign(new Error('SQL with private data'), { code: 'ECONNREFUSED' });
  });
  const db = response();
  await completeOAuth(req, db);
  assert.equal(db.data.oauthError.stage, 'db');
  assert.equal(db.data.oauthError.code, 'DB_ERROR');
  assert.equal(db.data.oauthError.details.operation, 'link_user');
  assert.equal(JSON.stringify(db.data).includes('SQL with private data'), false);

  // Email sigue siendo opcional salvo que la base de datos rechace especificamente email NULL.
  calls = 0;
  connections.mock.mockImplementation(async () => ++calls === 1 ? connection : {
    ...connection, query: async sql => {
      if (sql.startsWith('SELECT')) return [[]];
      throw Object.assign(new Error('private SQL'), { code: 'ER_BAD_NULL_ERROR', sqlMessage: "Column 'email' cannot be null" });
    },
  });
  const emailRequired = response();
  await completeOAuth(req, emailRequired);
  assert.equal(emailRequired.data.oauthError.code, 'EMAIL_REQUIRED');
  assert.equal(emailRequired.data.oauthError.stage, 'db');
});

test('session diagnostica JWT_SECRET y el frontend solo conserva detalles en desarrollo', async t => {
  configure(t);
  delete process.env.JWT_SECRET;
  const req = request();
  req.body = { code: randomSecret(), verifier: randomSecret(), provider: 'github' };
  const res = response();
  await exchangeOAuthCode(req, res);
  assert.equal(res.data.oauthError.stage, 'session');
  assert.equal(res.data.oauthError.provider, 'github');
  assert.equal(res.data.oauthError.details.variable, 'JWT_SECRET');
  assert.equal(res.data.oauthError.code, 'MISSING_ENV_VAR');
  assert.ok(parseOAuthError(res.data.oauthError, true).details);
  assert.equal(Object.hasOwn(parseOAuthError(res.data.oauthError, false), 'details'), false);
  assert.equal(parseOAuthError('{invalid').code, 'CALLBACK_FAILED');
  process.env.NODE_ENV = 'production';
  const publicError = publicOAuthError(res.data.oauthError);
  assert.equal(JSON.stringify(publicError).includes('JWT_SECRET'), false);
  assert.equal(Object.hasOwn(publicError, 'details'), false);
});

test('fallos al firmar JWT se identifican como session y no como error SQL', async t => {
  configure(t);
  const verifier = randomSecret();
  t.mock.method(pool, 'getConnection', async () => ({
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {},
    query: async sql => sql.startsWith('SELECT') ? [[{ id: 123, challenge: challengeFor(verifier) }]] : [{ affectedRows: 1 }],
  }));
  t.mock.method(jwt, 'sign', () => { throw new Error('diagnostic-jwt-secret'); });
  const req = request();
  req.body = { code: randomSecret(), verifier, provider: 'google' };
  const res = response();
  await exchangeOAuthCode(req, res);
  assert.equal(res.data.oauthError.code, 'SESSION_FAILED');
  assert.equal(res.data.oauthError.stage, 'session');
  assert.equal(res.data.oauthError.details.operation, 'sign_jwt');
  assert.equal(JSON.stringify(res.data).includes('diagnostic-jwt-secret'), false);
});

test('redaccion oculta credenciales de URL y acota respuestas remotas grandes', async t => {
  configure(t);
  assert.equal(redact('http://user:private@localhost:4000/callback'), 'http://[REDACTED]@localhost:4000/callback');
  process.env.GOOGLE_CLIENT_SECRET = 'secret&value';
  assert.equal(redact('secret&amp;value'), '[REDACTED]');
  t.mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(70000), { status: 502 }));
  await assert.rejects(requestJson('https://example.com/token', {}, { stage: 'token_exchange' }), error => {
    assert.ok(error.responseBody.length <= 4096);
    assert.equal(error.status, 502);
    return true;
  });
});
