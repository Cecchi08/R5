import { callbackPath } from './oauth/paths.js';

export function frontendOrigins() {
  const value = process.env.FRONTEND_URLS || 'http://localhost:5173,http://localhost:5174';
  try {
    return value.split(',').map(item => {
      const url = new URL(item.trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid_origin');
      return url.origin;
    });
  } catch {
    // No importar diagnostics aqui: se usa tambien durante el arranque y evita ciclos.
    throw Object.assign(new Error('FRONTEND_URLS invalido'), {
      diagnosticCode: 'INVALID_ENV_VAR', problems: [{ code: 'INVALID_ENV_VAR', variable: 'FRONTEND_URLS', current: value, expected: 'Orígenes HTTP/HTTPS separados por comas', message: 'FRONTEND_URLS contiene una URL inválida.' }],
    });
  }
}

export function callbackUrl(provider) {
  const envKeys = { google: 'GOOGLE', facebook: 'FACEBOOK', github: 'GITHUB', x: 'X', discord: 'DISCORD', twitch: 'TWITCH' };
  if (!Object.hasOwn(envKeys, provider)) throw new Error('unknown_provider');
  const key = `${envKeys[provider]}_REDIRECT_URI`;
  const value = process.env[key];
  // Exigir una URL explicita: BACKEND_URL ya no decide el callback OAuth.
  if (!value) throw new Error(`Falta ${key} en backend/.env`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${key}: URL absoluta invalida`); }
  // Rechazar errores de copia y rutas que Express no atiende, sin corregirlos silenciosamente.
  if (/[\s\\]/.test(value) || !['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || value.includes('?') || value.includes('#')
    || url.pathname !== callbackPath(provider) || url.href !== value) {
    throw new Error(`${key}: usa una URL exacta como http://localhost:4000/api/auth/${provider}/callback, sin espacios, query ni fragmento`);
  }
  // HTTP solo para desarrollo local; los callbacks publicos requieren HTTPS.
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${key}: HTTP solo esta permitido en loopback; usa HTTPS`);
  }
  // Conservar literalmente el valor registrado en el panel del proveedor.
  return value;
}

export function returnUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!frontendOrigins().includes(url.origin) || !['/login', '/register', '/'].includes(url.pathname) || url.username || url.password) return null;
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}
