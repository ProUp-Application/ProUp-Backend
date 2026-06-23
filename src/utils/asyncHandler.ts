import { NextFunction, Request, Response, RequestHandler } from 'express';

/** Envuelve un handler async para que los errores lleguen al errorHandler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
