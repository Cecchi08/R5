import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pool from '../db.js';
import { providers, providerConfig, authorizationUrl, fetchIdentity } from '../auth/providers.js';
import { frontendOrigins, returnUrl, callbackUrl } from '../auth/config.js';
import { hash, consumeState, socialUser, exchangeCode } from '../auth/store.js';
import { sessionFor } from '../auth/session.js';
import { authLimit } from '../middleware/authLimit.js';

const router = Router();
const random = () => randomBytes(32).toString('base64url');
const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const canonical = value => value === 'meta' ? 'facebook' : value;
const cookieOptions = provider => ({ httpOnly: true, sameSite: 'lax', secure: callbackUrl(provider).startsWith('https:'), path: `/api/auth/${provider}`, maxAge: 10 * 60 * 1000 });

router.use((req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next(); });
router.get('/providers', (req, res) => res.json(Object.keys(providers).map(id => ({ id, name: providers[id].name, enabled: providerConfig(id).enabled }))));

router.post('/exchange', authLimit, async (req, res, next) => {
  const { code, verifier } = req.body || {};
  if (!validSecret(code) || !validSecret(verifier)) return res.status(400).json({ error: 'El acceso social expiró. Volvé a intentarlo.' });
  try { res.json(sessionFor(await exchangeCode(code, verifier))); }
  catch (error) {
    if (error.message === 'invalid_code') return res.status(401).json({ error: 'El acceso social expiró o ya fue utilizado. Volvé a intentarlo.' });
    next(error);
  }
});

router.get('/:provider/start', authLimit, async (req, res, next) => {
  const id = canonical(req.params.provider);
  const config = providerConfig(id);
  const target = returnUrl(req.query.return_to);
  if (!config) return res.status(404).json({ error: 'Proveedor desconocido.' });
  if (!target || !validSecret(req.query.challenge)) return res.status(400).json({ error: 'Solicitud de acceso inválida.' });
  if (!config.enabled) return res.redirect(`${target}#oauth_error=unavailable`);
  try {
    const state = random(), browser = random(), verifier = random();
    await pool.query('DELETE FROM oauth_states WHERE expires_at <= NOW()');
    await pool.query('DELETE FROM oauth_codes WHERE expires_at <= NOW()');
    await pool.query('INSERT INTO oauth_states (state_hash, browser_hash, provider, verifier, challenge, return_url, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [hash(state), hash(browser), id, verifier, req.query.challenge, target]);
    res.cookie(`r6_oauth_${id}`, browser, cookieOptions(id));
    res.redirect(authorizationUrl(id, state, verifier));
  } catch (error) { next(error); }
});

router.get('/:provider/callback', async (req, res) => {
  const id = canonical(req.params.provider);
  let target = `${frontendOrigins()[0]}/login`;
  try {
    if (!providerConfig(id) || !validSecret(req.query.state)) throw new Error('invalid_state');
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`r6_oauth_${id}=`))?.split('=')[1];
    if (!validSecret(cookie)) throw new Error('invalid_state');
    const state = await consumeState(req.query.state, cookie, id);
    target = returnUrl(state.return_url) || target;
    const { maxAge, ...clearOptions } = cookieOptions(id);
    res.clearCookie(`r6_oauth_${id}`, clearOptions);
    if (req.query.error) throw new Error('cancelled');
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw new Error('provider_failed');
    const user = await socialUser(await fetchIdentity(id, req.query.code, state.verifier));
    const code = random();
    await pool.query('INSERT INTO oauth_codes (code_hash, user_id, challenge, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE))', [hash(code), user.id, state.challenge]);
    res.redirect(`${target}#oauth_code=${code}`);
  } catch (error) {
    const reason = ['invalid_state', 'cancelled', 'account_exists'].includes(error.message) ? error.message : 'provider_failed';
    res.redirect(`${target}#oauth_error=${reason}`);
  }
});

export default router;
