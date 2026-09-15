// Componente / Módulo: products
// Propósito: Maneja la lógica y la vista/rutas relacionadas con products.
import { Router } from 'express';
import pool from '../db.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/products (Listado con filtros, orden y paginación)
router.get('/', async (req, res) => {
  try {
    const { search, categoria, marca, sort, order, limit, page } = req.query;
    
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (nombre LIKE ? OR descripcion LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (categoria) {
      query += ' AND categoria = ?';
      params.push(categoria);
    }
    if (marca) {
      query += ' AND marca = ?';
      params.push(marca);
    }

    const validSortCols = ['precio', 'created_at', 'nombre'];
    const sortCol = validSortCols.includes(sort) ? sort : 'created_at';
    const sortOrder = order && order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortCol} ${sortOrder}`;

    const numLimit = parseInt(limit) || 20;
    const numPage = parseInt(page) || 1;
    const offset = (numPage - 1) * numLimit;
    
    query += ' LIMIT ? OFFSET ?';
    params.push(numLimit, offset);

    const [rows] = await pool.query(query, params);
    
    // Total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM products WHERE 1=1';
    const countParams = [];
    if (search) { countQuery += ' AND (nombre LIKE ? OR descripcion LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`); }
    if (categoria) { countQuery += ' AND categoria = ?'; countParams.push(categoria); }
    if (marca) { countQuery += ' AND marca = ?'; countParams.push(marca); }
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      data: rows,
      total: countResult[0].total,
      page: numPage,
      limit: numLimit
    });
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo productos' });
  }
});

// GET /api/products/categories (Obtener categorías únicas)
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT categoria FROM products WHERE categoria IS NOT NULL');
    res.json(rows.map(r => r.categoria));
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/products/brands (Obtener marcas únicas)
router.get('/brands', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT DISTINCT marca FROM products WHERE marca IS NOT NULL');
    res.json(rows.map(r => r.marca));
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/products/:id (Detalle)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error obteniendo producto' });
  }
});

// CREATE /api/products (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre, descripcion, precio, stock, categoria, marca, imagen, disponibilidad } = req.body;
  if (!nombre || precio == null || stock == null) return res.status(400).json({ error: 'Nombre, precio y stock son obligatorios' });
  
  try {
    const [result] = await pool.query(
      'INSERT INTO products (nombre, descripcion, precio, stock, categoria, marca, imagen, disponibilidad) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nombre, descripcion, precio, stock, categoria, marca, imagen, disponibilidad !== undefined ? disponibilidad : true]
    );
    res.status(201).json({ id: result.insertId, message: 'Producto creado' });
  } catch (err) {
    res.status(500).json({ error: 'Error creando producto' });
  }
});

// UPDATE /api/products/:id (Admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { nombre, descripcion, precio, stock, categoria, marca, imagen, disponibilidad } = req.body;
  const id = req.params.id;

  try {
    await pool.query(
      'UPDATE products SET nombre=?, descripcion=?, precio=?, stock=?, categoria=?, marca=?, imagen=?, disponibilidad=? WHERE id=?',
      [nombre, descripcion, precio, stock, categoria, marca, imagen, disponibilidad, id]
    );
    res.json({ message: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error actualizando producto' });
  }
});

// DELETE /api/products/:id (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error eliminando producto' });
  }
});

export default router;
