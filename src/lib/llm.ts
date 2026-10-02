import { env } from '../config/env';
import { logger } from './logger';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** ¿Hay un proveedor de LLM configurado con su API key? */
export function isLlmEnabled(): boolean {
  if (env.LLM_PROVIDER === 'groq') return !!env.GROQ_API_KEY;
  if (env.LLM_PROVIDER === 'gemini') return !!env.GEMINI_API_KEY;
  return false;
}

/**
 * Genera una respuesta del LLM gratuito (Groq/Llama o Gemini).
 * Devuelve `null` si no hay LLM configurado o si la llamada falla,
 * para que el llamador use su fallback estático (degradación elegante).
 */
export async function llmComplete(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string | null> {
  try {
    if (env.LLM_PROVIDER === 'groq' && env.GROQ_API_KEY) {
      return await callGroq(messages, opts);
    }
    if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
      return await callGemini(messages, opts);
    }
    return null;
  } catch (err) {
    logger.warn({ err }, 'LLM no disponible, usando fallback');
    return null;
  }
}

/**
 * Modelos de respaldo si el configurado no está disponible:
 * - retirado por Groq (404/400): pasó con llama-3.3-70b-versatile y llama-3.1-8b-instant,
 *   y el chatbot caía siempre al fallback;
 * - límite de uso del plan gratuito (429): cada modelo tiene su propia cuota, así que
 *   con varios usuarios a la vez se reparte la carga en lugar de caer al fallback.
 */
const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
let groqWorkingModel: string | null = null;

async function callGroq(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  const candidates = [...new Set([groqWorkingModel ?? env.GROQ_MODEL, env.GROQ_MODEL, ...GROQ_FALLBACK_MODELS])];

  for (const model of candidates) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 800,
        // gpt-oss "razona" antes de responder y eso consume max_tokens: esfuerzo bajo
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
    });
    // 404 / 400 = modelo inexistente o retirado → no volver a usarlo
    if (res.status === 404 || res.status === 400) {
      if (groqWorkingModel === model) groqWorkingModel = null;
      logger.warn({ model, status: res.status }, 'Modelo de Groq no disponible, probando el siguiente');
      continue;
    }
    // 429 = cuota por minuto agotada en este modelo → probar otro (sin olvidarlo)
    if (res.status === 429) {
      logger.warn({ model }, 'Límite de uso de Groq en este modelo, probando el siguiente');
      continue;
    }
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    groqWorkingModel = model;
    return data.choices?.[0]?.message?.content?.trim() || null;
  }
  throw new Error('Ningún modelo de Groq disponible');
}

async function callGemini(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  // Gemini no tiene "system": se combinan TODOS los mensajes de sistema (incluido
  // el recordatorio de perfil que va al final) en una sola systemInstruction.
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const system = systemParts.length ? systemParts.join('\n\n') : undefined;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 800,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
}
