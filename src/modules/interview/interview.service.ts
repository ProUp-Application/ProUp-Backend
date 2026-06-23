import { prisma } from '../../lib/prisma';
import { llmComplete } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { findProfession, professionLabel, Profession } from '../../shared/professions';
import { SubmitInterviewInput } from './interview.schemas';

// Bancos de preguntas de respaldo (cuando no hay LLM), diferenciados por tipo de entrevista.
const TRACK_BANKS: Record<string, string[]> = {
  'Comportamental General': [
    'Cuéntame sobre ti y tu trayectoria como {prof}.',
    'Describe una situación laboral difícil y cómo la resolviste (usa el método STAR).',
    '¿Cuál ha sido tu mayor logro profesional hasta ahora y por qué?',
    'Cuéntame de una vez en que trabajaste en equipo bajo presión.',
    '¿Por qué deberíamos contratarte para este puesto?',
  ],
  'Presencia Ejecutiva': [
    'Como {prof}, ¿cómo lideras a un equipo en un proyecto complejo?',
    'Describe cómo comunicarías una mala noticia a un cliente o jefe.',
    '¿Cómo manejas un desacuerdo con un superior manteniendo el profesionalismo?',
    'Cuéntame de una decisión difícil que tomaste y el impacto que tuvo.',
    '¿Cómo proyectas confianza y autoridad en una reunión clave?',
  ],
  'Elevator Pitch': [
    'Tienes 60 segundos: preséntate como {prof} ante un reclutador.',
    'En una sola frase, ¿qué te hace destacar frente a otros {prof}?',
    '¿Cuál es tu propuesta de valor profesional?',
    'Resume tu objetivo de carrera en 30 segundos.',
    'Convénceme en un minuto de que eres el candidato ideal.',
  ],
};

function technicalBank(prof: Profession): string[] {
  const t = prof.topics;
  return [
    `Explícame tu experiencia con ${t[0]}.`,
    `¿Cómo abordarías un caso real relacionado con ${t[1]}?`,
    `¿Qué herramientas o métodos utilizas para ${t[2]}?`,
    `Describe un problema de ${t[3]} que hayas resuelto y cómo lo hiciste.`,
    `¿Cómo te mantienes actualizado/a como ${prof.label}?`,
  ];
}

function fallbackQuestions(track: string, prof: Profession): string[] {
  const bank =
    track.toLowerCase().includes('técnic') || track.toLowerCase().includes('tecnic') || track.toLowerCase().includes('caso')
      ? technicalBank(prof)
      : TRACK_BANKS[track] ?? TRACK_BANKS['Comportamental General'];
  return bank.map((q) => q.replaceAll('{prof}', prof.label.toLowerCase()));
}

/** Inicia una simulación: preguntas adaptadas a la PROFESIÓN y al TIPO de entrevista. */
export async function startInterview(userId: string, track: string) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const prof = findProfession(profile?.profession) ?? findProfession('otra')!;

  const questions = await generateQuestions(track, prof);

  const simulation = await prisma.interviewSimulation.create({
    data: { userId, track: `${track} · ${prof.label}`, questions },
  });

  return { id: simulation.id, track, profession: prof.label, questions };
}

async function generateQuestions(track: string, prof: Profession): Promise<string[]> {
  const raw = await llmComplete(
    [
      {
        role: 'system',
        content:
          'Eres un reclutador peruano experto. Generas preguntas de entrevista realistas, claras y específicas a la profesión y al tipo de entrevista. Devuelve SOLO un arreglo JSON de 5 strings en español, sin texto adicional.',
      },
      {
        role: 'user',
        content: `Genera 5 preguntas para una entrevista de tipo "${track}" dirigida a un(a) ${prof.label} (joven profesional en Lima, Perú). Considera estos temas del rubro: ${prof.topics.join(', ')}.`,
      },
    ],
    { temperature: 0.85, maxTokens: 450 },
  );

  const parsed = tryParseStringArray(raw);
  return parsed && parsed.length > 0 ? parsed.slice(0, 6) : fallbackQuestions(track, prof);
}

export async function submitInterview(userId: string, id: string, input: SubmitInterviewInput) {
  const sim = await prisma.interviewSimulation.findUnique({ where: { id } });
  if (!sim || sim.userId !== userId) throw AppError.notFound('Simulación no encontrada');

  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const evaluation = await evaluateResponses(input, professionLabel(profile?.profession));

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

  await prisma.auditEvent.create({ data: { userId, eventType: 'INTERVIEW_COMPLETED', requestId: id } });
  return updated;
}

interface Evaluation {
  contentScore: number;
  strengths: string[];
  improvements: string[];
  feedback: string;
}

async function evaluateResponses(input: SubmitInterviewInput, prof: string): Promise<Evaluation> {
  const transcript = input.responses.map((r, i) => `P${i + 1}: ${r.question}\nR${i + 1}: ${r.answer}`).join('\n\n');

  const raw = await llmComplete(
    [
      {
        role: 'system',
        content:
          `Eres un coach de entrevistas peruano especializado en el rubro de ${prof}. Evalúas respuestas y devuelves SOLO un objeto JSON: {"contentScore": number(0-100), "strengths": string[], "improvements": string[], "feedback": string}. En español, conciso y constructivo.`,
      },
      { role: 'user', content: `Evalúa esta entrevista de un(a) ${prof}:\n\n${transcript}` },
    ],
    { temperature: 0.5, maxTokens: 600 },
  );

  const parsed = tryParseEvaluation(raw);
  if (parsed) return parsed;

  const avgLen = input.responses.reduce((a, r) => a + r.answer.trim().length, 0) / input.responses.length;
  const contentScore = Math.max(40, Math.min(90, Math.round(40 + avgLen / 6)));
  return {
    contentScore,
    strengths: ['Completaste todas las preguntas de la simulación.'],
    improvements: [
      'Estructura tus respuestas con el método STAR (Situación, Tarea, Acción, Resultado).',
      `Incluye ejemplos concretos y resultados medibles de tu experiencia como ${prof}.`,
    ],
    feedback:
      'Buen esfuerzo. Para destacar, desarrolla más tus respuestas con ejemplos específicos de tu rubro y cuida tu comunicación no verbal (contacto visual y postura).',
  };
}

export async function listInterviews(userId: string) {
  return prisma.interviewSimulation.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function getInterview(userId: string, id: string) {
  const sim = await prisma.interviewSimulation.findUnique({ where: { id } });
  if (!sim || sim.userId !== userId) throw AppError.notFound('Simulación no encontrada');
  return sim;
}

// ---- helpers de parseo del JSON del LLM ----
function stripFences(s: string): string {
  return s.replace(/```json/gi, '').replace(/```/g, '').trim();
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
