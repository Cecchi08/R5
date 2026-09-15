import './config/env.js';
import { ensureAuthSchema } from './auth/schema.js';
import pool from './db.js';
try {
  await ensureAuthSchema();
  console.log('Tablas de autenticación listas.');
} catch (error) {
  console.error('No se pudo preparar la autenticación:', error.code || error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
