import { AnalysisResult, Prisma, RecommendationCategory } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { llmComplete, toPlainText } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { professionLabel } from '../../shared/professions';
import { band } from '../analysis/scoring';
import { CATEGORY_SCORE_KEY, RECOMMENDATION_CATALOG } from './recommendation.catalog';

interface RecoContext {
  sector?: string | null;
  profession?: string | null;
}

const PRIORITY_BY_BAND = { BAJA: 1, MEDIA: 2, ALTA: 3 } as const;

function scoreForCategory(result: AnalysisResult, category: RecommendationCategory): number | null {
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

const FRAME_LABELS: Record<string, string> = {
  PRIMER_PLANO: 'un primer plano (rostro y, como mucho, hombros)',
  MEDIO_CUERPO: 'una foto de medio cuerpo (de la cintura hacia arriba)',
  CUERPO_COMPLETO: 'una foto de cuerpo completo',
};

const ASSESSMENT_KEY: Partial<Record<RecommendationCategory, string>> = {
  EXPRESSION: 'face',
  CLOTHING: 'clothing',
  POSTURE: 'posture',
  CONTEXT: 'context',
};

/** Evidencia visible que sustenta el puntaje de una categoría (calculada on-device). */
function evidenceFor(result: AnalysisResult, category: RecommendationCategory): string[] {
  const key = ASSESSMENT_KEY[category];
  const assessment = (result.assessment ?? null) as {
    evaluated?: { category: string; evidence?: string[] }[];
    formalityEvidence?: string[];
  } | null;
  if (!key || !assessment?.evaluated) return [];
  const item = assessment.evaluated.find((e) => e.category === key);
  const ev = [...(item?.evidence ?? [])];
  if (category === 'CLOTHING') ev.push(...(assessment.formalityEvidence ?? []));
  return ev.slice(0, 5);
}

/**
 * Genera recomendaciones para un resultado de análisis.
 * Base = catálogo estático; el consejo en lenguaje natural se enriquece con el
 * LLM gratuito si está disponible (con fallback al texto del catálogo).
 */
export async function generateForAnalysis(
  result: AnalysisResult,
  ctx: RecoContext = {},
): Promise<void> {
  const categories: RecommendationCategory[] = [
    'CLOTHING',
    'POSTURE',
    'EXPRESSION',
    'CONTEXT',
    'SOFT_SKILLS',
  ];

  const rows: Prisma.RecommendationCreateManyInput[] = [];

  // Problemas detectados on-device: el consejo debe nombrarlos explícitamente
  const metrics = (result.rawMetrics ?? {}) as Record<string, unknown>;
  const detected = [
    metrics.sunglasses === true ? 'lleva lentes de sol (no se le ven los ojos)' : null,
    metrics.hat === true ? 'lleva gorra o sombrero' : null,
  ].filter((d): d is string => d !== null);

  for (const category of categories) {
    const score = scoreForCategory(result, category);
    // Solo se recomienda sobre lo que se vio en la foto: si la categoría no se
    // evaluó (p. ej. postura en un primer plano), la app explica por qué no se evaluó.
    if (score === null) continue;
    const b = band(score);
    const baseAdvice = RECOMMENDATION_CATALOG[category][b];

    const relevant = category === 'EXPRESSION' || category === 'CLOTHING' ? detected : [];
    const advice = await enrichAdvice(category, score, ctx, baseAdvice, relevant, {
      frame: result.frameType ? FRAME_LABELS[result.frameType] ?? null : null,
      evidence: evidenceFor(result, category),
    });

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

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  EXPRESSION: 'rostro y expresión',
  CLOTHING: 'vestimenta',
  POSTURE: 'postura',
  CONTEXT: 'entorno e iluminación',
  SOFT_SKILLS: 'imagen profesional en conjunto',
};

const BAND_GUIDANCE: Record<'BAJA' | 'MEDIA' | 'ALTA', string> = {
  BAJA: 'El puntaje es BAJO ("Por mejorar"): no lo felicites; explica qué corregir primero.',
  MEDIA: 'El puntaje es MEDIO ("Aceptable"): reconoce lo que está bien y da una mejora concreta.',
  ALTA: 'El puntaje es ALTO ("Profesional"): refuerza lo que hace bien; no inventes problemas.',
};

async function enrichAdvice(
  category: RecommendationCategory,
  score: number,
  ctx: RecoContext,
  fallback: string,
  detected: string[] = [],
  photo: { frame: string | null; evidence: string[] } = { frame: null, evidence: [] },
): Promise<string> {
  const prof = professionLabel(ctx.profession);
  const issues = detected.length
    ? ` En su foto se detectó que ${detected.join(' y ')}: menciónalo y dile que se lo quite para la entrevista.`
    : '';
  const frame = photo.frame
    ? ` La foto es ${photo.frame}: habla SOLO de lo que se ve en ella; no menciones prendas, calzado ni postura que no aparecen.`
    : '';
  const evidence = photo.evidence.length
    ? ` Lo observado en la foto que explica el puntaje: ${photo.evidence.join('; ')}.`
    : '';
  const llm = await llmComplete(
    [
      {
        role: 'system',
        content:
          'Eres un asesor de imagen profesional y empleabilidad para jóvenes en Lima, Perú. Das consejos breves (máximo 2 frases), concretos, motivadores y en español, en texto plano sin Markdown. Tu consejo debe ser coherente con el puntaje recibido y basarse solo en lo observado.',
      },
      {
        role: 'user',
        content: `El usuario es ${prof} y obtuvo ${score}/100 en ${CATEGORY_LABELS[category]}. ${BAND_GUIDANCE[band(score)]}${frame}${evidence} Dale un consejo breve y accionable, adaptado a su rubro, para mejorar su imagen profesional en una entrevista.${issues}`,
      },
    ],
    { temperature: 0.6, maxTokens: 160 },
  );
  return llm ? toPlainText(llm) : fallback;
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
