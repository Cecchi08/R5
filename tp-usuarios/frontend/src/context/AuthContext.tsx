// Componente / Módulo: AuthContext
// Propósito: Maneja la lógica y la vista/rutas relacionadas con AuthContext.
import { createContext, useContext, useState, useEffect } from 'react';

// Auth context: stores user + token in localStorage
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rr_user')) || null; }
    catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('rr_token') || null);

  const login = (userData, tkn) => {
    setUser(userData);
    setToken(tkn);
    localStorage.setItem('rr_user', JSON.stringify(userData));
    localStorage.setItem('rr_token', tkn);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('rr_user');
    localStorage.removeItem('rr_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
