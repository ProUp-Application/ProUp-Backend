import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/authMiddleware';
import { validateBody } from '../../middleware/validate';
import { analyzeCvSchema, exportCvSchema, improveCvSchema, matchVacancySchema } from './cv.schemas';
import { analyzeHandler, exportDocxHandler, extractHandler, improveHandler, matchHandler } from './cv.controller';

// El archivo se procesa en memoria y no se escribe en disco ni en la base de datos
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

router.post('/extract', upload.single('file'), extractHandler);
router.post('/analyze', validateBody(analyzeCvSchema), analyzeHandler);
router.post('/improve', validateBody(improveCvSchema), improveHandler);
router.post('/docx', validateBody(exportCvSchema), exportDocxHandler);
router.post('/match', validateBody(matchVacancySchema), matchHandler);

export default router;
