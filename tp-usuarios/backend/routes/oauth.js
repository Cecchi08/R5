import { Router } from 'express';
import { authLimit } from '../middleware/authLimit.js';
import { diagnostics, listProviders, startOAuth, completeOAuth, exchangeOAuthCode } from '../auth/oauth/controller.js';
import { OAUTH_CALLBACK_ROUTE } from '../auth/oauth/paths.js';

const router = Router();
router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  next();
});
router.get('/providers', listProviders);
router.get('/diagnostics', diagnostics);
router.post('/exchange', authLimit, exchangeOAuthCode);
router.get('/:provider/start', authLimit, startOAuth);
router.get(OAUTH_CALLBACK_ROUTE, completeOAuth);

export default router;
