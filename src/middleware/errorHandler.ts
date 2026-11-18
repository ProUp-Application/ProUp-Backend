import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../lib/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Errores controlados de la aplicación
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Errores de validación (zod): el mensaje dice QUÉ campo falla, no solo "Datos inválidos"
  if (err instanceof ZodError) {
    const flat = err.flatten();
    const first =
      Object.values(flat.fieldErrors as Record<string, string[] | undefined>).flat().find(Boolean) ??
      flat.formErrors[0];
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: first ?? 'Datos inválidos',
        details: flat.fieldErrors,
      },
    });
  }

  // Archivo demasiado grande u otro error al recibir un archivo
  if (err instanceof MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: tooLarge
          ? 'El archivo es demasiado grande. Usa uno de menos de 8 MB.'
          : 'No se pudo recibir el archivo. Inténtalo de nuevo.',
      },
    });
  }

  // Violación de unicidad en Prisma (p. ej. email duplicado)
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: 'El recurso ya existe' },
    });
  }

  logger.error({ err }, 'Error no controlado');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: ' Error interno del servidor' },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
}
