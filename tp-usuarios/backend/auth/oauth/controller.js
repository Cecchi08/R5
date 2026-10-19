import { providers, providerConfig, canonicalProviderId } from './providers/index.js';
import { authorizationUrl, fetchIdentity } from './client.js';
import { frontendOrigins, returnUrl, callbackUrl } from '../config.js';
import { randomSecret, validSecret } from '../crypto.js';
import { createState, consumeState, socialUser, createLoginCode, exchangeCode } from '../store.js';
import { sessionFor } from '../session.js';
import { OAuthError } from './errors.js';
import { assertEnvironment, environmentReport, formatOAuthError, logOAuthError, publicOAuthError } from './diagnostics.js';
import { redact } from './redact.js';

// Un navegador necesita una redireccion; fetch/Accept: application/json recibe el mismo objeto.
// Se conserva oauth_error para clientes anteriores y se agrega el diagnostico en el fragmento,
// que no se envia como query al servidor del frontend ni en el Referer.
function respondError(req, res, diagnostic, { target, status = 400, json = false } = {}) {
  logOAuthError(diagnostic);
  const error = publicOAuthError(diagnostic);
  if (json || !target || req.headers.accept?.includes('application/json')) {
    return res.status(status).json({ error: error.message, oauthError: error });
  }
  const legacy = { INVALID_STATE: 'invalid_state', AUTHORIZATION_DENIED: 'cancelled', PROVIDER_NOT_CONFIGURED: 'unavailable', MISSING_ENV_VAR: 'unavailable' };
  let payload = JSON.stringify(error);
  // Evitar Location excesivamente grande cuando un proveedor devuelve HTML o muchos detalles.
  if (encodeURIComponent(payload).length > 6000) payload = JSON.stringify({ ...error, details: process.env.NODE_ENV === 'production' ? undefined : { source: error.details.source, truncated: true, note: 'Ver el diagnóstico completo en la consola del backend.' } });
  const fragment = new URLSearchParams({ oauth_error: legacy[error.code] || 'provider_failed', oauth_diagnostic: payload });
  return res.redirect(`${target}#${fragment}`);
}

export function diagnostics(req, res) {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'No encontrado.' });
  return res.json({ providers: environmentReport() });
}

const cookieOptions = provider => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: callbackUrl(provider).startsWith('https:'),
  path: `/api/auth/${provider}`,
});

export function listProviders(req, res) {
  res.json(Object.keys(providers).map(id => ({ id, name: providers[id].name, enabled: providerConfig(id).enabled })));
}

export async function exchangeOAuthCode(req, res) {
  const { code, verifier } = req.body || {};
  // provider es una pista de diagnostico opcional del frontend, nunca una autorizacion.
  const provider = canonicalProviderId(req.body?.provider);
  let stage = 'session', operation = 'validate_login_code';
  try {
    if (!validSecret(code) || !validSecret(verifier)) throw new OAuthError('invalid_request');
    // Validar JWT antes de consumir el codigo para no perderlo por una configuracion faltante.
    if (!process.env.JWT_SECRET?.trim()) throw new OAuthError('session_config', {
      diagnosticCode: 'MISSING_ENV_VAR', problems: [{ code: 'MISSING_ENV_VAR', variable: 'JWT_SECRET', current: process.env.JWT_SECRET ? '[REDACTED]' : null, expected: 'Secreto no vacío para firmar sesiones', message: 'Falta JWT_SECRET.' }],
    });
    stage = 'db'; operation = 'exchange_login_code';
    const user = await exchangeCode(code, verifier);
    stage = 'session'; operation = 'sign_jwt';
    res.json(sessionFor(user));
  } catch (error) {
    if (error.message === 'invalid_code') stage = 'session';
    const diagnostic = formatOAuthError(stage, provider, error, { operation });
    return respondError(req, res, diagnostic, { json: true, status: error.message === 'invalid_code' ? 401 : error.code === 'invalid_request' ? 400 : 500 });
  }
}

export async function startOAuth(req, res) {
  const id = canonicalProviderId(req.params.provider);
  let target, stage = 'authorization', operation = 'validate_environment';
  try {
    if (!providerConfig(id)) throw new OAuthError('unknown_provider');
    target = returnUrl(req.query.return_to);
    if (!target || !validSecret(req.query.challenge)) throw new OAuthError('invalid_request');
    // Todos los problemas locales se detectan antes de generar state o escribir en SQL.
    assertEnvironment(id);
    operation = 'generate_authorization_url';
    const state = randomSecret(), browser = randomSecret(), verifier = randomSecret();
    const destination = authorizationUrl(id, state, verifier);
    stage = 'db'; operation = 'create_state';
    await createState({ state, browser, provider: id, verifier, challenge: req.query.challenge, returnUrl: target });
    stage = 'authorization'; operation = 'redirect_to_provider';
    res.cookie(`r6_oauth_${id}`, browser, { ...cookieOptions(id), maxAge: 10 * 60 * 1000 });
    res.redirect(destination);
  } catch (error) {
    const diagnostic = formatOAuthError(stage, id, error, { operation });
    return respondError(req, res, diagnostic, { target: error.code === 'invalid_request' ? null : target, status: error.code === 'unknown_provider' ? 404 : stage === 'db' ? 500 : 400 });
  }
}

export async function completeOAuth(req, res) {
  const id = canonicalProviderId(req.params.provider);
  let target, stage = 'callback', operation = 'validate_state';
  try {
    target = `${frontendOrigins()[0]}/login`;
    if (!providerConfig(id)) throw new OAuthError('unknown_provider');
    if (!validSecret(req.query.state)) throw new OAuthError('invalid_state');
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`r6_oauth_${id}=`))?.split('=')[1];
    if (!validSecret(cookie)) throw new Error('invalid_state');
    stage = 'db'; operation = 'consume_state';
    const state = await consumeState(req.query.state, cookie, id);
    stage = 'callback'; operation = 'provider_authorization_response';
    target = returnUrl(state.return_url) || target;
    // La eliminacion de cookie no depende de que el env siga siendo valido tras el inicio.
    res.clearCookie(`r6_oauth_${id}`, { httpOnly: true, sameSite: 'lax', path: `/api/auth/${id}` });
    if (req.query.error) throw new OAuthError(req.query.error === 'access_denied' ? 'cancelled' : 'provider_failed', {
      stage: 'authorization', responseBody: redact({ error: req.query.error, error_description: req.query.error_description, error_reason: req.query.error_reason }, [req.query.code, req.query.state, cookie, state.verifier]),
    });
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw new OAuthError('invalid_code');
    stage = 'token_exchange'; operation = 'fetch_identity';
    const identity = await fetchIdentity(id, req.query.code, state.verifier);
    stage = 'db'; operation = 'link_user';
    let user;
    try { user = await socialUser(identity); }
    catch (error) {
      // El esquema actual admite email NULL. Solo diagnosticar EMAIL_REQUIRED si SQL
      // realmente lo rechaza, sin bloquear a X ni a usuarios sociales sin correo.
      if (!identity.email && error.code === 'ER_BAD_NULL_ERROR' && /\bemail\b/i.test(error.sqlMessage || '')) error.diagnosticCode = 'EMAIL_REQUIRED';
      throw error;
    }
    operation = 'create_login_code';
    const code = await createLoginCode(user.id, state.challenge);
    res.redirect(`${target}#oauth_code=${code}`);
  } catch (error) {
    if (error.message === 'invalid_state') stage = 'callback';
    const diagnostic = formatOAuthError(stage, id, error, { operation });
    return respondError(req, res, diagnostic, { target, status: ['db', 'session'].includes(stage) ? 500 : 400 });
  }
}
