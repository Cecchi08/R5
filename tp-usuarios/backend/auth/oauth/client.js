import { callbackUrl } from '../config.js';
import { challengeFor, validVerifier } from '../crypto.js';
import { normalizeEmail, validEmail } from '../validation.js';
import { providerConfig } from './providers/index.js';
import { requestJson } from './http.js';
import { OAuthError } from './errors.js';

function configuredProvider(id) {
  const config = providerConfig(id);
  if (!config) throw new OAuthError('unknown_provider');
  if (!config.enabled) throw new OAuthError('unavailable', { provider: config.id });
  return config;
}

function checkVerifier(config, verifier) {
  if (config.pkce && !validVerifier(verifier)) throw new OAuthError('invalid_verifier', { provider: config.id });
}

export function authorizationUrl(id, state, verifier) {
  const config = configuredProvider(id);
  if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(state)) throw new OAuthError('invalid_state');
  checkVerifier(config, verifier);
  const url = new URL(config.authorize);
  url.search = new URLSearchParams({
    ...config.authorizationParams,
    client_id: config.clientId,
    redirect_uri: callbackUrl(config.id),
    response_type: 'code',
    scope: config.scope,
    state,
  }).toString();
  if (config.pkce) {
    url.searchParams.set('code_challenge', challengeFor(verifier));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  return url.toString();
}

export async function exchangeAuthorizationCode(id, code, verifier) {
  const config = configuredProvider(id);
  if (typeof code !== 'string' || !code || code.length > 4096) throw new OAuthError('invalid_code');
  checkVerifier(config, verifier);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(config.id),
    client_id: config.clientId,
  });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (config.basic) {
    const encode = value => new URLSearchParams({ value }).toString().slice(6);
    headers.Authorization = `Basic ${Buffer.from(`${encode(config.clientId)}:${encode(config.clientSecret)}`).toString('base64')}`;
  } else {
    body.set('client_secret', config.clientSecret);
  }
  if (config.pkce) body.set('code_verifier', verifier);
  const token = await requestJson(config.token, { method: 'POST', body, headers });
  if (typeof token.access_token !== 'string' || !token.access_token || /[\r\n]/.test(token.access_token)
    || (token.token_type && String(token.token_type).toLowerCase() !== 'bearer')) {
    throw new OAuthError('provider_failed', { provider: config.id });
  }
  return token.access_token;
}

export async function fetchIdentity(id, code, verifier) {
  const config = configuredProvider(id);
  const accessToken = await exchangeAuthorizationCode(config.id, code, verifier);
  const { subject, name, email: rawEmail } = await config.getProfile(accessToken, config);
  if (!['string', 'number'].includes(typeof subject) || !/^[\x21-\x7E]{1,255}$/.test(String(subject))
    || (typeof subject === 'number' && !Number.isSafeInteger(subject))) {
    throw new OAuthError('provider_failed', { provider: config.id });
  }
  const email = normalizeEmail(rawEmail);
  return {
    provider: config.id,
    subject: String(subject),
    nombre: (typeof name === 'string' ? name.trim() : '').slice(0, 50) || config.name,
    email: validEmail(email) ? email : null,
  };
}
