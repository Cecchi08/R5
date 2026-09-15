// Componente / Módulo: Favorites
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Favorites.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useUI } from '../context/UIContext';
import '../pages/Home.css'; // Reutilizamos estilos de grid de Home

export default function Favorites() {
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showAlert } = useUI();

  const fetchFavorites = async () => {
    try {
      const { data } = await api.get('/favorites');
      setFavorites(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemove = async (productId) => {
    try {
      await api.delete(`/favorites/${productId}`);
      setFavorites(favorites.filter(f => f.id !== productId));
    } catch (err) {
      showAlert('Error eliminando favorito');
    }
  };

  const handleAddToCart = async (productId, disponible, stock) => {
    if (!disponible || stock === 0) return;
    try {
      await api.post('/carts/items', { product_id: productId, cantidad: 1 });
      window.dispatchEvent(new Event('cart-updated'));
      showAlert('Producto agregado al carrito');
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Error agregando al carrito');
    }
  };

  if (loading) return <div className="loading-state"><span className="spinner-lg" /></div>;

  return (
    <div className="home-wrapper">
      <h1 style={{ marginBottom: '2rem' }}>Mis Favoritos ❤️</h1>
      
      {favorites.length === 0 ? (
        <div className="empty-state glass" style={{ padding: '4rem', borderRadius: '16px' }}>
          <h2 style={{ marginBottom: '1rem' }}>No tienes favoritos</h2>
          <p>Explora nuestros productos y guarda los que más te gusten.</p>
          <Link to="/" className="btn-primary" style={{ marginTop: '1rem' }}>Ver productos</Link>
        </div>
      ) : (
        <div className="products-grid">
          {favorites.map(p => (
            <div key={p.id} className="product-card glass">
              <div className="product-img-wrapper">
                {p.imagen ? <img src={p.imagen} alt={p.nombre} /> : <div className="no-img">Sin Imagen</div>}
                {!p.disponibilidad || p.stock === 0 ? <div className="out-of-stock-badge">Agotado</div> : null}
              </div>
              <div className="product-info">
                <span className="product-category">{p.marca} - {p.categoria}</span>
                <Link to={`/products/${p.id}`} className="product-title">{p.nombre}</Link>
                <div className="product-price">${parseFloat(p.precio).toFixed(2)}</div>
                <div className="product-actions">
                  <button className="btn-icon" onClick={() => handleRemove(p.id)} title="Eliminar" style={{ color: '#ef4444' }}>🗑️</button>
                  <button 
                    className="btn-primary" 
                    disabled={!p.disponibilidad || p.stock === 0}
                    onClick={() => handleAddToCart(p.id, p.disponibilidad, p.stock)}
                  >
                    🛒 Agregar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
