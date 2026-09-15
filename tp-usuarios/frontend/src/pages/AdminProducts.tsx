// Componente / Módulo: AdminProducts
// Propósito: Maneja la lógica y la vista/rutas relacionadas con AdminProducts.
import { useState, useEffect } from 'react';
import api from '../api/axiosConfig';
import { useUI } from '../context/UIContext';
import './Users.css'; // Reutilizamos estilos de tabla/grid de Users

export default function AdminProducts() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { showAlert, showConfirm } = useUI();
  
  const initialForm = {
    nombre: '', descripcion: '', precio: '', stock: '', categoria: '', marca: '', imagen: '', disponibilidad: true
  };
  const [form, setForm] = useState(initialForm);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/products?limit=100'); // Sin paginación compleja para el panel admin demo
      setProducts(data.data);
    } catch { 
      setError('Error al cargar productos.'); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openEdit = p  => {
    setEditProduct(p);
    setIsCreating(false);
    setForm({ ...p, disponibilidad: p.disponibilidad === 1 });
    setError(''); setMsg('');
  };

  const openCreate = () => {
    setEditProduct(null);
    setIsCreating(true);
    setForm(initialForm);
    setError(''); setMsg('');
  };

  const closeForm = () => {
    setEditProduct(null);
    setIsCreating(false);
  };

  const validate = () => {
    if (!form.nombre || !form.precio || form.stock === '') return 'Nombre, precio y stock son obligatorios.';
    if (parseFloat(form.precio) < 0) return 'El precio no puede ser negativo.';
    if (parseInt(form.stock) < 0) return 'El stock no puede ser negativo.';
    return null;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const valError = validate();
    if (valError) { setError(valError); return; }
    
    try {
      if (isCreating) {
        await api.post('/products', form);
        setMsg('✅ Producto creado.');
      } else {
        await api.put(`/products/${editProduct.id}`, form);
        setMsg('✅ Producto actualizado.');
      }
      closeForm();
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.error || 'Error procesando solicitud.');
    }
  };

  const handleDelete = (id: number) => {
    showConfirm('¿Seguro que deseas eliminar este producto permanentemente?', async () => {
      setDeleting(id);
      try {
        await api.delete(`/products/${id}`);
        setProducts(p => p.filter(prod => prod.id !== id));
        showAlert('✅ Producto eliminado.');
      } catch { 
        setError('Error al eliminar.'); 
      } finally { 
        setDeleting(null); 
      }
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div className="users-wrapper">
      <div className="users-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Gestión de Productos</h1>
          <p>{products.length} producto(s) en inventario</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Nuevo Producto</button>
      </div>

      {msg && <div className="api-success">{msg}</div>}
      {error && !isCreating && !editProduct && <div className="api-error">{error}</div>}

      {loading ? (
        <div className="loading-state"><span className="spinner-lg" /></div>
      ) : (
        <div className="users-grid">
          {products.map(p => (
            <div key={p.id} className="user-card glass">
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '60px', height: '60px', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                  {p.imagen ? <img src={p.imagen} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <span style={{fontSize:'0.6rem'}}>Sin Img</span>}
                </div>
                <div>
                  <div className="user-card-name" style={{ fontSize: '0.9rem' }}>{p.nombre}</div>
                  <div className="user-card-email">${p.precio} | Stock: {p.stock}</div>
                  <span className={`role-badge ${p.disponibilidad ? 'admin' : 'user'}`}>
                    {p.disponibilidad ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div className="user-card-actions" style={{ marginTop: 'auto' }}>
                <button className="btn-edit" onClick={() => openEdit(p)}>✏️ Editar</button>
                <button className="btn-delete" onClick={() => handleDelete(p.id)} disabled={deleting === p.id}>
                  {deleting === p.id ? '...' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {(isCreating || editProduct) && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal glass" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2>{isCreating ? 'Nuevo Producto' : `Editar: ${editProduct.nombre}`}</h2>
            <form onSubmit={handleSubmit} noValidate>
              
              <div className="field-group">
                <label>Nombre</label>
                <input type="text" name="nombre" value={form.nombre} onChange={handleChange} />
              </div>
              
              <div className="field-group">
                <label>Descripción</label>
                <textarea name="descripcion" value={form.descripcion} onChange={handleChange} 
                  style={{ padding: '0.7rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--input-bg)', color: 'var(--text)', minHeight: '80px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="field-group" style={{ flex: 1 }}>
                  <label>Precio ($)</label>
                  <input type="number" step="0.01" name="precio" value={form.precio} onChange={handleChange} />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label>Stock</label>
                  <input type="number" name="stock" value={form.stock} onChange={handleChange} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="field-group" style={{ flex: 1 }}>
                  <label>Categoría</label>
                  <input type="text" name="categoria" value={form.categoria} onChange={handleChange} />
                </div>
                <div className="field-group" style={{ flex: 1 }}>
                  <label>Marca</label>
                  <input type="text" name="marca" value={form.marca} onChange={handleChange} />
                </div>
              </div>

              <div className="field-group">
                <label>URL Imagen</label>
                <input type="text" name="imagen" value={form.imagen} onChange={handleChange} />
              </div>

              <div className="field-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" name="disponibilidad" checked={form.disponibilidad} onChange={handleChange} style={{ width: 'auto' }} />
                <label style={{ margin: 0 }}>Disponible para venta</label>
              </div>

              {error && <div className="api-error">{error}</div>}
              
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeForm}>Cancelar</button>
                <button type="submit" className="btn-submit">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
