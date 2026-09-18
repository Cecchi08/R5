import { hash, challengeFor, equal, randomSecret } from './crypto.js';
export { hash, challengeFor, equal } from './crypto.js';
import pool from '../db.js';

export async function consumeState(state, browser, provider) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM oauth_states WHERE state_hash = ? AND expires_at > NOW() FOR UPDATE', [hash(state)]);
    const row = rows[0];
    if (!row || row.provider !== provider || !equal(row.browser_hash, hash(browser))) throw new Error('invalid_state');
    await connection.query('DELETE FROM oauth_states WHERE state_hash = ?', [hash(state)]);
    await connection.commit();
    return row;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function socialUser(identity) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT u.* FROM oauth_accounts a JOIN users u ON u.id = a.user_id WHERE a.provider = ? AND a.provider_id = ?', [identity.provider, identity.subject]);
    if (existing[0]) { await connection.commit(); return existing[0]; }
    if (identity.email) {
      const [emails] = await connection.query('SELECT id FROM users WHERE email = ?', [identity.email]);
      if (emails.length) throw new Error('account_exists');
    }
    const [result] = await connection.query("INSERT INTO users (nombre, email, password, rol) VALUES (?, ?, NULL, 'user')", [identity.nombre, identity.email]);
    await connection.query('INSERT INTO oauth_accounts (user_id, provider, provider_id) VALUES (?, ?, ?)', [result.insertId, identity.provider, identity.subject]);
    await connection.commit();
    return { id: result.insertId, nombre: identity.nombre, email: identity.email, rol: 'user' };
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      const [rows] = await connection.query('SELECT u.* FROM oauth_accounts a JOIN users u ON u.id = a.user_id WHERE a.provider = ? AND a.provider_id = ?', [identity.provider, identity.subject]);
      if (rows[0]) return rows[0];
      throw new Error('account_exists');
    }
    throw error;
  } finally { connection.release(); }
}

export async function exchangeCode(code, verifier) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT c.challenge, u.* FROM oauth_codes c JOIN users u ON u.id = c.user_id WHERE c.code_hash = ? AND c.expires_at > NOW() FOR UPDATE', [hash(code)]);
    if (!rows[0] || !equal(rows[0].challenge, challengeFor(verifier))) throw new Error('invalid_code');
    await connection.query('DELETE FROM oauth_codes WHERE code_hash = ?', [hash(code)]);
    await connection.commit();
    return rows[0];
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}


export async function createState({ state, browser, provider, verifier, challenge, returnUrl }) {
  await pool.query('DELETE FROM oauth_states WHERE expires_at <= NOW()');
  await pool.query('DELETE FROM oauth_codes WHERE expires_at <= NOW()');
  await pool.query(
    'INSERT INTO oauth_states (state_hash, browser_hash, provider, verifier, challenge, return_url, expires_at) VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
    [hash(state), hash(browser), provider, verifier, challenge, returnUrl],
  );
}

export async function createLoginCode(userId, challenge) {
  const code = randomSecret();
  await pool.query(
    'INSERT INTO oauth_codes (code_hash, user_id, challenge, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE))',
    [hash(code), userId, challenge],
  );
  return code;
}
