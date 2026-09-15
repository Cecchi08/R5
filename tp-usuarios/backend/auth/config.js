export function frontendOrigins() {
  return (process.env.FRONTEND_URLS || 'http://localhost:5173,http://localhost:5174').split(',').map(value => new URL(value.trim()).origin);
}

export function callbackUrl(provider) {
  return `${(process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/auth/${provider}/callback`;
}

export function returnUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!frontendOrigins().includes(url.origin) || !['/login', '/register', '/'].includes(url.pathname) || url.username || url.password) return null;
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}
