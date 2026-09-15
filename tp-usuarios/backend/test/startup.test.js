import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { sendOrderEmail } from '../utils/mailer.js';

test('el backend encuentra su configuración desde la raíz y desde su propia carpeta', () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(DB_|JWT_SECRET|SMTP_|FRONTEND_URLS|BACKEND_URL)/.test(key)) delete env[key];
  const moduleUrl = new URL('../db.js', import.meta.url).href;
  const script = `import assert from 'node:assert/strict'; const { default: pool } = await import(${JSON.stringify(moduleUrl)}); assert.ok(process.env.DB_NAME); assert.ok(process.env.JWT_SECRET); await pool.end();`;
  for (const cwd of [new URL('../../', import.meta.url), new URL('../', import.meta.url)]) {
    execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: fileURLToPath(cwd), env, timeout: 10000, stdio: 'pipe' });
  }
});

test('todas las rutas del servidor se pueden importar sin iniciar el servidor', async () => {
  for (const route of ['auth', 'oauth', 'users', 'products', 'favorites', 'carts', 'orders']) {
    const { default: router } = await import(`../routes/${route}.js`);
    assert.equal(typeof router, 'function');
  }
});

test('las cuentas sociales sin email no intentan enviar un correo', async t => {
  const create = t.mock.method(nodemailer, 'createTransport', () => { throw new Error('No debe abrirse una conexión'); });
  assert.equal(await sendOrderEmail(null, {}), false);
  assert.equal(create.mock.callCount(), 0);
});

test('el envío existente usa SMTP y captura los fallos sin rechazos sin manejar', async t => {
  const previous = { SMTP_HOST: process.env.SMTP_HOST, SMTP_FROM: process.env.SMTP_FROM };
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_FROM = 'store@example.com';
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  let message;
  const order = { id: 1, items: [{ cantidad: 2, nombre_prod: 'Producto', subtotal: '20.00' }], total: '20.00', date: '2026-09-14' };
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async input => { message = input; } }));
  assert.equal(await sendOrderEmail('test@example.com', order), true);
  assert.equal(message.to, 'test@example.com');
  assert.match(message.text, /Total: \$20\.00/);
  t.mock.restoreAll();
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw Object.assign(new Error('SMTP failure'), { code: 'ECONNECTION' }); } }));
  const log = t.mock.method(console, 'error', () => {});
  assert.equal(await sendOrderEmail('test@example.com', order), false);
  assert.equal(log.mock.callCount(), 1);
});
