// Componente / Módulo: NavContext
// Propósito: Maneja la lógica y la vista/rutas relacionadas con NavContext.
import { createContext, useContext, useState, useEffect } from 'react';

// Navigation context replaces React Router using useState
const NavContext = createContext();

export function NavProvider({ children }) {
  const [page, setPage] = useState(() => localStorage.getItem('us_page') || 'login');

  const navigate = (p) => {
    setPage(p);
    localStorage.setItem('us_page', p);
  };

  return (
    <NavContext.Provider value={{ page, navigate }}>
      {children}
    </NavContext.Provider>
  );
}

export const useNav = () => useContext(NavContext);
