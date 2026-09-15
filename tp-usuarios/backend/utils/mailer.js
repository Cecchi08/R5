import nodemailer from 'nodemailer';
import '../config/env.js';
import { validEmail } from '../auth/validation.js';

export async function sendOrderEmail(email, order) {
  if (!validEmail(email) || !process.env.SMTP_HOST || !process.env.SMTP_FROM) return false;

  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const items = order.items.map(item => `${item.cantidad} × ${item.nombre_prod}: $${item.subtotal}`).join('\n');
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `TechStore · Pedido #${order.id}`,
      text: `Tu pedido #${order.id} fue confirmado.\n${order.date}\n\n${items}\n\nTotal: $${order.total}`,
    });
    return true;
  } catch (error) {
    console.error('No se pudo enviar el correo del pedido:', error.code || error.name);
    return false;
  }
}
