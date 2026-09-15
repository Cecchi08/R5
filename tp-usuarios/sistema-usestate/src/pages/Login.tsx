import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNav } from '../context/NavContext';
import AuthScreen from '../../../frontend/src/components/auth/AuthScreen';
import api from '../api/axiosConfig';

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const { navigate } = useNav();
  return <AuthScreen mode="login" api={api} dark={dark} toggle={toggle}
    onAuthenticated={(user, token) => { login(user, token); navigate('dashboard'); }}
    onSwitch={() => navigate('register')} />;
}
