import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../lib/prisma';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    // Verifica conectividad con la base de datos
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'proup-backend', db: 'up', version: '0.4.0' });
  }),
);

export default router;
