import { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../errors/AppError.js';

interface TokenPayload {
  sub: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export const authenticate = (request: Request, _response: Response, next: NextFunction): void => {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Unauthorized', 401);
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    request.user = { sub: decoded.sub, email: decoded.email };
    next();
  } catch {
    throw new AppError('Unauthorized', 401);
  }
};
