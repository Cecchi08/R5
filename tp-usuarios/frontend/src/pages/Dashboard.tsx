// Componente / Módulo: Dashboard
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Dashboard.
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();

  const stats = [
    { icon: '👤', label: 'Rol', value: user?.rol === 'admin' ? 'Administrador' : 'Usuario' },
    { icon: '📧', label: 'Email', value: user?.email },
    { icon: '🔑', label: 'Estado', value: 'Activo' },
  ];

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-hero glass">
        <div className="hero-avatar">{user?.nombre?.[0]?.toUpperCase()}</div>
        <div className="hero-info">
          <h1>Hola, {user?.nombre} 👋</h1>
          <p>Bienvenido a tu panel de control</p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card glass">
            <span className="stat-icon">{s.icon}</span>
            <div>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="info-card glass">
        <h2>Sistema de Usuarios — React Router</h2>
        <p>
          Este sistema utiliza <strong>React Router</strong> para la navegación entre páginas,
          <strong> Context API</strong> para el estado global, <strong>localStorage</strong> para
          persistencia de sesión y <strong>Axios</strong> para consumir la API REST.
        </p>
        <ul>
          <li>✅ Autenticación JWT con persistencia en localStorage</li>
          <li>✅ Rutas protegidas por rol (user / admin)</li>
          <li>✅ CRUD de usuarios (admin)</li>
          <li>✅ Edición de perfil propio</li>
          <li>✅ Modo día/noche persistente</li>
        </ul>
      </div>
    </div>
  );
}
