import { prisma } from '../../lib/prisma';
import { llmComplete, LlmMessage } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { professionLabel } from '../../shared/professions';
import { bandLabel } from '../analysis/scoring';

const LEVEL_LABELS: Record<string, string> = {
  STUDENT: 'estudiante',
  JUNIOR: 'junior',
  SEMI_SENIOR: 'semi senior',
  SENIOR: 'senior',
};

const FORMALITY_LABELS: Record<string, string> = {
  CASUAL: 'casual',
  SEMI_FORMAL: 'semi formal',
  FORMAL: 'formal',
};

interface LatestAnalysis {
  overall: number;
  face: number;
  clothing: number;
  posture: number;
  context: number;
  formality: string | null;
  createdAt: Date;
  topAdvice: string | null;
}

interface LastInterview {
  track: string | null;
  overall: number | null;
  improvements: string[];
}

interface AdvisorContext {
  firstName: string | null;
  prof: string;
  level: string | null;
  analysis: LatestAnalysis | null;
  interview: LastInterview | null;
}

/** Reúne el contexto real del usuario (perfil + último análisis + última entrevista). */
async function buildAdvisorContext(userId: string): Promise<AdvisorContext> {
  const [user, profile, lastResult, lastInterview] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.professionalProfile.findUnique({ where: { userId } }),
    prisma.analysisResult.findFirst({
      where: { analysisRequest: { userId } },
      orderBy: { createdAt: 'desc' },
      include: { recommendations: { orderBy: { priority: 'asc' }, take: 1 } },
    }),
    prisma.interviewSimulation.findFirst({
      where: { userId, overallScore: { not: null } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const rec = lastResult?.recommendations?.[0];

  return {
    firstName: user?.firstName ?? null,
    prof: professionLabel(profile?.profession),
    level: profile?.experienceLevel ? LEVEL_LABELS[profile.experienceLevel] ?? null : null,
    analysis: lastResult
      ? {
          overall: lastResult.overallScore,
          face: lastResult.faceScore,
          clothing: lastResult.clothingScore,
          posture: lastResult.postureScore,
          context: lastResult.contextScore,
          formality: lastResult.clothingFormality,
          createdAt: lastResult.createdAt,
          topAdvice: rec?.naturalLanguageAdvice ?? rec?.description ?? null,
        }
      : null,
    interview: lastInterview
      ? {
          track: lastInterview.track,
          overall: lastInterview.overallScore,
          improvements: Array.isArray(lastInterview.improvements)
            ? (lastInterview.improvements as unknown[]).map(String)
            : [],
        }
      : null,
  };
}

function describeAnalysis(a: LatestAnalysis): string {
  const formality = a.formality ? ` (formalidad ${FORMALITY_LABELS[a.formality] ?? a.formality})` : '';
  return (
    `puntaje global ${a.overall}/100 (${bandLabel(a.overall)}), ` +
    `rostro/expresión ${a.face}, vestimenta ${a.clothing}${formality}, ` +
    `postura ${a.posture}, entorno/iluminación ${a.context}`
  );
}

function systemPrompt(ctx: AdvisorContext): string {
  const lines = [
    'Eres ProUp, el asesor virtual de carrera de la app móvil ProUp, para jóvenes profesionales en Lima, Perú.',
    'SOBRE LA APP: ProUp analiza la imagen profesional del usuario directamente en su teléfono (la foto nunca sale del dispositivo, por privacidad). El análisis puntúa de 0 a 100 cuatro categorías: rostro/expresión, vestimenta (con nivel de formalidad), postura y entorno/iluminación; con ellas calcula un puntaje global (0-49 = "Por mejorar", 50-74 = "Aceptable", 75-100 = "Profesional") y genera recomendaciones personalizadas. La app también incluye un simulador de entrevistas con IA (comportamental, técnica, presencia ejecutiva y elevator pitch) y un panel de progreso.',
    `USUARIO: ${ctx.firstName ?? 'joven profesional'}, ${ctx.prof}${ctx.level ? `, nivel ${ctx.level}` : ''}.`,
  ];

  if (ctx.analysis) {
    lines.push(
      `ÚLTIMO ANÁLISIS DE IMAGEN del usuario: ${describeAnalysis(ctx.analysis)}.` +
        (ctx.analysis.topAdvice ? ` Recomendación principal pendiente: "${ctx.analysis.topAdvice}".` : ''),
    );
  } else {
    lines.push(
      'El usuario AÚN NO ha realizado ningún análisis de imagen. Si pregunta por sus resultados, explícale cómo funciona e invítalo a escanear su imagen desde la pestaña "Escanear".',
    );
  }

  if (ctx.interview) {
    lines.push(
      `ÚLTIMA ENTREVISTA SIMULADA: ${ctx.interview.track ?? 'simulación'} — puntaje ${ctx.interview.overall}/100.` +
        (ctx.interview.improvements.length
          ? ` Puntos a mejorar detectados: ${ctx.interview.improvements.slice(0, 3).join('; ')}.`
          : ''),
    );
  }

  lines.push(
    'Responde en español, breve (máximo 4-5 frases), práctico, cálido y motivador. Cuando el usuario pregunte por sus resultados, usa SUS datos reales (los de arriba) y prioriza la categoría más baja. Temas: entrevistas, imagen profesional, vestimenta, comunicación, CV y mercado laboral peruano. Si preguntan algo fuera de tu ámbito, redirige amablemente.',
  );
  return lines.join('\n');
}

/** Fallback inteligente por palabras clave (cuando el LLM no está disponible). */
function smartFallback(message: string, ctx: AdvisorContext): string {
  const m = message.toLowerCase();
  const has = (...k: string[]) => k.some((x) => m.includes(x));
  const prof = ctx.prof;

  if (has('análisis', 'analisis', 'resultado', 'puntaje', 'score', 'como sali', 'cómo salí')) {
    if (!ctx.analysis) {
      return 'Aún no tienes un análisis de imagen registrado. Ve a la pestaña "Escanear", toma una selfie o foto de cuerpo entero y te daré recomendaciones basadas en tus resultados.';
    }
    const a = ctx.analysis;
    const cats: [string, number][] = [
      ['rostro y expresión', a.face],
      ['vestimenta', a.clothing],
      ['postura', a.posture],
      ['entorno e iluminación', a.context],
    ];
    cats.sort((x, y) => x[1] - y[1]);
    return `En tu último análisis obtuviste ${describeAnalysis(a)}. Tu punto más débil es ${cats[0][0]} (${cats[0][1]}/100): te sugiero enfocarte primero ahí. ${a.topAdvice ?? ''}`.trim();
  }
  if (has('vesti', 'ropa', 'visto', 'vestir', 'atuendo'))
    return `Para una entrevista como ${prof}, opta por business casual: prendas sobrias, bien planchadas y máximo 2-3 colores. En Lima, la pulcritud transmite más profesionalismo que la marca de la ropa.`;
  if (has('nervi', 'ansie', 'miedo', 'estres', 'estrés'))
    return 'Es normal sentir nervios. Respira profundo antes de entrar, prepara 2-3 logros concretos para contar y recuerda: la entrevista también es para ver si la empresa encaja contigo.';
  if (has('cv', 'curriculum', 'currículum', 'hoja de vida'))
    return `Tu CV debe caber en 1 página, con logros medibles (no solo funciones). Para ${prof}, resalta resultados con números y adáptalo a cada puesto al que postules. Si me pegas el texto de tu CV, te doy observaciones concretas.`;
  if (has('entrevist', 'pregunta'))
    return 'Usa el método STAR (Situación, Tarea, Acción, Resultado) para responder. Practica en el simulador de ProUp: la sección Comportamental es ideal para empezar, y la Técnica se adapta a tu carrera.';
  if (has('sueldo', 'salario', 'pago', 'remunera'))
    return 'Investiga el rango del mercado para tu rol en Lima antes de negociar. Cuando te pregunten, da un rango realista y resalta el valor que aportas, no solo tus necesidades.';
  if (has('postura', 'lenguaje corporal', 'contacto visual'))
    return 'Mantén la espalda recta, los hombros relajados y contacto visual natural. Una sonrisa al saludar genera una conexión de confianza inmediata con el reclutador.';
  if (has('linkedin', 'red', 'networking'))
    return 'Optimiza tu LinkedIn con una foto profesional, un titular claro de tu rol y logros concretos. Conecta con personas de tu rubro y comenta contenido relevante para ganar visibilidad.';

  return `Cuéntame un poco más y te ayudo. Puedo orientarte sobre entrevistas, imagen profesional, vestimenta, CV y empleabilidad para tu carrera como ${prof}. También puedo comentarte los resultados de tu análisis de imagen.`;
}

export async function createSession(userId: string, title?: string) {
  return prisma.chatSession.create({ data: { userId, title: title ?? 'Nueva conversación' } });
}

export async function listSessions(userId: string) {
  return prisma.chatSession.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

async function assertOwnership(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw AppError.notFound('Conversación no encontrada');
  return session;
}

export async function getMessages(userId: string, sessionId: string) {
  await assertOwnership(userId, sessionId);
  return prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
}

export async function sendMessage(userId: string, sessionId: string, content: string) {
  await assertOwnership(userId, sessionId);

  const ctx = await buildAdvisorContext(userId);

  await prisma.chatMessage.create({ data: { sessionId, role: 'USER', content } });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  history.reverse(); // cronológico

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt(ctx) },
    ...history.map((m) => ({
      role: m.role === 'ASSISTANT' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
  ];

  const reply =
    (await llmComplete(messages, { temperature: 0.7, maxTokens: 500 })) ?? smartFallback(content, ctx);

  return prisma.chatMessage.create({ data: { sessionId, role: 'ASSISTANT', content: reply } });
}
