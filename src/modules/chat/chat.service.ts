import { prisma } from '../../lib/prisma';
import { llmComplete, LlmMessage } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { professionLabel } from '../../shared/professions';

function systemPrompt(prof: string): string {
  return (
    `Eres ProUp, un asesor virtual de carrera, imagen profesional y habilidades blandas para jóvenes profesionales en Lima, Perú. ` +
    `El usuario es ${prof}. Adapta tus consejos a su rubro. ` +
    `Respondes en español, breve (máximo 4 frases), práctico, cálido y motivador. ` +
    `Temas: entrevistas, imagen profesional, vestimenta, comunicación, CV, empleabilidad y mercado laboral peruano. ` +
    `Si te preguntan algo fuera de tu ámbito, redirige amablemente.`
  );
}

/** Fallback por palabras clave (cuando no hay LLM). Responde útilmente según el tema. */
function smartFallback(message: string, prof: string): string {
  const m = message.toLowerCase();
  const has = (...k: string[]) => k.some((x) => m.includes(x));

  if (has('vesti', 'ropa', 'visto', 'vestir', 'atuendo'))
    return `Para una entrevista como ${prof}, opta por business casual: prendas sobrias, bien planchadas y máximo 2-3 colores. En Lima, la pulcritud transmite más profesionalismo que la marca de la ropa.`;
  if (has('nervi', 'ansie', 'miedo', 'estres', 'estrés'))
    return 'Es normal sentir nervios. Respira profundo antes de entrar, prepara 2-3 logros concretos para contar y recuerda: la entrevista también es para ver si la empresa encaja contigo.';
  if (has('cv', 'curriculum', 'currículum', 'hoja de vida'))
    return `Tu CV debe caber en 1 página, con logros medibles (no solo funciones). Para ${prof}, resalta resultados con números y adáptalo a cada puesto al que postules.`;
  if (has('entrevist', 'pregunta'))
    return 'Usa el método STAR (Situación, Tarea, Acción, Resultado) para responder. Practica en el simulador de ProUp y graba tus respuestas para revisar tu comunicación no verbal.';
  if (has('sueldo', 'salario', 'pago', 'remunera'))
    return 'Investiga el rango del mercado para tu rol en Lima antes de negociar. Cuando te pregunten, da un rango realista y resalta el valor que aportas, no solo tus necesidades.';
  if (has('postura', 'lenguaje corporal', 'contacto visual'))
    return 'Mantén la espalda recta, los hombros relajados y contacto visual natural. Una sonrisa al saludar genera una conexión de confianza inmediata con el reclutador.';
  if (has('linkedin', 'red', 'networking'))
    return 'Optimiza tu LinkedIn con una foto profesional, un titular claro de tu rol y logros concretos. Conecta con personas de tu rubro y comenta contenido relevante para ganar visibilidad.';

  return `Cuéntame un poco más y te ayudo. Puedo orientarte sobre entrevistas, imagen profesional, vestimenta, CV y empleabilidad para tu carrera como ${prof}.`;
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

  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const prof = professionLabel(profile?.profession);

  await prisma.chatMessage.create({ data: { sessionId, role: 'USER', content } });

  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 12,
  });

  const messages: LlmMessage[] = [
    { role: 'system', content: systemPrompt(prof) },
    ...history.map((m) => ({
      role: m.role === 'ASSISTANT' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
  ];

  const reply = (await llmComplete(messages, { temperature: 0.7, maxTokens: 400 })) ?? smartFallback(content, prof);

  return prisma.chatMessage.create({ data: { sessionId, role: 'ASSISTANT', content: reply } });
}
