import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

/** Valida y normaliza req.body contra un esquema zod. */
export const validateBody =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(result.error);
    }
    req.body = result.data;
    return next();
  };
