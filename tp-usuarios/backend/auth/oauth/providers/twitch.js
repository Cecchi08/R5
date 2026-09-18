import { requestJson } from '../http.js';

export default {
  name: 'Twitch',
  env: 'TWITCH',
  authorize: 'https://id.twitch.tv/oauth2/authorize',
  token: 'https://id.twitch.tv/oauth2/token',
  scope: 'user:read:email',
  async getProfile(accessToken, config) {
    const { data } = await requestJson('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${accessToken}`, 'Client-Id': config.clientId },
    });
    return { subject: data?.[0]?.id, name: data?.[0]?.display_name, email: data?.[0]?.email };
  },
};
