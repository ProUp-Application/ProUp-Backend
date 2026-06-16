import { Router } from 'express';
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import analysisRoutes from './modules/analysis/analysis.routes';
import recommendationRoutes from './modules/recommendations/recommendation.routes';
import interviewRoutes from './modules/interview/interview.routes';
import chatRoutes from './modules/chat/chat.routes';

const router = Router();

// Rutas de la API (versión 1)
router.use('/auth', authRoutes); // registro / login / refresh / me
router.use('/users', usersRoutes); // perfil + derechos ARCO
router.use('/analysis', analysisRoutes); // recibe scores on-device + genera recomendaciones
router.use('/recommendations', recommendationRoutes); // feedback / aplicar
router.use('/interview', interviewRoutes); // simulador de entrevistas
router.use('/chat', chatRoutes); // chatbot

export { healthRoutes };
export default router;
