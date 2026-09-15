// Componente / Módulo: Navbar
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Navbar.
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  // Un pequeño hack para actualizar el carrito globalmente podría ser con Context,
  // pero para simplificar lo actualizamos en cada re-render si hay usuario
  useEffect(() => {
    if (user) {
      api.get('/carts')
        .then(res => {
          const count = res.data.items.reduce((acc, item) => acc + item.cantidad, 0);
          setCartCount(count);
        })
        .catch(() => setCartCount(0));
    } else {
      setCartCount(0);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar glass">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">🛒</span>
        <span>TechStore</span>
      </Link>
      <div className="navbar-links">
        <Link to="/" className="nav-link">Productos</Link>
        {user && (
          <>
            <Link to="/favorites" className="nav-link">Favoritos</Link>
            <Link to="/cart" className="nav-link">
              Carrito {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
            {user.rol === 'admin' && <Link to="/admin" className="nav-link admin-link">Admin</Link>}
          </>
        )}
      </div>
      <div className="navbar-actions">
        <button className="theme-btn" onClick={toggle} title="Cambiar tema">
          {dark ? '☀️' : '🌙'}
        </button>
        {user ? (
          <>
            <div className="user-chip">
              <Link to="/profile" className="user-name" style={{ textDecoration: 'none', color: 'inherit' }}>{user.nombre}</Link>
              <span className={`role-badge ${user.rol}`}>{user.rol}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Salir</button>
          </>
        ) : (
          <Link to="/login" className="btn-primary">Ingresar</Link>
        )}
      </div>
    </nav>
  );
}
