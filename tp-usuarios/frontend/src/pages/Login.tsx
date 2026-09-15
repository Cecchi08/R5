import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthScreen from '../components/auth/AuthScreen';
import api from '../api/axiosConfig';

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  return <AuthScreen mode="login" api={api} dark={dark} toggle={toggle}
    onAuthenticated={(user, token) => { login(user, token); navigate('/profile', { replace: true }); }}
    onSwitch={() => navigate('/register')} />;
}
