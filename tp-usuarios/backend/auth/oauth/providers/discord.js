import { requestJson } from '../http.js';

export default {
  name: 'Discord',
  env: 'DISCORD',
  authorize: 'https://discord.com/oauth2/authorize',
  token: 'https://discord.com/api/oauth2/token',
  scope: 'identify email',
  async getProfile(accessToken) {
    const user = await requestJson('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return { subject: user.id, name: user.global_name || user.username, email: user.verified === true ? user.email : null };
  },
};
