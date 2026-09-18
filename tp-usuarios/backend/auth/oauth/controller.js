import { providers, providerConfig, canonicalProviderId } from './providers/index.js';
import { authorizationUrl, fetchIdentity } from './client.js';
import { frontendOrigins, returnUrl, callbackUrl } from '../config.js';
import { randomSecret, validSecret } from '../crypto.js';
import { createState, consumeState, socialUser, createLoginCode, exchangeCode } from '../store.js';
import { sessionFor } from '../session.js';

const cookieOptions = provider => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: callbackUrl(provider).startsWith('https:'),
  path: `/api/auth/${provider}`,
});

export function listProviders(req, res) {
  res.json(Object.keys(providers).map(id => ({ id, name: providers[id].name, enabled: providerConfig(id).enabled })));
}

export async function exchangeOAuthCode(req, res, next) {
  const { code, verifier } = req.body || {};
  if (!validSecret(code) || !validSecret(verifier)) return res.status(400).json({ error: 'El acceso social expiró. Volvé a intentarlo.' });
  try {
    res.json(sessionFor(await exchangeCode(code, verifier)));
  } catch (error) {
    if (error.message === 'invalid_code') return res.status(401).json({ error: 'El acceso social expiró o ya fue utilizado. Volvé a intentarlo.' });
    next(error);
  }
}

export async function startOAuth(req, res, next) {
  const id = canonicalProviderId(req.params.provider);
  const config = providerConfig(id);
  const target = returnUrl(req.query.return_to);
  if (!config) return res.status(404).json({ error: 'Proveedor desconocido.' });
  if (!target || !validSecret(req.query.challenge)) return res.status(400).json({ error: 'Solicitud de acceso inválida.' });
  if (!config.enabled) return res.redirect(`${target}#oauth_error=unavailable`);
  try {
    const state = randomSecret(), browser = randomSecret(), verifier = randomSecret();
    const destination = authorizationUrl(id, state, verifier);
    await createState({ state, browser, provider: id, verifier, challenge: req.query.challenge, returnUrl: target });
    res.cookie(`r6_oauth_${id}`, browser, { ...cookieOptions(id), maxAge: 10 * 60 * 1000 });
    res.redirect(destination);
  } catch (error) { next(error); }
}

export async function completeOAuth(req, res) {
  const id = canonicalProviderId(req.params.provider);
  let target = `${frontendOrigins()[0]}/login`;
  try {
    if (!providerConfig(id) || !validSecret(req.query.state)) throw new Error('invalid_state');
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`r6_oauth_${id}=`))?.split('=')[1];
    if (!validSecret(cookie)) throw new Error('invalid_state');
    const state = await consumeState(req.query.state, cookie, id);
    target = returnUrl(state.return_url) || target;
    res.clearCookie(`r6_oauth_${id}`, cookieOptions(id));
    if (req.query.error) throw new Error('cancelled');
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw new Error('provider_failed');
    const user = await socialUser(await fetchIdentity(id, req.query.code, state.verifier));
    const code = await createLoginCode(user.id, state.challenge);
    res.redirect(`${target}#oauth_code=${code}`);
  } catch (error) {
    const reason = ['invalid_state', 'cancelled', 'account_exists', 'unavailable'].includes(error.message) ? error.message : 'provider_failed';
    res.redirect(`${target}#oauth_error=${reason}`);
  }
}
