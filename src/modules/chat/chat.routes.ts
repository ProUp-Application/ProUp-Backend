import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { createSessionSchema, sendMessageSchema } from './chat.schemas';
import {
  createSessionHandler,
  getMessagesHandler,
  listSessionsHandler,
  sendMessageHandler,
  uploadCvHandler,
} from './chat.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

const router = Router();

router.use(requireAuth);

router.post('/sessions', validateBody(createSessionSchema), createSessionHandler);
router.get('/sessions', listSessionsHandler);
router.get('/sessions/:id/messages', getMessagesHandler);
router.post('/sessions/:id/messages', validateBody(sendMessageSchema), sendMessageHandler);
router.post('/sessions/:id/cv', upload.single('file'), uploadCvHandler);

export default router;
