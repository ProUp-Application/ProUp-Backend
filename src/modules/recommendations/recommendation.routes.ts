import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { appliedSchema, feedbackSchema } from './recommendation.schemas';
import { appliedHandler, feedbackHandler } from './recommendation.controller';

const router = Router();

router.use(requireAuth);

router.post('/:id/feedback', validateBody(feedbackSchema), feedbackHandler);
router.patch('/:id/applied', validateBody(appliedSchema), appliedHandler);

export default router;
