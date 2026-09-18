import { requestJson } from '../http.js';

export default {
  name: 'X',
  env: 'X',
  authorize: 'https://x.com/i/oauth2/authorize',
  token: 'https://api.x.com/2/oauth2/token',
  scope: 'tweet.read users.read',
  pkce: true,
  basic: true,
  async getProfile(accessToken) {
    const { data } = await requestJson('https://api.x.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { subject: data?.id, name: data?.name || data?.username, email: null };
  },
};
