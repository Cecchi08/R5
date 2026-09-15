export const validEmail = value => typeof value === 'string' && value.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const validPassword = value => typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\s\S]+$/.test(value);
export const validName = value => typeof value === 'string' && /^[\p{L}][\p{L} '\u2019-]{1,49}$/u.test(value);
export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
