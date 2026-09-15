// Componente / Módulo: favorites
// Propósito: Maneja la lógica y la vista/rutas relacionadas con favorites.
import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/favorites (Obtener todos los favoritos del usuario)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, f.id as favorite_id 
       FROM favorites f 
       JOIN products p ON f.product_id = p.id 
       WHERE f.user_id = ?`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo favoritos' });
  }
});

// POST /api/favorites (Agregar a favoritos)
router.post('/', async (req, res) => {
  const { product_id } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id es requerido' });

  try {
    const [existing] = await pool.query('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?', [req.user.id, product_id]);
    if (existing.length > 0) return res.json({ message: 'Ya está en favoritos' });

    await pool.query('INSERT INTO favorites (user_id, product_id) VALUES (?, ?)', [req.user.id, product_id]);
    res.status(201).json({ message: 'Agregado a favoritos' });
  } catch (err) {
    // Si product_id no existe, MySQL arrojará error de Foreign Key
    res.status(400).json({ error: 'Error agregando a favoritos (¿Producto existe?)' });
  }
});

// DELETE /api/favorites/:product_id (Eliminar de favoritos)
router.delete('/:product_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.product_id]);
    res.json({ message: 'Eliminado de favoritos' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando de favoritos' });
  }
});

// GET /api/favorites/check/:product_id (Comprobar si está en favoritos)
router.get('/check/:product_id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.product_id]);
    res.json({ isFavorite: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Error comprobando favorito' });
  }
});

export default router;
