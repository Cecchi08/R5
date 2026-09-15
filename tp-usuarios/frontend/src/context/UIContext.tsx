// context/UIContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import './UIContext.css';

interface UIContextProps {
  showAlert: (msg: string) => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const UIContext = createContext<UIContextProps | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  // Estado para alertas tipo Toast
  const [toast, setToast] = useState<{ id: number, msg: string } | null>(null);
  
  // Estado para Confirmación
  const [confirm, setConfirm] = useState<{ msg: string, onConfirm: () => void } | null>(null);

  const showAlert = (msg: string) => {
    const id = Date.now();
    setToast({ id, msg });
    setTimeout(() => {
      setToast(prev => prev?.id === id ? null : prev);
    }, 3000);
  };

  const showConfirm = (msg: string, onConfirm: () => void) => {
    setConfirm({ msg, onConfirm });
  };

  const handleConfirm = () => {
    if (confirm) confirm.onConfirm();
    setConfirm(null);
  };

  return (
    <UIContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* Toast Alert */}
      {toast && (
        <div className="custom-toast glass slide-in">
          {toast.msg}
        </div>
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div className="custom-modal-overlay">
          <div className="custom-modal glass zoom-in">
            <h3>Confirmación</h3>
            <p>{confirm.msg}</p>
            <div className="custom-modal-actions">
              <button className="btn-cancel" onClick={() => setConfirm(null)}>Cancelar</button>
              <button className="btn-submit" onClick={handleConfirm}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
};
