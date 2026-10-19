// Todo dato remoto es no confiable. Nunca registrar cuerpos sin pasar por este filtro.
// Los valores de la peticion se filtran tambien cuando el proveedor los refleja en texto libre.
export function redact(value, secrets = [], depth = 0) {
  if (depth > 6) return '[truncado]';
  if (depth === 0 && value && typeof value === 'object') {
    const collect = (item, level = 0) => {
      if (!item || typeof item !== 'object' || level > 6) return [];
      return Object.entries(item).slice(0, 40).flatMap(([key, child]) =>
        /secret|password|token|verifier|authorization|cookie|^state$/i.test(key) && typeof child === 'string'
          ? [child] : collect(child, level + 1));
    };
    secrets = [...secrets, ...collect(value)];
  }
  const hidden = '[REDACTED]';
  if (typeof value === 'string') {
    let text = value;
    const envSecrets = Object.entries(process.env)
      .filter(([key]) => /SECRET|PASSWORD|TOKEN|PRIVATE_KEY/i.test(key)).map(([, item]) => item);
    for (const secret of [...envSecrets, ...secrets].filter(item => typeof item === 'string' && item)) {
      const html = secret.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      for (const variant of new Set([secret, html, encodeURIComponent(secret), new URLSearchParams({ v: secret }).toString().slice(2)])) {
        text = text.split(variant).join(hidden);
      }
    }
    return text.replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[REDACTED]@')
      .replace(/\b(Bearer|Basic)\s+[^\s"'<>]+/gi, '$1 [REDACTED]')
      .replace(/((?:client_secret|access_token|refresh_token|id_token|code_verifier|authorization_code|password|state|code)["']?\s*[:=]\s*["']?)[^\s&"'<>]+/gi, '$1[REDACTED]')
      .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, 4096);
  }
  if (Array.isArray(value)) return value.slice(0, 30).map(item => redact(item, secrets, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [key,
      /secret|password|token|verifier|authorization|cookie|^state$|^code$/i.test(key) ? hidden : redact(item, secrets, depth + 1),
    ]));
  }
  return value;
}
