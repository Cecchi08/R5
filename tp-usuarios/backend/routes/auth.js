import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { validEmail, validPassword, validName, normalizeEmail } from '../auth/validation.js';
import { sessionFor } from '../auth/session.js';
import { authLimit } from '../middleware/authLimit.js';

const router = Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/register', authLimit, async (req, res, next) => {
  const { password } = req.body || {};
  const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
  const email = normalizeEmail(req.body?.email);
  if (!validName(nombre)) return res.status(400).json({ error: 'Nombre inválido: ingresá entre 2 y 50 letras.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Ingresá un correo válido de hasta 100 caracteres.' });
  if (!validPassword(password)) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula y número; máximo 72 bytes.' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query("INSERT INTO users (nombre, email, password, rol) VALUES (?, ?, ?, 'user')", [nombre, email, hash]);
    res.status(201).json(sessionFor({ id: result.insertId, nombre, email, rol: 'user' }));
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El correo ya está registrado. Iniciá sesión con tu método habitual.' });
    next(error);
  }
});

router.post('/login', authLimit, async (req, res, next) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!validEmail(email) || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) return res.status(400).json({ error: 'Ingresá un correo y una contraseña válidos.' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user?.password || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Credenciales incorrectas. Si te registraste con una cuenta social, usá ese proveedor.' });
    res.json(sessionFor(user));
  } catch (error) { next(error); }
});

export default router;
