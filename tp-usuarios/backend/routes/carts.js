// Componente / Módulo: carts
// Propósito: Maneja la lógica y la vista/rutas relacionadas con carts.
import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Helper para asegurar que el usuario tenga carrito
const getCartId = async (user_id) => {
  const [rows] = await pool.query('SELECT id FROM carts WHERE user_id = ?', [user_id]);
  if (rows.length > 0) return rows[0].id;
  const [result] = await pool.query('INSERT INTO carts (user_id) VALUES (?)', [user_id]);
  return result.insertId;
};

// GET /api/carts (Obtener carrito con items)
router.get('/', async (req, res) => {
  try {
    const cartId = await getCartId(req.user.id);
    const [items] = await pool.query(
      `SELECT ci.id as cart_item_id, ci.cantidad, p.* 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );
    res.json({ cart_id: cartId, items });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo carrito' });
  }
});

// POST /api/carts/items (Agregar producto)
router.post('/items', async (req, res) => {
  const { product_id, cantidad = 1 } = req.body;
  if (!product_id || cantidad <= 0) return res.status(400).json({ error: 'Datos inválidos' });

  try {
    // Validar producto y stock
    const [prods] = await pool.query('SELECT stock, disponibilidad FROM products WHERE id = ?', [product_id]);
    if (prods.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!prods[0].disponibilidad || prods[0].stock < cantidad) return res.status(400).json({ error: 'Stock insuficiente o no disponible' });

    const cartId = await getCartId(req.user.id);

    // Verificar si ya está en el carrito
    const [existing] = await pool.query('SELECT id, cantidad FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, product_id]);
    
    if (existing.length > 0) {
      const nuevaCantidad = existing[0].cantidad + cantidad;
      if (prods[0].stock < nuevaCantidad) return res.status(400).json({ error: 'Stock insuficiente para esa cantidad' });
      await pool.query('UPDATE cart_items SET cantidad = ? WHERE id = ?', [nuevaCantidad, existing[0].id]);
    } else {
      await pool.query('INSERT INTO cart_items (cart_id, product_id, cantidad) VALUES (?, ?, ?)', [cartId, product_id, cantidad]);
    }
    res.json({ message: 'Producto agregado al carrito' });
  } catch (err) {
    res.status(500).json({ error: 'Error agregando al carrito' });
  }
});

// PUT /api/carts/items/:product_id (Modificar cantidad)
router.put('/items/:product_id', async (req, res) => {
  const { cantidad } = req.body;
  const product_id = req.params.product_id;
  if (cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

  try {
    const [prods] = await pool.query('SELECT stock FROM products WHERE id = ?', [product_id]);
    if (prods.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    if (prods[0].stock < cantidad) return res.status(400).json({ error: 'Stock insuficiente' });

    const cartId = await getCartId(req.user.id);
    await pool.query('UPDATE cart_items SET cantidad = ? WHERE cart_id = ? AND product_id = ?', [cantidad, cartId, product_id]);
    res.json({ message: 'Cantidad actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando cantidad' });
  }
});

// DELETE /api/carts/items/:product_id (Eliminar del carrito)
router.delete('/items/:product_id', async (req, res) => {
  try {
    const cartId = await getCartId(req.user.id);
    await pool.query('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, req.params.product_id]);
    res.json({ message: 'Producto eliminado del carrito' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando del carrito' });
  }
});

// DELETE /api/carts (Vaciar carrito)
router.delete('/', async (req, res) => {
  try {
    const cartId = await getCartId(req.user.id);
    await pool.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    res.json({ message: 'Carrito vaciado' });
  } catch (err) {
    res.status(500).json({ error: 'Error vaciando carrito' });
  }
});

export default router;
