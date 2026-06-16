import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRoutes, { healthRoutes } from './routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  // Health check (para plataformas de despliegue y para el cliente)
  app.use('/health', healthRoutes);

  // API v1
  app.use('/api/v1', apiRoutes);

  // 404 + manejador de errores (al final)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
