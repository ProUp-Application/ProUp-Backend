import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';

export const asyncHandler = (
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
};
