const attempts = new Map();
export function authLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.ip;
  const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  entry.count += 1;
  attempts.set(key, entry);
  if (entry.count > 60) {
    res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
    return res.status(429).json({ error: 'Demasiados intentos. Esperá unos minutos para volver a intentar.' });
  }
  next();
}
