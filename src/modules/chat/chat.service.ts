import { prisma } from '../../lib/prisma';
import { llmComplete, LlmMessage } from '../../lib/llm';
import { AppError } from '../../utils/AppError';

const SYSTEM_PROMPT =
  'Eres ProUp, un asesor virtual de carrera, imagen profesional y habilidades blandas para jóvenes profesionales en Lima, Perú. Respondes en español de forma breve (máximo 4 frases), práctica, cálida y motivadora. Temas: entrevistas de trabajo, imagen profesional, vestimenta, comunicación, empleabilidad y mercado laboral peruano. Si te preguntan algo fuera de tu ámbito, redirige amablemente.';

const FALLBACK_REPLY =
  'Gracias por tu mensaje. Estoy aquí para ayudarte con tu preparación profesional: entrevistas, imagen, vestimenta y habilidades blandas. ¿Sobre cuál de estos temas te gustaría un consejo concreto? (El asistente con IA estará disponible en breve; mientras tanto, te puedo orientar con recomendaciones generales.)';

export async function createSession(userId: string, title?: string) {
  return prisma.chatSession.create({ data: { userId, title: title ?? 'Nueva conversación' } });
}

export async function listSessions(userId: string) {
  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

async function assertOwnership(userId: string, sessionId: string) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw AppError.notFound('Conversación no encontrada');
  return session;
}

export async function getMessages(userId: string, sessionId: string) {
  await assertOwnership(userId, sessionId);
  return prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function sendMessage(userId: string, sessionId: string, content: string) {
  await assertOwnership(userId, sessionId);

  // Guarda el mensaje del usuario
  await prisma.chatMessage.create({ data: { sessionId, role: 'USER', content } });

  // Construye el contexto con el historial reciente
  const history = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    take: 12,
  });

  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({
      role: m.role === 'ASSISTANT' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    })),
  ];

  const reply = (await llmComplete(messages, { temperature: 0.7, maxTokens: 400 })) ?? FALLBACK_REPLY;

  const assistantMessage = await prisma.chatMessage.create({
    data: { sessionId, role: 'ASSISTANT', content: reply },
  });

  return assistantMessage;
}
