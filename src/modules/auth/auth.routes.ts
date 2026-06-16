import { Router } from 'express';
import { validateBody } from '../../middleware/validate';
import { requireAuth } from '../../middleware/authMiddleware';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas';
import { loginHandler, meHandler, refreshHandler, registerHandler } from './auth.controller';

const router = Router();

router.post('/register', validateBody(registerSchema), registerHandler);
router.post('/login', validateBody(loginSchema), loginHandler);
router.post('/refresh', validateBody(refreshSchema), refreshHandler);
router.get('/me', requireAuth, meHandler);

export default router;
