import { requestJson } from '../http.js';

export default {
  name: 'Google',
  env: 'GOOGLE',
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  scope: 'openid email profile',
  pkce: true,
  authorizationParams: { prompt: 'select_account' },
  async getProfile(accessToken) {
    const user = await requestJson('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { subject: user.sub, name: user.name, email: user.email_verified === true ? user.email : null };
  },
};
