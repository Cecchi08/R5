// Componente / Módulo: ScrollTop
// Propósito: Muestra un botón flotante que aparece al scrollear y lleva al inicio.
import { useState, useEffect } from 'react';

export default function ScrollTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button className="scroll-top" onClick={handleClick} aria-label="Scroll to top">
      ↑
    </button>
  );
}
