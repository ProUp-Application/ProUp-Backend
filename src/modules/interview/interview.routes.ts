import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { startInterviewSchema, submitInterviewSchema } from './interview.schemas';
import {
  getHandler,
  listHandler,
  startHandler,
  submitHandler,
  transcribeHandler,
} from './interview.controller';

// Audio en memoria (no se escribe en disco): ~3 min de voz en AAC pesan menos de 3 MB
const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();

router.use(requireAuth);

router.post('/start', validateBody(startInterviewSchema), startHandler);
router.post('/transcribe', audioUpload.single('audio'), transcribeHandler);
router.post('/:id/submit', validateBody(submitInterviewSchema), submitHandler);
router.get('/', listHandler);
router.get('/:id', getHandler);

export default router;
