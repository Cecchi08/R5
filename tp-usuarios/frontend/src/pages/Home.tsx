// Componente / Módulo: Home
// Propósito: Maneja la lógica y la vista/rutas relacionadas con Home.
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import './Home.css';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('DESC');
  
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { showAlert } = useUI();
  const navigate = useNavigate();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = `/products?sort=${sort}&order=${order}`;
      if (search) url += `&search=${search}`;
      if (category) url += `&categoria=${category}`;
      if (brand) url += `&marca=${brand}`;
      
      const { data } = await api.get(url);
      setProducts(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get('/products/categories'),
        api.get('/products/brands')
      ]);
      setCategories(catRes.data);
      setBrands(brandRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search, category, brand, sort, order]);

  const handleAddToCart = async (productId) => {
    if (!user) return navigate('/login');
    try {
      await api.post('/carts/items', { product_id: productId, cantidad: 1 });
      // Truco simple para forzar re-render de navbar, o podríamos usar un state manager global
      window.dispatchEvent(new Event('cart-updated')); 
      showAlert('Producto agregado al carrito');
    } catch (err: any) {
      showAlert(err.response?.data?.error || 'Error agregando al carrito');
    }
  };

  const handleAddFavorite = async (productId) => {
    if (!user) return navigate('/login');
    try {
      await api.post('/favorites', { product_id: productId });
      showAlert('Agregado a favoritos');
    } catch (err) {
      showAlert('Error agregando a favoritos');
    }
  };

  return (
    <div className="home-wrapper">
      <div className="filters-section glass">
        <input 
          type="text" 
          placeholder="Buscar productos..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="search-input"
        />
        
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Todas las marcas</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select value={`${sort}-${order}`} onChange={(e) => {
          const [s, o] = e.target.value.split('-');
          setSort(s); setOrder(o);
        }}>
          <option value="created_at-DESC">Más nuevos</option>
          <option value="precio-ASC">Menor precio</option>
          <option value="precio-DESC">Mayor precio</option>
          <option value="nombre-ASC">Nombre A-Z</option>
        </select>
      </div>

      {loading ? (
         <div className="loading-state"><span className="spinner-lg" /></div>
      ) : (
        <div className="products-grid">
          {products.map(p => (
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
                  <button className="btn-icon" onClick={() => handleAddFavorite(p.id)} title="Favoritos">❤️</button>
                  <button 
                    className="btn-primary" 
                    disabled={!p.disponibilidad || p.stock === 0}
                    onClick={() => handleAddToCart(p.id)}
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="empty-state">No se encontraron productos.</p>}
        </div>
      )}
    </div>
  );
}
