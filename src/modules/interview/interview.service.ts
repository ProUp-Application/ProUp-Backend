import { prisma } from '../../lib/prisma';
import { llmComplete } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { findProfession, professionLabel, Profession } from '../../shared/professions';
import { SubmitInterviewInput } from './interview.schemas';

// ---------------------------------------------------------------------------
//  Tipos de entrevista (tracks)
//  - BEHAVIORAL: situaciones laborales reales y comunes (STAR), NO técnicas.
//  - TECHNICAL:  preguntas técnicas/de caso según la carrera del usuario.
//  - EXECUTIVE:  escenarios de liderazgo/stakeholders realistas para un joven
//                profesional (sin asumir que ya es gerente).
//  - PITCH:      consignas de elevator pitch de ~60 segundos (3, no 5).
// ---------------------------------------------------------------------------
type TrackKind = 'BEHAVIORAL' | 'TECHNICAL' | 'EXECUTIVE' | 'PITCH';

function classifyTrack(track: string): TrackKind {
  const t = track.toLowerCase();
  if (t.includes('técnic') || t.includes('tecnic') || t.includes('caso')) return 'TECHNICAL';
  if (t.includes('ejecutiv') || t.includes('presencia')) return 'EXECUTIVE';
  if (t.includes('pitch') || t.includes('elevator')) return 'PITCH';
  return 'BEHAVIORAL';
}

const LEVEL_LABELS: Record<string, string> = {
  STUDENT: 'estudiante de últimos ciclos',
  JUNIOR: 'junior (0-2 años de experiencia)',
  SEMI_SENIOR: 'semi senior (2-5 años de experiencia)',
  SENIOR: 'senior (5+ años de experiencia)',
};

// ----------------------- Bancos de respaldo (sin LLM) -----------------------

function behavioralBank(prof: Profession): string[] {
  const p = prof.label.toLowerCase();
  return [
    `Cuéntame sobre ti y tu experiencia como ${p}.`,
    'Describe una situación difícil con un compañero de trabajo o de estudios y cómo la manejaste.',
    'Cuéntame de una vez en que tuviste que cumplir un plazo muy ajustado: ¿qué hiciste?',
    'Háblame de un error que cometiste: ¿cómo lo corregiste y qué aprendiste?',
    'Describe una ocasión en la que tuviste que adaptarte a un cambio inesperado.',
  ];
}

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

function executiveBank(): string[] {
  return [
    'Imagina que debes presentar un avance a un gerente y hay un retraso importante: ¿cómo comunicas la situación?',
    'Cuéntame de una vez en que tuviste que defender una idea ante alguien con más experiencia que tú.',
    '¿Cómo manejarías un desacuerdo con tu jefe sin perder la relación profesional?',
    'Describe cómo organizarías y liderarías una reunión de trabajo efectiva.',
    '¿Cómo construyes credibilidad cuando eres la persona más joven del equipo?',
  ];
}

function pitchBank(prof: Profession): string[] {
  const p = prof.label.toLowerCase();
  return [
    'Preséntate en 60 segundos ante un reclutador en una feria laboral: quién eres, qué haces y qué buscas.',
    `Tienes 60 segundos en un ascensor con un gerente del sector: convéncelo de agendar una reunión contigo como ${p}.`,
    'Cierra una entrevista con un resumen de 30-60 segundos de por qué eres el candidato ideal para el puesto.',
  ];
}

function fallbackQuestions(kind: TrackKind, prof: Profession): string[] {
  switch (kind) {
    case 'TECHNICAL':
      return technicalBank(prof);
    case 'EXECUTIVE':
      return executiveBank();
    case 'PITCH':
      return pitchBank(prof);
    default:
      return behavioralBank(prof);
  }
}

// ----------------------- Generación con LLM -----------------------

function questionInstructions(kind: TrackKind, prof: Profession, level: string | null): string {
  const levelTxt = level ? ` de nivel ${level}` : '';
  switch (kind) {
    case 'BEHAVIORAL':
      return (
        `Genera 5 preguntas CONDUCTUALES sobre situaciones laborales REALES y COMUNES ` +
        `(trabajo en equipo, conflictos, plazos ajustados, errores y aprendizaje, adaptación al cambio, comunicación). ` +
        `Deben poder responderse con el método STAR. NO hagas preguntas técnicas. ` +
        `Dirigidas a un(a) ${prof.label}${levelTxt}, joven profesional en Lima, Perú.`
      );
    case 'TECHNICAL':
      return (
        `Genera 5 preguntas TÉCNICAS o de CASO específicas para un(a) ${prof.label}${levelTxt} en Lima, Perú. ` +
        `Basadas en estos temas del rubro: ${prof.topics.join(', ')}. ` +
        `Deben ser realistas para el nivel indicado (no pidas experiencia gerencial a un junior) y aplicadas al mercado peruano.`
      );
    case 'EXECUTIVE':
      return (
        `Genera 5 ESCENARIOS de presencia ejecutiva y liderazgo apropiados para un(a) joven ${prof.label}${levelTxt} ` +
        `que ASPIRA a roles de liderazgo (aún no es gerente): comunicar malas noticias a un superior, defender una idea ante alguien más senior, ` +
        `liderar una reunión, manejar desacuerdos con criterio, construir credibilidad siendo joven. ` +
        `Formúlalos como preguntas o situaciones realistas, sin asumir que ya dirige equipos grandes.`
      );
    case 'PITCH':
      return (
        `Genera exactamente 3 CONSIGNAS de elevator pitch de 60 segundos para un(a) ${prof.label}${levelTxt} en Lima, Perú. ` +
        `Cada consigna debe plantear un contexto distinto (por ejemplo: feria laboral con reclutador, encuentro casual con un gerente del sector, cierre de una entrevista) ` +
        `y pedir explícitamente que se presente en un tiempo límite. Redáctalas como instrucciones claras, no como preguntas.`
      );
  }
}

async function generateQuestions(kind: TrackKind, track: string, prof: Profession, level: string | null): Promise<string[]> {
  const raw = await llmComplete(
    [
      {
        role: 'system',
        content:
          'Eres un reclutador peruano experto en entrevistas laborales. Devuelve SOLO un arreglo JSON de strings en español, sin texto adicional ni markdown.',
      },
      { role: 'user', content: questionInstructions(kind, prof, level) },
    ],
    { temperature: 0.85, maxTokens: 500 },
  );

  const parsed = tryParseStringArray(raw);
  const expected = kind === 'PITCH' ? 3 : 5;
  if (parsed && parsed.length > 0) return parsed.slice(0, expected + 1);
  return fallbackQuestions(kind, prof);
}

/** Inicia una simulación: preguntas según el TIPO de entrevista y la PROFESIÓN/nivel. */
export async function startInterview(userId: string, track: string) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const prof = findProfession(profile?.profession) ?? findProfession('otra')!;
  const level = profile?.experienceLevel ? LEVEL_LABELS[profile.experienceLevel] ?? null : null;
  const kind = classifyTrack(track);

  const questions = await generateQuestions(kind, track, prof, level);

  const simulation = await prisma.interviewSimulation.create({
    data: { userId, track: `${track} · ${prof.label}`, questions },
  });

  return { id: simulation.id, track, profession: prof.label, questions };
}

// ----------------------- Evaluación -----------------------

function evaluationRubric(kind: TrackKind, prof: string): string {
  switch (kind) {
    case 'BEHAVIORAL':
      return 'Evalúa la estructura STAR (Situación, Tarea, Acción, Resultado), la concreción de los ejemplos y los resultados mencionados.';
    case 'TECHNICAL':
      return `Evalúa la exactitud y profundidad técnica de las respuestas según lo esperable para un(a) ${prof}, y la claridad al explicar conceptos.`;
    case 'EXECUTIVE':
      return 'Evalúa la madurez profesional, la claridad al comunicar, el manejo de stakeholders y la seguridad sin arrogancia. Considera que es un joven profesional, no un gerente.';
    case 'PITCH':
      return 'Evalúa el pitch: claridad, concisión (¿cabe en 60 segundos?), propuesta de valor diferenciada, gancho inicial y cierre con llamada a la acción.';
  }
}

export async function submitInterview(userId: string, id: string, input: SubmitInterviewInput) {
  const sim = await prisma.interviewSimulation.findUnique({ where: { id } });
  if (!sim || sim.userId !== userId) throw AppError.notFound('Simulación no encontrada');

  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const prof = professionLabel(profile?.profession);
  const kind = classifyTrack(sim.track ?? '');

  const evaluation = await evaluateResponses(input, prof, kind);

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

async function evaluateResponses(input: SubmitInterviewInput, prof: string, kind: TrackKind): Promise<Evaluation> {
  const transcript = input.responses.map((r, i) => `P${i + 1}: ${r.question}\nR${i + 1}: ${r.answer}`).join('\n\n');

  const raw = await llmComplete(
    [
      {
        role: 'system',
        content:
          `Eres un coach de entrevistas peruano especializado en el rubro de ${prof}. ${evaluationRubric(kind, prof)} ` +
          'Devuelve SOLO un objeto JSON: {"contentScore": number(0-100), "strengths": string[], "improvements": string[], "feedback": string}. ' +
          'En español, concreto y constructivo; las mejoras deben ser accionables.',
      },
      { role: 'user', content: `Evalúa esta simulación de un(a) ${prof}:\n\n${transcript}` },
    ],
    { temperature: 0.5, maxTokens: 650 },
  );

  const parsed = tryParseEvaluation(raw);
  if (parsed) return parsed;

  const avgLen = input.responses.reduce((a, r) => a + r.answer.trim().length, 0) / input.responses.length;
  const contentScore = Math.max(40, Math.min(90, Math.round(40 + avgLen / 6)));
  return {
    contentScore,
    strengths: ['Completaste todas las preguntas de la simulación.'],
    improvements: [
      kind === 'PITCH'
        ? 'Practica tu pitch en voz alta y cronométralo: debe caber en 60 segundos con un cierre claro.'
        : 'Estructura tus respuestas con el método STAR (Situación, Tarea, Acción, Resultado).',
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
