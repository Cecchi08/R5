import '../../../config/env.js';
import google from './google.js';
import facebook from './facebook.js';
import github from './github.js';
import x from './x.js';
import discord from './discord.js';
import twitch from './twitch.js';

export const providers = Object.freeze({ google, facebook, github, x, discord, twitch });
export const canonicalProviderId = id => id === 'meta' ? 'facebook' : id === 'twitter' ? 'x' : id;

export function providerConfig(value) {
  const id = canonicalProviderId(value);
  if (typeof id !== 'string' || !Object.hasOwn(providers, id)) return null;
  const provider = providers[id];
  const clientId = process.env[`${provider.env}_CLIENT_ID`] || (provider.envAlias ? process.env[`${provider.envAlias}_CLIENT_ID`] : '') || '';
  const clientSecret = process.env[`${provider.env}_CLIENT_SECRET`] || (provider.envAlias ? process.env[`${provider.envAlias}_CLIENT_SECRET`] : '') || '';
  return { ...provider, ...provider.configure?.(), id, clientId, clientSecret, enabled: Boolean(clientId.trim() && clientSecret.trim()) };
}
