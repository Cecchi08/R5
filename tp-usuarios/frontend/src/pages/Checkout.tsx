// Componente / Módulo: Checkout
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Checkout.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import './Auth.css'; // Reutilizamos estilos de Auth para el formulario

export default function Checkout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const { data } = await api.get('/carts');
        if (data.items.length === 0) {
          navigate('/cart');
          return;
        }
        setCart(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCart();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Eliminada validación y envío de email al backend por petición del cliente.
    setProcessing(true);
    try {
      // Realizar el pedido sin incluir lógica/dep. de envío de correo desde el frontend.
      await api.post('/orders');
      window.dispatchEvent(new Event('cart-updated'));
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error procesando el pedido. Verificá el stock.');
      setProcessing(false);
    }
  };

  if (loading) return <div className="loading-state"><span className="spinner-lg" /></div>;

  if (success) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card glass" style={{ textAlign: 'center' }}>
          <span className="auth-icon">🎉</span>
          <h1>¡Compra Exitosa!</h1>
          <p>Tu pedido ha sido procesado correctamente.</p>
          <p style={{ margin: '1rem 0', color: 'var(--text-muted)' }}>
            Tu pedido ha sido registrado correctamente.
          </p>
          <button className="btn-primary" onClick={() => navigate('/')}>Volver a la tienda</button>
        </div>
      </div>
    );
  }

  const total = cart?.items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0) || 0;

  return (
    <div className="auth-wrapper">
      <div className="auth-card glass" style={{ maxWidth: '720px' }}>
        <div className="auth-header">
          <span className="auth-icon">💳</span>
          <h1>Checkout</h1>
          <p>Completa tu compra segura</p>
        </div>

        <div style={{ marginBottom: '2rem', background: 'var(--glass-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '1rem' }}>Resumen</h3>
          {cart.items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <span>{item.cantidad}x {item.nombre}</span>
              <span>${(item.precio * item.cantidad).toFixed(2)}</span>
            </div>
          ))}
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem' }}>
            <span>Total a pagar:</span>
            <span style={{ color: 'var(--accent)' }}>${total.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label>Método de Pago</label>
            <select disabled>
              <option>Tarjeta de Crédito / Débito (Demo)</option>
            </select>
          </div>

          {error && <div className="api-error">{error}</div>}
          
          <button type="submit" className="btn-submit" disabled={processing}>
            {processing ? <span className="spinner" /> : `Confirmar y Pagar $${total.toFixed(2)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
