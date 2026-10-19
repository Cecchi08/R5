// Componente / Módulo: PrivateRoute
// Propósito: Maneja la lógica y la vista/rutas relacionadas con PrivateRoute.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Redirects to /login if not authenticated
export default function PrivateRoute({ children, adminOnly = false }) {
  const { user, token } = useAuth();
  const location = useLocation();
  if (!token || !user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && user.rol !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
