const fallback = {
  stage: 'callback', provider: 'unknown', code: 'CALLBACK_FAILED',
  message: 'No pudimos completar el acceso social.',
  hint: 'Volvé a iniciar sesión. Si el problema continúa, contactá al soporte.',
};

// El fragmento es entrada no confiable. Mostrar solo texto y limitar su tamaño.
export function parseOAuthError(value, development = false) {
  try {
    if (typeof value === 'string' && value.length > 20000) return { ...fallback };
    const data = typeof value === 'string' ? JSON.parse(value) : value;
    if (!data || typeof data !== 'object') return { ...fallback };
    const result = Object.fromEntries(Object.entries(fallback).map(([key, defaultValue]) => [key,
      typeof data[key] === 'string' ? data[key].slice(0, 2000) : defaultValue,
    ]));
    if (development && data.details && typeof data.details === 'object') result.details = data.details;
    return result;
  } catch { return { ...fallback }; }
}

export function showOAuthError(value) {
  const error = parseOAuthError(value, import.meta.env.DEV);
  try {
    sessionStorage.removeItem('r6_oauth_verifier');
    sessionStorage.removeItem('r6_oauth_provider');
  } catch { /* La pagina de error tambien funciona con almacenamiento bloqueado. */ }
  window.location.replace(`/auth/error#oauth_diagnostic=${encodeURIComponent(JSON.stringify(error))}`);
}
