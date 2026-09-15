// Componente / Módulo: orders
// Propósito: Maneja la lógica y la vista/rutas relacionadas con orders.
import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendOrderEmail } from '../utils/mailer.js';

const router = Router();
router.use(authMiddleware);

// POST /api/orders (Crear pedido desde el carrito)
router.post('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener carrito y items
    const [carts] = await connection.query('SELECT id FROM carts WHERE user_id = ?', [req.user.id]);
    if (carts.length === 0) throw new Error('Carrito vacío');
    const cartId = carts[0].id;

    const [items] = await connection.query(
      `SELECT ci.product_id, ci.cantidad, p.nombre, p.precio, p.stock 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = ? FOR UPDATE`, // Bloquear filas para transacción segura
      [cartId]
    );

    if (items.length === 0) throw new Error('Carrito vacío');

    // 2. Validar stock y calcular total
    let total = 0;
    for (const item of items) {
      if (item.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para el producto: ${item.nombre}`);
      }
      total += parseFloat(item.precio) * item.cantidad;
    }

    // 3. Crear order
    const [orderRes] = await connection.query(
      'INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)',
      [req.user.id, total, 'confirmed']
    );
    const orderId = orderRes.insertId;

    // 4. Crear order_items y descontar stock
    const orderItems = [];
    for (const item of items) {
      const subtotal = parseFloat(item.precio) * item.cantidad;
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, nombre_prod, precio_unitario, cantidad, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.nombre, item.precio, item.cantidad, subtotal]
      );
      
      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.cantidad, item.product_id]
      );

      orderItems.push({
        nombre_prod: item.nombre,
        cantidad: item.cantidad,
        subtotal: subtotal.toFixed(2)
      });
    }

    // 5. Vaciar carrito
    await connection.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    await connection.commit();

    // 6. Enviar email (asíncrono, no bloquea la respuesta)
    sendOrderEmail(req.user.email, {
      id: orderId,
      items: orderItems,
      total: total.toFixed(2),
      date: new Date().toLocaleString()
    });

    res.status(201).json({ message: 'Pedido creado exitosamente', orderId });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(400).json({ error: err.message || 'Error procesando el pedido' });
  } finally {
    connection.release();
  }
});

// GET /api/orders (Mis pedidos)
router.get('/', async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    
    // Si queremos incluir los items, lo ideal es agruparlos o iterar (cuidado n+1)
    for (let order of orders) {
      const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      order.items = items;
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo pedidos' });
  }
});

export default router;
