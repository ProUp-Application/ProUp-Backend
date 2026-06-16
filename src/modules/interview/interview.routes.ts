import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { startInterviewSchema, submitInterviewSchema } from './interview.schemas';
import { getHandler, listHandler, startHandler, submitHandler } from './interview.controller';

const router = Router();

router.use(requireAuth);

router.post('/start', validateBody(startInterviewSchema), startHandler);
router.post('/:id/submit', validateBody(submitInterviewSchema), submitHandler);
router.get('/', listHandler);
router.get('/:id', getHandler);

export default router;
