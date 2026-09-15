import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function insertAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'usuarios_db'
    });

    const email = 'admin@test.com';
    const password = 'Admin1234';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Verificando si el administrador ya existe...');
    const [rows] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    
    if (rows.length > 0) {
      console.log('El administrador ya existe. Actualizando la contraseña por si acaso...');
      await connection.query('UPDATE users SET password = ?, rol = "admin" WHERE email = ?', [hashedPassword, email]);
      console.log('¡Contraseña actualizada exitosamente!');
    } else {
      console.log('Insertando administrador...');
      await connection.query(
        'INSERT INTO users (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['Administrador', email, hashedPassword, 'admin']
      );
      console.log('¡Administrador insertado exitosamente!');
    }
  } catch (error) {
    console.error('Error durante la inserción:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

insertAdmin();
