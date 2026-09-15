// Servidor principal
// Propósito: Configura Express, middlewares y rutas globales.
import './config/env.js';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import favoriteRoutes from './routes/favorites.js';
import cartRoutes from './routes/carts.js';
import orderRoutes from './routes/orders.js';
import oauthRoutes from './routes/oauth.js';
import { frontendOrigins } from './auth/config.js';
import { ensureAuthSchema } from './auth/schema.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.use(cors({ origin: frontendOrigins(), credentials: true }));
app.use(express.json({ limit: '32kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/orders', orderRoutes);

// Global error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la solicitud no es válido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud supera el tamaño permitido.' });
  console.error('Error del servidor:', err.code || err.name);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

if (!process.env.JWT_SECRET) throw new Error('Falta JWT_SECRET en backend/.env');
await ensureAuthSchema();
app.listen(PORT, () => console.log(`Backend corriendo en http://localhost:${PORT}`));
