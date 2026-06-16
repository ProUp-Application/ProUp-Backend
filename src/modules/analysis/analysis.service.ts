import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/AppError';
import { generateForAnalysis } from '../recommendations/recommendation.service';
import { CreateAnalysisInput } from './analysis.schemas';
import { computeOverall } from './scoring';

/**
 * Registra un análisis a partir de los scores calculados ON-DEVICE.
 * El backend NO recibe imágenes: solo los puntajes y metadatos derivados.
 */
export async function createAnalysis(userId: string, input: CreateAnalysisInput) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const sector = profile?.targetSector ?? null;
  const overall = computeOverall(input.scores, sector);

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
          clothingFormality: input.clothingFormality,
          emotionDetected: input.emotionDetected,
          rawMetrics: input.rawMetrics,
        },
      },
    },
    include: { result: true },
  });

  if (request.result) {
    await generateForAnalysis(request.result, sector);
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
