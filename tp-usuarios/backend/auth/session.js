import jwt from 'jsonwebtoken';

export function sessionFor(row) {
  const user = { id: row.id, nombre: row.nombre, email: row.email, rol: row.rol };
  const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
  return { user, token };
}
