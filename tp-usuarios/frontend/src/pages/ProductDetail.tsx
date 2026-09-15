// Componente / Módulo: ProductDetail
// Propósito: Maneja la lógica y la vista/rutas relacionadas con ProductDetail.
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import './ProductDetail.css';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cantidad, setCantidad] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const { user } = useAuth();
  const { showAlert } = useUI();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setProduct(data);
        if (user) {
          const favRes = await api.get(`/favorites/check/${id}`);
          setIsFavorite(favRes.data.isFavorite);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, user]);

  const handleAddToCart = async () => {
    if (!user) return navigate('/login');
    try {
      await api.post('/carts/items', { product_id: id, cantidad });
      window.dispatchEvent(new Event('cart-updated'));
      showAlert('Producto agregado al carrito');
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Error agregando al carrito');
    }
  };

  const toggleFavorite = async () => {
    if (!user) return navigate('/login');
    try {
      if (isFavorite) {
        await api.delete(`/favorites/${id}`);
        setIsFavorite(false);
      } else {
        await api.post('/favorites', { product_id: id });
        setIsFavorite(true);
      }
    } catch (err) {
      showAlert('Error modificando favoritos');
    }
  };

  if (loading) return <div className="loading-state"><span className="spinner-lg" /></div>;
  if (!product) return <div className="error-state">Producto no encontrado</div>;

  const isAvailable = product.disponibilidad && product.stock > 0;

  return (
    <div className="product-detail-wrapper">
      <div className="product-detail-card glass">
        <div className="detail-image">
          {product.imagen ? <img src={product.imagen} alt={product.nombre} /> : <div className="no-img">Sin Imagen</div>}
        </div>
        <div className="detail-info">
          <div className="detail-meta">
            <span>{product.marca}</span> • <span>{product.categoria}</span>
          </div>
          <h1>{product.nombre}</h1>
          <p className="detail-desc">{product.descripcion}</p>
          <div className="detail-price">${parseFloat(product.precio).toFixed(2)}</div>
          
          <div className={`detail-stock ${isAvailable ? 'in-stock' : 'out-of-stock'}`}>
            {isAvailable ? `${product.stock} disponibles` : 'Agotado'}
          </div>

          {isAvailable && (
            <div className="quantity-selector">
              <label>Cantidad:</label>
              <input 
                type="number" 
                min="1" 
                max={product.stock} 
                value={cantidad} 
                onChange={(e) => setCantidad(Math.min(product.stock, Math.max(1, parseInt(e.target.value) || 1)))} 
              />
            </div>
          )}

          <div className="detail-actions">
            <button className={`btn-fav ${isFavorite ? 'active' : ''}`} onClick={toggleFavorite}>
              {isFavorite ? '❤️ Quitar Favorito' : '🤍 Agregar Favorito'}
            </button>
            <button 
              className="btn-primary btn-lg" 
              disabled={!isAvailable}
              onClick={handleAddToCart}
            >
              🛒 Agregar al carrito
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
