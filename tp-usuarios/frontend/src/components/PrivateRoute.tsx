// Componente / Módulo: PrivateRoute
// Propósito: Maneja la lógica y la vista/rutas relacionadas con PrivateRoute.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Redirects to /login if not authenticated
export default function PrivateRoute({ children, adminOnly = false }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (adminOnly && user.rol !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}
