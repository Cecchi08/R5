import { createContext, useContext, useSyncExternalStore } from 'react';
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
  const store = window.R6Theme;
  const dark = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return <ThemeContext.Provider value={{ dark, toggle: store.toggle }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
