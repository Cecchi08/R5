// Componente / Módulo: Users
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Users.
import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import './Users.css';

const nameRgx = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
const emailRgx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'user' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [deleting, setDeleting] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch { setMsg('Error al cargar usuarios.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openEdit = u => {
    setEditUser(u);
    setForm({ nombre: u.nombre, email: u.email, rol: u.rol });
    setErrors({}); setMsg('');
  };

  const validate = () => {
    const e = {};
    if (!form.nombre) e.nombre = 'Requerido.';
    else if (!nameRgx.test(form.nombre)) e.nombre = 'Solo letras, 2-50 chars.';
    if (!form.email) e.email = 'Requerido.';
    else if (!emailRgx.test(form.email)) e.email = 'Email inválido.';
    return e;
  };

  const handleUpdate = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    try {
      await api.put(`/users/${editUser.id}`, form);
      setMsg('✅ Usuario actualizado.');
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setErrors({ api: err.response?.data?.error || 'Error.' });
    }
  };

  const handleDelete = async id => {
    setDeleting(id);
    try {
      await api.delete(`/users/${id}`);
      setUsers(p => p.filter(u => u.id !== id));
    } catch { setMsg('Error al eliminar.'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="users-wrapper">
      <div className="users-header">
        <h1>Gestión de Usuarios</h1>
        <p>{users.length} usuario(s) registrado(s)</p>
      </div>

      {msg && <div className="api-success">{msg}</div>}

      {loading ? (
        <div className="loading-state">
          <span className="spinner-lg" />
          <p>Cargando usuarios...</p>
        </div>
      ) : (
        <div className="users-grid">
          {users.map(u => (
            <div key={u.id} className="user-card glass">
              <div className="user-card-avatar">{u.nombre[0].toUpperCase()}</div>
              <div className="user-card-info">
                <div className="user-card-name">{u.nombre}</div>
                <div className="user-card-email">{u.email}</div>
                <span className={`role-badge ${u.rol}`}>{u.rol}</span>
              </div>
              <div className="user-card-actions">
                <button className="btn-edit" onClick={() => openEdit(u)}>✏️ Editar</button>
                <button className="btn-delete" onClick={() => handleDelete(u.id)} disabled={deleting === u.id}>
                  {deleting === u.id ? '...' : '🗑️ Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Editar: {editUser.nombre}</h2>
            <form onSubmit={handleUpdate} noValidate>
              <div className="field-group">
                <label>Nombre</label>
                <input type="text" value={form.nombre}
                  onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setErrors(p => ({ ...p, nombre: '' })); }}
                  className={errors.nombre ? 'input-error' : ''} />
                {errors.nombre && <span className="field-error">{errors.nombre}</span>}
              </div>
              <div className="field-group">
                <label>Email</label>
                <input type="email" value={form.email}
                  onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrors(p => ({ ...p, email: '' })); }}
                  className={errors.email ? 'input-error' : ''} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
              <div className="field-group">
                <label>Rol</label>
                <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              {errors.api && <div className="api-error">{errors.api}</div>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditUser(null)}>Cancelar</button>
                <button type="submit" className="btn-submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
