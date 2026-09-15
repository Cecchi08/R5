// Componente / Módulo: AdminDashboard
// Propósito: Maneja la lógica y la vista/rutas relacionadas con AdminDashboard.
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-hero glass">
        <div className="hero-avatar">👑</div>
        <div className="hero-info">
          <h1>Panel de Administración</h1>
          <p>Bienvenido, {user?.nombre}</p>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/admin/products" className="action-btn glass" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📦</span>
          <span>Gestionar Productos</span>
        </Link>
        <Link to="/admin/users" className="action-btn glass" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>👥</span>
          <span>Gestionar Usuarios</span>
        </Link>
      </div>

      <div className="info-card glass" style={{ marginTop: '2rem' }}>
        <h2>Ecommerce Admin</h2>
        <p>Desde aquí puedes controlar todo el inventario y los usuarios registrados en la plataforma.</p>
      </div>
    </div>
  );
}
