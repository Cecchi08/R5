// Componente / Módulo: auth
// Propósito: Maneja la lógica y la vista/rutas relacionadas con auth.
import jwt from 'jsonwebtoken';

// Verify JWT from Authorization header
export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido.' });

  try {
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

// Only allow admin role
export function adminMiddleware(req, res, next) {
  if (req.user?.rol !== 'admin')
    return res.status(403).json({ error: 'Acceso restringido a administradores.' });
  next();
}
