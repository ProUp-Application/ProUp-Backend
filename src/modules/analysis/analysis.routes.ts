import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { createAnalysisSchema } from './analysis.schemas';
import {
  createAnalysisHandler,
  getAnalysisHandler,
  listAnalysesHandler,
  statsHandler,
} from './analysis.controller';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createAnalysisSchema), createAnalysisHandler);
router.get('/', listAnalysesHandler);
// Antes de '/:id' para que 'stats' no se interprete como un id
router.get('/stats', statsHandler);
router.get('/:id', getAnalysisHandler);

export default router;
