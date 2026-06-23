import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { ConsentInput, UpdateProfileInput } from './users.schemas';

export async function getProfile(userId: string) {
  return prisma.professionalProfile.findUnique({ where: { userId } });
}

/** Crea o actualiza el perfil profesional (1:1 con el usuario). */
export async function upsertProfile(userId: string, input: UpdateProfileInput) {
  return prisma.professionalProfile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: { ...input },
  });
}

/** Derecho ARCO de Acceso: exporta TODOS los datos del usuario. */
export async function exportData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      consents: true,
      devices: true,
      analysisRequests: { include: { result: { include: { recommendations: { include: { feedback: true } } } } } },
      interviews: true,
      chatSessions: { include: { messages: true } },
    },
  });
  if (!user) throw AppError.notFound('Usuario no encontrado');
  const { passwordHash, ...safe } = user;
  return safe;
}

/** Derecho ARCO de Cancelación: borra la cuenta y TODOS sus datos en cascada. */
export async function deleteAccount(userId: string) {
  await prisma.auditEvent.create({
    data: { userId: null, eventType: 'USER_DELETED', payload: { userId } },
  });
  await prisma.user.delete({ where: { id: userId } });
}

/** Derecho ARCO de Oposición/actualización de consentimiento. */
export async function setConsent(userId: string, input: ConsentInput) {
  return prisma.consent.create({
    data: { userId, type: input.type, granted: input.granted, version: '1.0' },
  });
}

export async function listConsents(userId: string) {
  return prisma.consent.findMany({ where: { userId }, orderBy: { grantedAt: 'desc' } });
}
