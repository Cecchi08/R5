import pool from '../db.js';

export async function ensureAuthSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(50) NOT NULL,
    email VARCHAR(100) NULL UNIQUE, password VARCHAR(255) NULL,
    rol ENUM('user','admin') NOT NULL DEFAULT 'user',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  const [columns] = await pool.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('email', 'password') AND IS_NULLABLE = 'NO'");
  if (columns.length) await pool.query('ALTER TABLE users MODIFY email VARCHAR(100) NULL, MODIFY password VARCHAR(255) NULL');
  await pool.query(`CREATE TABLE IF NOT EXISTS oauth_accounts (
    id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
    provider VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    provider_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY provider_identity (provider, provider_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    browser_hash CHAR(64) NOT NULL, provider VARCHAR(20) NOT NULL,
    verifier VARCHAR(128) NOT NULL, challenge VARCHAR(64) NOT NULL,
    return_url VARCHAR(512) NOT NULL, expires_at DATETIME NOT NULL,
    INDEX state_expiration (expires_at)
  ) ENGINE=InnoDB`);
  await pool.query(`CREATE TABLE IF NOT EXISTS oauth_codes (
    code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    user_id INT NOT NULL, challenge VARCHAR(64) NOT NULL, expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX code_expiration (expires_at)
  ) ENGINE=InnoDB`);
}
