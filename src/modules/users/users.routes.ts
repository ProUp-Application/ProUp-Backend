import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { consentSchema, updateProfileSchema } from './users.schemas';
import {
  deleteAccountHandler,
  exportDataHandler,
  getProfileHandler,
  listConsentsHandler,
  setConsentHandler,
  updateProfileHandler,
} from './users.controller';

const router = Router();

router.use(requireAuth); // todo este módulo requiere autenticación

router.get('/me/profile', getProfileHandler);
router.put('/me/profile', validateBody(updateProfileSchema), updateProfileHandler);

// Derechos ARCO (Ley 29733)
router.get('/me/export', exportDataHandler); // Acceso
router.delete('/me', deleteAccountHandler); // Cancelación (borrado en cascada)
router.get('/me/consents', listConsentsHandler);
router.put('/me/consents', validateBody(consentSchema), setConsentHandler); // Oposición/actualización

export default router;
