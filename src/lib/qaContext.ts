import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Simulación de caída del LLM SOLO para pruebas de QA (hallazgo H03, CP036).
 *
 * Con la variable QA_LLM_FAILURE_SIMULATION=true, una petición que envíe la cabecera
 * `x-simulate-llm-failure: 1` hace que toda llamada al LLM de esa petición falle, así
 * se comprueba la respuesta de respaldo sin apagar Groq ni tocar la API key.
 * Sin la variable (valor por defecto, también en producción) la cabecera se ignora.
 */
interface QaContext {
  simulateLlmFailure: boolean;
}

const storage = new AsyncLocalStorage<QaContext>();

export const LLM_FAILURE_HEADER = 'x-simulate-llm-failure';

export function isLlmFailureSimulated(): boolean {
  return storage.getStore()?.simulateLlmFailure === true;
}

/** Ejecuta `fn` como si la petición actual pidiera simular la caída del LLM (útil en tests). */
export function runWithQaContext<T>(ctx: QaContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function qaLlmFailureMiddleware(enabled: boolean = env.QA_LLM_FAILURE_SIMULATION): RequestHandler {
  return (req, _res, next) => {
    const asked = ['1', 'true'].includes(String(req.headers[LLM_FAILURE_HEADER] ?? '').toLowerCase());
    if (!enabled || !asked) return next();
    logger.warn({ path: req.path }, 'QA: se simula la caída del LLM en esta petición');
    storage.run({ simulateLlmFailure: true }, next);
  };
}
