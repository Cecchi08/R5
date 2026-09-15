-- ============================================================
--  usuarios_db — Script de creación de tablas
-- ============================================================

CREATE DATABASE IF NOT EXISTS usuarios_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE usuarios_db;

-- 1. Tabla principal de usuarios
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(50)  NOT NULL,
  email       VARCHAR(100) NULL UNIQUE,
  password    VARCHAR(255) NULL,          -- bcrypt hash
  rol         ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_rol   (rol)
);

-- Usuario administrador inicial (Contraseña: Admin1234)
INSERT INTO users (nombre, email, password, rol)
VALUES (
  'Administrador',
  'admin@test.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin'
)
ON DUPLICATE KEY UPDATE id = id;

-- 2. Productos
CREATE TABLE IF NOT EXISTS products (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  descripcion    TEXT,
  precio         DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
  stock          INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  categoria      VARCHAR(100),
  marca          VARCHAR(100),
  imagen         VARCHAR(255),
  disponibilidad BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_categoria (categoria),
  INDEX idx_marca (marca),
  INDEX idx_disponibilidad (disponibilidad)
);

-- Insertar productos de ejemplo (SEED)
INSERT INTO products (nombre, descripcion, precio, stock, categoria, marca, imagen, disponibilidad) VALUES
('Smartphone X Pro', 'El último smartphone con cámara de 108MP y pantalla OLED.', 899.99, 15, 'Smartphones', 'BrandX', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80', TRUE),
('Laptop UltraSlim', 'Laptop ultraligera con procesador M2 y 16GB RAM.', 1299.50, 8, 'Computadoras', 'TechCorp', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80', TRUE),
('Auriculares NoiseCancelling', 'Auriculares inalámbricos con cancelación de ruido activa.', 199.99, 30, 'Audio', 'SoundMax', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', TRUE),
('Smartwatch FitTracker', 'Reloj inteligente con monitor de ritmo cardíaco y GPS.', 149.00, 50, 'Wearables', 'FitTech', 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=80', TRUE),
('Monitor Gamer 144Hz', 'Monitor curvo de 27 pulgadas, 144Hz, 1ms.', 299.99, 0, 'Periféricos', 'VisionPlus', 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80', FALSE),
('Teclado Mecánico RGB', 'Teclado mecánico con switches blue y retroiluminación RGB.', 79.99, 25, 'Periféricos', 'KeyMaster', 'https://images.unsplash.com/photo-1595225476474-87563907a212?w=500&q=80', TRUE)
ON DUPLICATE KEY UPDATE id=id;

-- 3. Favoritos
CREATE TABLE IF NOT EXISTS favorites (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  product_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_product (user_id, product_id)
);

-- 4. Carritos
CREATE TABLE IF NOT EXISTS carts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE, -- Un usuario tiene un único carrito activo
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Items del carrito
CREATE TABLE IF NOT EXISTS cart_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cart_id    INT NOT NULL,
  product_id INT NOT NULL,
  cantidad   INT NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY unique_cart_product (cart_id, product_id)
);

-- 6. Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  total       DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
  status      ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- 7. Items del pedido (conservan precio y nombre)
CREATE TABLE IF NOT EXISTS order_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  order_id       INT NOT NULL,
  product_id     INT, -- Puede ser nulo si el producto se borra, pero el pedido se conserva
  nombre_prod    VARCHAR(150) NOT NULL, -- Copia del nombre
  precio_unitario DECIMAL(10, 2) NOT NULL, -- Precio al momento de compra
  cantidad       INT NOT NULL CHECK (cantidad > 0),
  subtotal       DECIMAL(10, 2) NOT NULL,
  
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

