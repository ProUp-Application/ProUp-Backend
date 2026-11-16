import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { findProfession } from '../../shared/professions';
import { generateForAnalysis } from '../recommendations/recommendation.service';
import { CreateAnalysisInput } from './analysis.schemas';
import { applyIssueCaps, computeOverall } from './scoring';

/** Mínimo de usuarios para publicar el promedio de la comunidad (evita identificar a alguien). */
export const MIN_USERS_FOR_COMMUNITY_AVERAGE = 5;

/**
 * Registra un análisis a partir de los scores calculados ON-DEVICE.
 * El backend NO recibe imágenes: solo los puntajes y metadatos derivados.
 */
export async function createAnalysis(userId: string, input: CreateAnalysisInput) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const sector = findProfession(profile?.profession)?.sector ?? profile?.targetSector ?? null;
  const overall = applyIssueCaps(computeOverall(input.scores, sector), input.rawMetrics);

  const request = await prisma.analysisRequest.create({
    data: {
      userId,
      captureType: input.captureType,
      status: 'COMPLETED',
      result: {
        create: {
          faceScore: input.scores.face,
          clothingScore: input.scores.clothing,
          postureScore: input.scores.posture,
          contextScore: input.scores.context,
          overallScore: overall,
          // Sin evidencia de prendas no se asigna formalidad
          clothingFormality: input.scores.clothing === null ? null : input.clothingFormality,
          emotionDetected: input.emotionDetected,
          frameType: input.frameType,
          assessment: input.assessment as Prisma.InputJsonValue | undefined,
          rawMetrics: input.rawMetrics,
        },
      },
    },
    include: { result: true },
  });

  if (request.result) {
    await generateForAnalysis(request.result, { sector, profession: profile?.profession });
    await prisma.auditEvent.create({
      data: { userId, eventType: 'ANALYSIS_CREATED', requestId: request.id },
    });
  }

  return getAnalysis(userId, request.id);
}

export async function listAnalyses(userId: string) {
  return prisma.analysisRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { result: true },
  });
}

export async function getAnalysis(userId: string, id: string) {
  const request = await prisma.analysisRequest.findUnique({
    where: { id },
    include: {
      result: {
        include: {
          recommendations: { orderBy: { priority: 'asc' }, include: { feedback: true } },
        },
      },
    },
  });
  if (!request || request.userId !== userId) {
    throw AppError.notFound('Análisis no encontrado');
  }
  return request;
}

/**
 * Indicadores para el panel de progreso, separados sin ambigüedad:
 * - `personal`: resultados SOLO del usuario (último, promedio, mejor y cantidad);
 * - `community`: promedio del ÚLTIMO análisis de cada usuario de ProUp. Es referencial
 *   y solo se publica con al menos MIN_USERS_FOR_COMMUNITY_AVERAGE usuarios.
 */
export async function getStats(userId: string) {
  const own = await prisma.analysisResult.findMany({
    where: { analysisRequest: { userId } },
    orderBy: { createdAt: 'desc' },
    select: { overallScore: true },
  });

  const rows = await prisma.$queryRaw<{ users: bigint; average: number | null }[]>`
    SELECT COUNT(*)::bigint AS users, AVG(t.overall_score)::float AS average
    FROM (
      SELECT DISTINCT ON (ar.user_id) res.overall_score
      FROM analysis_requests ar
      JOIN analysis_results res ON res.analysis_request_id = ar.id
      ORDER BY ar.user_id, ar.created_at DESC
    ) t`;
  const users = Number(rows[0]?.users ?? 0);
  const published = users >= MIN_USERS_FOR_COMMUNITY_AVERAGE;

  const scores = own.map((r) => r.overallScore);
  return {
    personal: {
      analyses: scores.length,
      latest: scores[0] ?? null,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      best: scores.length ? Math.max(...scores) : null,
    },
    community: {
      users,
      average: published && rows[0]?.average != null ? Math.round(rows[0].average) : null,
      minUsers: MIN_USERS_FOR_COMMUNITY_AVERAGE,
      description:
        'Promedio del último análisis de cada usuario de ProUp. Es referencial: no incluye solo tus resultados.',
    },
  };
}
