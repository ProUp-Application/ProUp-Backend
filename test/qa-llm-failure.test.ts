import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { llmComplete, isLlmEnabled } from '../src/lib/llm';
import { qaLlmFailureMiddleware, LLM_FAILURE_HEADER } from '../src/lib/qaContext';
import { smartFallback, type AdvisorContext } from '../src/modules/chat/chat.service';

// H03 (CP036): con QA_LLM_FAILURE_SIMULATION=true y la cabecera, el LLM "cae" solo en
// esa petición y el asesor responde con su respaldo por palabras clave.

const ctx: AdvisorContext = { firstName: 'Ana', prof: 'Ingeniería de Sistemas', level: 'junior', analysis: null, interview: null };

const realFetch = globalThis.fetch;
let llmCalls = 0;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('api.groq.com') || url.includes('generativelanguage.googleapis.com')) {
    llmCalls++;
    const body = { choices: [{ message: { content: 'Respuesta del LLM' } }], candidates: [{ content: { parts: [{ text: 'Respuesta del LLM' }] } }] };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(input, init);
}) as typeof fetch;

async function withServer(enabled: boolean, fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(qaLlmFailureMiddleware(enabled));
  app.get('/reply', async (_req, res) => {
    const msg = '¿Cómo me preparo para una entrevista?';
    const llm = await llmComplete([{ role: 'user', content: msg }]);
    res.json({ fromLlm: llm !== null, reply: llm ?? smartFallback(msg, ctx) });
  });
  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    server.close();
  }
}

test('con la simulación apagada, la cabecera se ignora y se llama al LLM', async (t) => {
  if (!isLlmEnabled()) return t.skip('sin LLM configurado en este entorno');
  await withServer(false, async (base) => {
    llmCalls = 0;
    const r = (await (await realFetch(`${base}/reply`, { headers: { [LLM_FAILURE_HEADER]: '1' } })).json()) as {
      fromLlm: boolean;
    };
    assert.equal(r.fromLlm, true);
    assert.equal(llmCalls, 1);
  });
});

test('con la simulación encendida y la cabecera, el asesor usa la respuesta de respaldo', async () => {
  await withServer(true, async (base) => {
    llmCalls = 0;
    const r = (await (await realFetch(`${base}/reply`, { headers: { [LLM_FAILURE_HEADER]: '1' } })).json()) as {
      fromLlm: boolean;
      reply: string;
    };
    assert.equal(r.fromLlm, false);
    assert.equal(llmCalls, 0, 'no debe llegar a llamar al proveedor');
    assert.match(r.reply, /entrevista|STAR|logros/i);
  });
});

test('con la simulación encendida pero sin cabecera, no se altera nada', async (t) => {
  if (!isLlmEnabled()) return t.skip('sin LLM configurado en este entorno');
  await withServer(true, async (base) => {
    llmCalls = 0;
    const r = (await (await realFetch(`${base}/reply`)).json()) as { fromLlm: boolean };
    assert.equal(r.fromLlm, true);
    assert.equal(llmCalls, 1);
  });
});
