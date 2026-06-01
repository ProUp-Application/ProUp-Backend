import { type NextFunction, type Request, type Response } from 'express';
import { type ZodType } from 'zod';

export const validateRequest = <T>(schema: ZodType<T>) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    request.body = schema.parse(request.body);
    next();
  };
};
