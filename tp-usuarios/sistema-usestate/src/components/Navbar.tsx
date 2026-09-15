// Componente / Módulo: Navbar
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Navbar.
import { useAuth } from '../context/AuthContext';
import { useNav } from '../context/NavContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { page, navigate } = useNav();
  const { dark, toggle } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('login');
  };

  return (
    <nav className="navbar glass">
      <button className="navbar-brand" onClick={() => user && navigate('dashboard')}>
        <span className="brand-icon">⬡</span>
        <span>UsuariosDB</span>
      </button>
      <div className="navbar-links">
        {user && (
          <>
            <button className={`nav-link ${page === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>Dashboard</button>
            <button className={`nav-link ${page === 'profile' ? 'active' : ''}`} onClick={() => navigate('profile')}>Mi Perfil</button>
            {user.rol === 'admin' && (
              <button className={`nav-link ${page === 'users' ? 'active' : ''}`} onClick={() => navigate('users')}>Usuarios</button>
            )}
          </>
        )}
      </div>
      <div className="navbar-actions">
        <button className="theme-btn" onClick={toggle} title="Cambiar tema">
          {dark ? '☀️' : '🌙'}
        </button>
        {user ? (
          <div className="user-chip">
            <span className="user-name">{user.nombre}</span>
            <span className={`role-badge ${user.rol}`}>{user.rol}</span>
            <button className="logout-btn" onClick={handleLogout}>Salir</button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
