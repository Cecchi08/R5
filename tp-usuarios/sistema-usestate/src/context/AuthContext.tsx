// Componente / Módulo: AuthContext
// Propósito: Maneja la lógica y la vista/rutas relacionadas con AuthContext.
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('us_user')) || null; }
    catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('us_token') || null);

  const login = (userData, tkn) => {
    setUser(userData);
    setToken(tkn);
    localStorage.setItem('us_user', JSON.stringify(userData));
    localStorage.setItem('us_token', tkn);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('us_user');
    localStorage.removeItem('us_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
