// Componente / Módulo: Profile
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Profile.
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosConfig';
import './Profile.css';

const nameRgx = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
const passRgx  = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function Profile() {
  const { user, login, token } = useAuth();
  const [form, setForm] = useState({ nombre: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setForm(p => ({ ...p, nombre: user.nombre }));
  }, [user]);

  const validate = () => {
    const e = {};
    if (!form.nombre) e.nombre = 'Nombre requerido.';
    else if (!nameRgx.test(form.nombre)) e.nombre = 'Solo letras, 2-50 caracteres.';
    if (form.password && !passRgx.test(form.password))
      e.password = 'Mín. 8 chars, mayúscula, minúscula y número.';
    if (form.password && form.password !== form.confirm)
      e.confirm = 'Las contraseñas no coinciden.';
    return e;
  };

  const handleChange = e => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setErrors(p => ({ ...p, [e.target.name]: '' }));
    setMsg('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const payload = { nombre: form.nombre };
      if (form.password) payload.password = form.password;
      const { data } = await api.put(`/users/${user.id}`, payload);
      login(data, token);
      setMsg('✅ Perfil actualizado correctamente.');
      setForm(p => ({ ...p, password: '', confirm: '' }));
    } catch (err) {
      setErrors({ api: err.response?.data?.error || 'Error al actualizar.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-wrapper">
      <div className="profile-card glass">
        <div className="profile-avatar">{user?.nombre?.[0]?.toUpperCase()}</div>
        <h1>{user?.nombre}</h1>
        <p className="profile-email">{user?.email}</p>
        <span className={`role-badge ${user?.rol}`}>{user?.rol}</span>

        <form onSubmit={handleSubmit} className="profile-form" noValidate>
          <h2>Editar Perfil</h2>
          <div className="field-group">
            <label>Nombre</label>
            <input type="text" name="nombre" value={form.nombre}
              onChange={handleChange} className={errors.nombre ? 'input-error' : ''} />
            {errors.nombre && <span className="field-error">{errors.nombre}</span>}
          </div>
          <div className="field-group">
            <label>Nueva Contraseña <small>(opcional)</small></label>
            <input type="password" name="password" value={form.password}
              onChange={handleChange} placeholder="Dejá vacío para no cambiar"
              className={errors.password ? 'input-error' : ''} />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>
          <div className="field-group">
            <label>Confirmar Contraseña</label>
            <input type="password" name="confirm" value={form.confirm}
              onChange={handleChange} placeholder="Repetí la nueva contraseña"
              className={errors.confirm ? 'input-error' : ''} />
            {errors.confirm && <span className="field-error">{errors.confirm}</span>}
          </div>
          {errors.api && <div className="api-error">{errors.api}</div>}
          {msg && <div className="api-success">{msg}</div>}
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
