import { Router } from 'express';
import { authLimit } from '../middleware/authLimit.js';
import { listProviders, startOAuth, completeOAuth, exchangeOAuthCode } from '../auth/oauth/controller.js';

const router = Router();
router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  next();
});
router.get('/providers', listProviders);
router.post('/exchange', authLimit, exchangeOAuthCode);
router.get('/:provider/start', authLimit, startOAuth);
router.get('/:provider/callback', completeOAuth);

export default router;
