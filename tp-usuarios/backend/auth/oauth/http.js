import { OAuthError } from './errors.js';

export async function requestJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'TechStore-OAuth', ...options.headers },
    });
    if (!response.ok) throw new OAuthError('provider_failed', { status: response.status });
    const data = await response.json();
    if (!data || typeof data !== 'object' || data.error) throw new OAuthError('provider_failed');
    return data;
  } catch (cause) {
    if (cause instanceof OAuthError) throw cause;
    throw new OAuthError('provider_failed', { cause });
  }
}
