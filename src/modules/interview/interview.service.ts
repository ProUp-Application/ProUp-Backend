import { prisma } from '../../lib/prisma';
import { llmComplete } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { SubmitInterviewInput } from './interview.schemas';

const FALLBACK_QUESTIONS = [
  'Cuéntame sobre ti y tu trayectoria profesional.',
  '¿Por qué te interesa este puesto y nuestra empresa?',
  '¿Cuál consideras que es tu mayor fortaleza y cómo la has aplicado?',
  'Describe una situación difícil en el trabajo o estudios y cómo la resolviste.',
  '¿Dónde te ves profesionalmente en los próximos cinco años?',
];

/** Inicia una simulación: genera preguntas (LLM o fallback) y crea el registro. */
export async function startInterview(userId: string, track: string) {
  const questions = await generateQuestions(track);

  const simulation = await prisma.interviewSimulation.create({
    data: { userId, track, questions },
  });

  return { id: simulation.id, track, questions };
}

async function generateQuestions(track: string): Promise<string[]> {
  const raw = await llmComplete(
    [
      {
        role: 'system',
        content:
          'Eres un reclutador peruano experto. Generas preguntas de entrevista de trabajo claras y realistas, en español. Devuelve SOLO un arreglo JSON de 5 strings, sin texto adicional.',
      },
      {
        role: 'user',
        content: `Genera 5 preguntas de entrevista para un puesto del sector "${track}" dirigidas a un joven profesional en Lima, Perú.`,
      },
    ],
    { temperature: 0.8, maxTokens: 400 },
  );

  const parsed = tryParseStringArray(raw);
  return parsed && parsed.length > 0 ? parsed.slice(0, 6) : FALLBACK_QUESTIONS;
}

export async function submitInterview(
  userId: string,
  id: string,
  input: SubmitInterviewInput,
) {
  const sim = await prisma.interviewSimulation.findUnique({ where: { id } });
  if (!sim || sim.userId !== userId) throw AppError.notFound('Simulación no encontrada');

  const evaluation = await evaluateResponses(input);

  // Score global: combina contenido (LLM/heurística) con señales no verbales si existen.
  const parts = [evaluation.contentScore];
  if (typeof input.nonVerbalScore === 'number') parts.push(input.nonVerbalScore);
  if (typeof input.confidenceScore === 'number') parts.push(input.confidenceScore);
  const overall = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);

  const updated = await prisma.interviewSimulation.update({
    where: { id },
    data: {
      responses: input.responses,
      durationSeconds: input.durationSeconds,
      nonVerbalScore: input.nonVerbalScore,
      confidenceScore: input.confidenceScore,
      overallScore: overall,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      feedback: evaluation.feedback,
    },
  });

  await prisma.auditEvent.create({
    data: { userId, eventType: 'INTERVIEW_COMPLETED', requestId: id },
  });

  return updated;
}

interface Evaluation {
  contentScore: number;
  strengths: string[];
  improvements: string[];
  feedback: string;
}

async function evaluateResponses(input: SubmitInterviewInput): Promise<Evaluation> {
  const transcript = input.responses
    .map((r, i) => `P${i + 1}: ${r.question}\nR${i + 1}: ${r.answer}`)
    .join('\n\n');

  const raw = await llmComplete(
    [
      {
        role: 'system',
        content:
          'Eres un coach de entrevistas peruano. Evalúas respuestas de entrevista y devuelves SOLO un objeto JSON con esta forma exacta: {"contentScore": number(0-100), "strengths": string[], "improvements": string[], "feedback": string}. En español, conciso y constructivo.',
      },
      { role: 'user', content: `Evalúa esta entrevista:\n\n${transcript}` },
    ],
    { temperature: 0.5, maxTokens: 600 },
  );

  const parsed = tryParseEvaluation(raw);
  if (parsed) return parsed;

  // Fallback heurístico (sin LLM): puntúa por elaboración de las respuestas.
  const avgLen =
    input.responses.reduce((a, r) => a + r.answer.trim().length, 0) / input.responses.length;
  const contentScore = Math.max(40, Math.min(90, Math.round(40 + avgLen / 6)));
  return {
    contentScore,
    strengths: ['Completaste todas las preguntas de la simulación.'],
    improvements: [
      'Estructura tus respuestas con el método STAR (Situación, Tarea, Acción, Resultado).',
      'Incluye ejemplos concretos y resultados medibles de tu experiencia.',
    ],
    feedback:
      'Buen esfuerzo. Para destacar, desarrolla más tus respuestas con ejemplos específicos y cuida tu comunicación no verbal (contacto visual y postura).',
  };
}

export async function listInterviews(userId: string) {
  return prisma.interviewSimulation.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInterview(userId: string, id: string) {
  const sim = await prisma.interviewSimulation.findUnique({ where: { id } });
  if (!sim || sim.userId !== userId) throw AppError.notFound('Simulación no encontrada');
  return sim;
}

// ---- helpers de parseo robusto del JSON del LLM ----
function stripFences(s: string): string {
  return s
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
}

function tryParseStringArray(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(stripFences(raw));
    if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
    return null;
  } catch {
    return null;
  }
}

function tryParseEvaluation(raw: string | null): Evaluation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(stripFences(raw));
    if (typeof v.contentScore !== 'number') return null;
    return {
      contentScore: Math.max(0, Math.min(100, Math.round(v.contentScore))),
      strengths: Array.isArray(v.strengths) ? v.strengths.map(String) : [],
      improvements: Array.isArray(v.improvements) ? v.improvements.map(String) : [],
      feedback: typeof v.feedback === 'string' ? v.feedback : '',
    };
  } catch {
    return null;
  }
}
