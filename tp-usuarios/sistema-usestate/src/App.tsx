import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NavProvider, useNav } from './context/NavContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import OAuthErrorPage from '../../frontend/src/components/auth/OAuthErrorPage';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Users from './pages/Users';

// Page router based on useState navigation
function PageRouter() {
  const { page } = useNav();
  const { user } = useAuth();

  // Guard: redirect to login if not authenticated
  const isAuth = !!user;
  const isAdmin = user?.rol === 'admin';

  if (window.location.pathname === '/auth/error') return <OAuthErrorPage />;
  if (window.location.hash.includes('oauth_')) return <Login />;

  if (!isAuth && page !== 'register') return <Login />;
  if (!isAuth && page === 'register') return <Register />;
  if (page === 'login') return <Login />;
  if (page === 'register') return <Register />;
  if (page === 'dashboard') return <Dashboard />;
  if (page === 'profile') return <Profile />;
  if (page === 'users' && isAdmin) return <Users />;
  if (page === 'users' && !isAdmin) return <Dashboard />; // non-admin fallback
  return <Dashboard />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavProvider>
          <Navbar />
          <PageRouter />
        </NavProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
