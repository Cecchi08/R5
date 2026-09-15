import { createHash, createHmac } from 'node:crypto';
import { callbackUrl } from './config.js';
import { validEmail, normalizeEmail } from './validation.js';

export const providers = {
  google: { name: 'Google', env: 'GOOGLE', authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile', pkce: true },
  facebook: { name: 'Facebook / Meta', env: 'FACEBOOK', authorize: 'https://www.facebook.com/v23.0/dialog/oauth', token: 'https://graph.facebook.com/v23.0/oauth/access_token', scope: 'public_profile,email' },
  github: { name: 'GitHub', env: 'GITHUB', authorize: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email', pkce: true },
  x: { name: 'X', env: 'X', authorize: 'https://x.com/i/oauth2/authorize', token: 'https://api.x.com/2/oauth2/token', scope: 'tweet.read users.read', pkce: true, basic: true },
  discord: { name: 'Discord', env: 'DISCORD', authorize: 'https://discord.com/oauth2/authorize', token: 'https://discord.com/api/oauth2/token', scope: 'identify email' },
  twitch: { name: 'Twitch', env: 'TWITCH', authorize: 'https://id.twitch.tv/oauth2/authorize', token: 'https://id.twitch.tv/oauth2/token', scope: 'user:read:email' },
};

export function providerConfig(id) {
  if (!Object.hasOwn(providers, id)) return null;
  const provider = providers[id];
  const clientId = process.env[`${provider.env}_CLIENT_ID`] || (id === 'facebook' ? process.env.META_CLIENT_ID : '');
  const clientSecret = process.env[`${provider.env}_CLIENT_SECRET`] || (id === 'facebook' ? process.env.META_CLIENT_SECRET : '');
  const version = /^v\d+\.\d+$/.test(process.env.FACEBOOK_API_VERSION || '') ? process.env.FACEBOOK_API_VERSION : 'v23.0';
  return { ...provider, clientId, clientSecret, enabled: Boolean(clientId && clientSecret), ...(id === 'facebook' ? {
    authorize: `https://www.facebook.com/${version}/dialog/oauth`, token: `https://graph.facebook.com/${version}/oauth/access_token`, version,
  } : {}) };
}

export function authorizationUrl(id, state, verifier) {
  const config = providerConfig(id);
  const url = new URL(config.authorize);
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: callbackUrl(id), response_type: 'code', scope: config.scope, state }).toString();
  if (config.pkce) {
    url.searchParams.set('code_challenge', createHash('sha256').update(verifier).digest('base64url'));
    url.searchParams.set('code_challenge_method', 'S256');
  }
  if (id === 'google') url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'User-Agent': 'R6-Social-Login', ...options.headers } });
  if (!response.ok) throw new Error('provider_failed');
  const data = await response.json();
  if (!data || data.error) throw new Error('provider_failed');
  return data;
}

export async function fetchIdentity(id, code, verifier) {
  const config = providerConfig(id);
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl(id), client_id: config.clientId });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (config.basic) headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString('base64')}`;
  else body.set('client_secret', config.clientSecret);
  if (config.pkce) body.set('code_verifier', verifier);
  const token = await requestJson(config.token, { method: 'POST', body, headers });
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('provider_failed');
  const auth = { Authorization: `Bearer ${token.access_token}` };
  let subject, name, email;
  if (id === 'google') {
    const user = await requestJson('https://openidconnect.googleapis.com/v1/userinfo', { headers: auth });
    subject = user.sub; name = user.name; email = user.email_verified === true ? user.email : null;
  } else if (id === 'github') {
    const user = await requestJson('https://api.github.com/user', { headers: auth });
    const emails = await requestJson('https://api.github.com/user/emails', { headers: auth });
    subject = user.id; name = user.name || user.login;
    email = emails.find(item => item.primary && item.verified)?.email || emails.find(item => item.verified)?.email;
  } else if (id === 'facebook') {
    const proof = createHmac('sha256', config.clientSecret).update(token.access_token).digest('hex');
    const user = await requestJson(`https://graph.facebook.com/${config.version}/me?fields=id,name,email&appsecret_proof=${proof}`, { headers: auth });
    subject = user.id; name = user.name; email = user.email;
  } else if (id === 'discord') {
    const user = await requestJson('https://discord.com/api/v10/users/@me', { headers: auth });
    subject = user.id; name = user.global_name || user.username; email = user.verified === true ? user.email : null;
  } else if (id === 'x') {
    const { data: user } = await requestJson('https://api.x.com/2/users/me', { headers: auth });
    subject = user?.id; name = user?.name || user?.username;
  } else if (id === 'twitch') {
    const { data } = await requestJson('https://api.twitch.tv/helix/users', { headers: { ...auth, 'Client-Id': config.clientId } });
    subject = data?.[0]?.id; name = data?.[0]?.display_name; email = data?.[0]?.email;
  }
  if (!['string', 'number'].includes(typeof subject) || !String(subject).length || String(subject).length > 255) throw new Error('provider_failed');
  email = normalizeEmail(email);
  return { provider: id, subject: String(subject), nombre: (typeof name === 'string' ? name.trim() : '').slice(0, 50) || config.name, email: validEmail(email) ? email : null };
}
