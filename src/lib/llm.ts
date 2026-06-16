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

async function callGroq(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 800,
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

async function callGemini(
  messages: LlmMessage[],
  opts: { temperature?: number; maxTokens?: number },
): Promise<string | null> {
  // Gemini no tiene "system": se antepone como contexto del primer turno.
  const system = messages.find((m) => m.role === 'system')?.content;
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
