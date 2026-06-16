import { AnalysisResult, Prisma, RecommendationCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { llmComplete } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { band } from '../analysis/scoring';
import { CATEGORY_SCORE_KEY, RECOMMENDATION_CATALOG } from './recommendation.catalog';

const PRIORITY_BY_BAND = { BAJA: 1, MEDIA: 2, ALTA: 3 } as const;

function scoreForCategory(result: AnalysisResult, category: RecommendationCategory): number {
  switch (CATEGORY_SCORE_KEY[category]) {
    case 'face':
      return result.faceScore;
    case 'clothing':
      return result.clothingScore;
    case 'posture':
      return result.postureScore;
    case 'context':
      return result.contextScore;
    case 'overall':
      return result.overallScore;
  }
}

/**
 * Genera recomendaciones para un resultado de análisis.
 * Base = catálogo estático; el consejo en lenguaje natural se enriquece con el
 * LLM gratuito si está disponible (con fallback al texto del catálogo).
 */
export async function generateForAnalysis(
  result: AnalysisResult,
  sector?: string | null,
): Promise<void> {
  const categories: RecommendationCategory[] = [
    'CLOTHING',
    'POSTURE',
    'EXPRESSION',
    'CONTEXT',
    'SOFT_SKILLS',
  ];

  const rows: Prisma.RecommendationCreateManyInput[] = [];

  for (const category of categories) {
    const score = scoreForCategory(result, category);
    const b = band(score);
    const baseAdvice = RECOMMENDATION_CATALOG[category][b];

    const advice = await enrichAdvice(category, score, sector, baseAdvice);

    rows.push({
      analysisResultId: result.id,
      category,
      description: baseAdvice,
      priority: PRIORITY_BY_BAND[b],
      naturalLanguageAdvice: advice,
    });
  }

  await prisma.recommendation.createMany({ data: rows });
}

async function enrichAdvice(
  category: RecommendationCategory,
  score: number,
  sector: string | null | undefined,
  fallback: string,
): Promise<string> {
  const sectorTxt = sector ? ` para el sector "${sector}"` : '';
  const llm = await llmComplete(
    [
      {
        role: 'system',
        content:
          'Eres un asesor de imagen profesional y empleabilidad para jóvenes en Lima, Perú. Das consejos breves (máximo 2 frases), concretos, motivadores y en español.',
      },
      {
        role: 'user',
        content: `El usuario obtuvo un puntaje de ${score}/100 en la categoría ${category}${sectorTxt}. Dale un consejo breve y accionable para mejorar su imagen profesional en una entrevista de trabajo.`,
      },
    ],
    { temperature: 0.7, maxTokens: 160 },
  );
  return llm ?? fallback;
}

export async function addFeedback(
  userId: string,
  recommendationId: string,
  rating: number,
  comments?: string,
) {
  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    include: { analysisResult: { include: { analysisRequest: true } } },
  });
  if (!rec) throw AppError.notFound('Recomendación no encontrada');
  if (rec.analysisResult.analysisRequest.userId !== userId) {
    throw AppError.forbidden('No puedes calificar esta recomendación');
  }

  return prisma.userFeedback.upsert({
    where: { recommendationId },
    create: { recommendationId, rating, comments },
    update: { rating, comments },
  });
}

export async function markApplied(userId: string, recommendationId: string, applied: boolean) {
  const rec = await prisma.recommendation.findUnique({
    where: { id: recommendationId },
    include: { analysisResult: { include: { analysisRequest: true } } },
  });
  if (!rec) throw AppError.notFound('Recomendación no encontrada');
  if (rec.analysisResult.analysisRequest.userId !== userId) {
    throw AppError.forbidden('No autorizado');
  }
  return prisma.recommendation.update({ where: { id: recommendationId }, data: { applied } });
}
