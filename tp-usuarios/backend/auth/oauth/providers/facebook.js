import { createHmac } from 'node:crypto';
import { requestJson } from '../http.js';

export default {
  name: 'Facebook / Meta',
  env: 'FACEBOOK',
  envAlias: 'META',
  scope: 'public_profile,email',
  configure() {
    const version = /^v\d+\.\d+$/.test(process.env.FACEBOOK_API_VERSION || '') ? process.env.FACEBOOK_API_VERSION : 'v23.0';
    return {
      version,
      authorize: `https://www.facebook.com/${version}/dialog/oauth`,
      token: `https://graph.facebook.com/${version}/oauth/access_token`,
    };
  },
  async getProfile(accessToken, config) {
    const proof = createHmac('sha256', config.clientSecret).update(accessToken).digest('hex');
    const url = new URL(`https://graph.facebook.com/${config.version}/me`);
    url.search = new URLSearchParams({ fields: 'id,name,email', appsecret_proof: proof }).toString();
    const user = await requestJson(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    return { subject: user.id, name: user.name, email: user.email };
  },
};
