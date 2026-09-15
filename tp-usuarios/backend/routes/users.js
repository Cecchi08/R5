// Componente / Módulo: users
// Propósito: Maneja la lógica y la vista/rutas relacionadas con users.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

const nameRgx = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
const emailRgx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passRgx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// GET /api/users — list all (admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  const [rows] = await pool.query('SELECT id, nombre, email, rol, created_at FROM users ORDER BY id DESC');
  res.json(rows);
});

// GET /api/users/me — own profile
router.get('/me', authMiddleware, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, nombre, email, rol, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
  res.json(rows[0]);
});

// PUT /api/users/:id — update user (own or admin)
router.put('/:id', authMiddleware, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (req.user.id !== targetId && req.user.rol !== 'admin')
    return res.status(403).json({ error: 'Sin permiso para modificar este usuario.' });

  const { nombre, email, password, rol } = req.body;
  const fields = [];
  const values = [];

  if (nombre) {
    if (!nameRgx.test(nombre)) return res.status(400).json({ error: 'Nombre inválido.' });
    fields.push('nombre = ?'); values.push(nombre);
  }
  if (email) {
    if (!emailRgx.test(email)) return res.status(400).json({ error: 'Email inválido.' });
    const [ex] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, targetId]);
    if (ex.length > 0) return res.status(409).json({ error: 'Email ya en uso.' });
    fields.push('email = ?'); values.push(email);
  }
  if (password) {
    if (!passRgx.test(password)) return res.status(400).json({ error: 'Contraseña inválida.' });
    fields.push('password = ?'); values.push(await bcrypt.hash(password, 10));
  }
  if (rol && req.user.rol === 'admin') {
    fields.push('rol = ?'); values.push(rol);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'Nada que actualizar.' });

  values.push(targetId);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  const [updated] = await pool.query('SELECT id, nombre, email, rol, created_at FROM users WHERE id = ?', [targetId]);
  res.json(updated[0]);
});

// DELETE /api/users/:id — admin only
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const targetId = parseInt(req.params.id);
  const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [targetId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
  await pool.query('DELETE FROM users WHERE id = ?', [targetId]);
  res.json({ message: 'Usuario eliminado.' });
});

export default router;
