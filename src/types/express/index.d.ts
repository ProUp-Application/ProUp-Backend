// Aumenta el Request de Express para exponer el id del usuario autenticado.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
