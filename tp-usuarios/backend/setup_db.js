import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import './config/env.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSetup() {
  console.log('Iniciando configuración de la base de datos...');
  let connection;
  try {
    // Connect without specifying the database first, so we can create it
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true // Crucial to execute the whole script at once
    });

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Ejecutando schema.sql...');
    await connection.query(schemaSql);
    console.log('¡Base de datos y tablas creadas exitosamente!');

  } catch (err) {
    console.error('Error configurando la base de datos:', err);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runSetup();
