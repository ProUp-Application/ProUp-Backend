import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { createAnalysisSchema } from './analysis.schemas';
import {
  createAnalysisHandler,
  getAnalysisHandler,
  listAnalysesHandler,
} from './analysis.controller';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createAnalysisSchema), createAnalysisHandler);
router.get('/', listAnalysesHandler);
router.get('/:id', getAnalysisHandler);

export default router;
