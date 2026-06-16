import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { createSessionSchema, sendMessageSchema } from './chat.schemas';
import {
  createSessionHandler,
  getMessagesHandler,
  listSessionsHandler,
  sendMessageHandler,
} from './chat.controller';

const router = Router();

router.use(requireAuth);

router.post('/sessions', validateBody(createSessionSchema), createSessionHandler);
router.get('/sessions', listSessionsHandler);
router.get('/sessions/:id/messages', getMessagesHandler);
router.post('/sessions/:id/messages', validateBody(sendMessageSchema), sendMessageHandler);

export default router;
