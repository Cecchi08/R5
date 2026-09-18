import { requestJson } from '../http.js';
import { OAuthError } from '../errors.js';

export default {
  name: 'GitHub',
  env: 'GITHUB',
  authorize: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
  scope: 'read:user user:email',
  pkce: true,
  async getProfile(accessToken) {
    const options = { headers: { Authorization: `Bearer ${accessToken}` } };
    const user = await requestJson('https://api.github.com/user', options);
    const emails = await requestJson('https://api.github.com/user/emails', options);
    if (!Array.isArray(emails)) throw new OAuthError('provider_failed');
    const email = emails.find(item => item?.primary === true && item?.verified === true)?.email
      || emails.find(item => item?.verified === true)?.email;
    return { subject: user.id, name: user.name || user.login, email };
  },
};
