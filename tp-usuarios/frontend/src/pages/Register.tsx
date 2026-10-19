import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthScreen from '../components/auth/AuthScreen';
import api from '../api/axiosConfig';

export default function Register() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from;
  let savedReturnTo = null;
  try { savedReturnTo = sessionStorage.getItem('r6_oauth_return_to'); } catch { /* Navegacion directa sin storage. */ }
  const returnTo = destination?.pathname
    ? `${destination.pathname}${destination.search || ''}${destination.hash || ''}`
    : savedReturnTo?.startsWith('/') && !savedReturnTo.startsWith('//') ? savedReturnTo : '/';

  return <AuthScreen mode="register" api={api} dark={dark} toggle={toggle}
    returnTo={returnTo}
    onAuthenticated={(user, token) => {
      login(user, token);
      try { sessionStorage.removeItem('r6_oauth_return_to'); } catch { /* El registro ya se completó. */ }
      navigate(returnTo, { replace: true });
    }}
    onSwitch={() => navigate('/login', { state: location.state })} />;
}
