// Módulo: axiosConfig
// Propósito: Instancia axios con la configuración base y el interceptor para el token JWT.
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api', timeout: 20000 });

// Attach JWT token automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem('rr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

