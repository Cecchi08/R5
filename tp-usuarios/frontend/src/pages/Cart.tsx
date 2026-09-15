// Componente / Módulo: Cart
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Cart.
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useUI } from '../context/UIContext';
import './Cart.css';

export default function Cart() {
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useUI();

  const fetchCart = async () => {
    try {
      const { data } = await api.get('/carts');
      setCart(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    try {
      await api.put(`/carts/items/${productId}`, { cantidad: newQuantity });
      await fetchCart();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Error actualizando cantidad');
    }
  };

  const removeItem = async (productId) => {
    try {
      await api.delete(`/carts/items/${productId}`);
      await fetchCart();
      window.dispatchEvent(new Event('cart-updated'));
    } catch (err) {
      showAlert('Error eliminando item');
    }
  };

  const clearCart = () => {
    showConfirm('¿Seguro que deseas vaciar el carrito?', async () => {
      try {
        await api.delete('/carts');
        await fetchCart();
        window.dispatchEvent(new Event('cart-updated'));
      } catch (err) {
        showAlert('Error vaciando carrito');
      }
    });
  };

  if (loading) return <div className="loading-state"><span className="spinner-lg" /></div>;

  const total = cart?.items.reduce((acc, item) => acc + (item.precio * item.cantidad), 0) || 0;

  return (
    <div className="cart-wrapper">
      <h1>Tu Carrito 🛒</h1>
      
      {!cart || cart.items.length === 0 ? (
        <div className="empty-state glass">
          <h2>El carrito está vacío</h2>
          <p>Agrega algunos productos para comenzar tu compra.</p>
          <Link to="/" className="btn-primary" style={{ marginTop: '1rem' }}>Seguir comprando</Link>
        </div>
      ) : (
        <div className="cart-content">
          <div className="cart-items">
            {cart.items.map(item => (
              <div key={item.cart_item_id} className="cart-item glass">
                <div className="item-img">
                  {item.imagen ? <img src={item.imagen} alt={item.nombre} /> : <div>Sin img</div>}
                </div>
                <div className="item-details">
                  <Link to={`/products/${item.id}`} className="item-name">{item.nombre}</Link>
                  <div className="item-price">${parseFloat(item.precio).toFixed(2)}</div>
                  <div className="item-stock">Stock: {item.stock}</div>
                </div>
                <div className="item-actions">
                  <div className="quantity-controls">
                    <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} disabled={item.cantidad <= 1}>-</button>
                    <span>{item.cantidad}</span>
                    <button onClick={() => updateQuantity(item.id, item.cantidad + 1)} disabled={item.cantidad >= item.stock}>+</button>
                  </div>
                  <button className="btn-remove" onClick={() => removeItem(item.id)}>🗑️</button>
                </div>
                <div className="item-subtotal">
                  ${(item.precio * item.cantidad).toFixed(2)}
                </div>
              </div>
            ))}
            <div className="cart-actions">
              <button className="btn-secondary" onClick={clearCart}>Vaciar Carrito</button>
            </div>
          </div>
          
          <div className="cart-summary glass">
            <h2>Resumen de compra</h2>
            <div className="summary-row">
              <span>Productos ({cart.items.length})</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Envío</span>
              <span>Gratis</span>
            </div>
            <hr />
            <div className="summary-row total">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <button className="btn-primary btn-block" onClick={() => navigate('/checkout')}>
              Proceder al Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
