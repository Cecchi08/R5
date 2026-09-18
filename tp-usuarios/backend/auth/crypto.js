import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const randomSecret = () => randomBytes(32).toString('base64url');
export const validSecret = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const validVerifier = value => typeof value === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(value);
export const hash = value => createHash('sha256').update(value).digest('hex');
export const challengeFor = value => createHash('sha256').update(value).digest('base64url');
export const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
