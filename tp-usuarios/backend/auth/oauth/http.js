import { OAuthError } from './errors.js';
import { redact } from './redact.js';

async function responseText(response) {
  if (!response.body?.getReader) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '', bytes = 0;
  // Los endpoints de identidad son pequeños. Acotar tambien la lectura, no solo el log.
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        return `${text}${decoder.decode(value.subarray(0, Math.max(0, 65536 - (bytes - value.byteLength))))}\n[respuesta truncada: supera 64 KiB]`;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

export async function requestJson(url, options = {}, context = {}) {
  // Guardar solo el endpoint sin query. El cuerpo enviado, headers y tokens no se loguean.
  const parsedUrl = new URL(url);
  const endpoint = `${parsedUrl.origin}${parsedUrl.pathname}`;
  const secrets = [];
  for (const params of [options.body, parsedUrl.searchParams]) {
    if (params instanceof URLSearchParams) {
      for (const [key, value] of params) if (/secret|token|code|verifier|state|proof/i.test(key)) secrets.push(value);
    }
  }
  for (const [key, value] of new Headers(options.headers)) {
    if (/authorization|cookie/i.test(key)) secrets.push(value, value.replace(/^(?:Bearer|Basic) /i, ''));
  }
  let status;
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'TechStore-OAuth', ...options.headers },
    });
    status = response.status;
    let data, body;
    // Leer tambien respuestas no JSON (HTML de un proxy, texto de error del proveedor).
    // fetch real ofrece text(); el fallback mantiene los dobles de prueba existentes.
    if (typeof response.text === 'function') {
      body = await responseText(response);
      try { data = JSON.parse(body); } catch { /* Se conserva el texto filtrado para diagnostico. */ }
    } else {
      data = await response.json();
      body = data;
    }
    if (!response.ok || !data || typeof data !== 'object' || data.error) {
      throw new OAuthError('provider_failed', { ...context, status, endpoint, responseBody: redact(data ?? body, secrets) });
    }
    return data;
  } catch (cause) {
    if (cause instanceof OAuthError) throw cause;
    throw new OAuthError('provider_failed', {
      ...context, status, endpoint,
      transport: ['TimeoutError', 'AbortError'].includes(cause.name) ? 'timeout' : cause instanceof SyntaxError ? 'invalid_json' : 'network_or_redirect',
    });
  }
}
