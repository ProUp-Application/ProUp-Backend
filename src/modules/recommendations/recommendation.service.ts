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
  MEDIO_CUERPO: 'una foto de medio cuerpo (torso y hombros, sin piernas)',
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
  if (!assessment?.evaluated) return [];
  // Imagen en conjunto: resumen de TODO lo observado, para que el consejo general
  // no contradiga una categoría (p. ej. "estilo pulido" con ropa casual)
  if (category === 'SOFT_SKILLS') {
    const names: Record<string, string> = { face: 'Rostro', clothing: 'Vestimenta', posture: 'Postura', context: 'Entorno' };
    return [
      ...assessment.evaluated.map((e) => `${names[e.category] ?? e.category}: ${(e.evidence ?? []).slice(0, 3).join(', ')}`),
      ...(assessment.formalityEvidence ?? []).slice(0, 1),
    ];
  }
  if (!key) return [];
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
  const detected: { text: string; categories: RecommendationCategory[] }[] = [
    metrics.sunglasses === true
      ? { text: 'lleva lentes de sol (no se le ven los ojos)', categories: ['EXPRESSION', 'CLOTHING'] }
      : null,
    metrics.hat === true ? { text: 'lleva gorra o sombrero', categories: ['EXPRESSION', 'CLOTHING'] } : null,
    metrics.handGesture === true
      ? { text: 'aparece haciendo un gesto con la mano junto al rostro', categories: ['EXPRESSION'] }
      : null,
  ].filter((d): d is { text: string; categories: RecommendationCategory[] } => d !== null);

  for (const category of categories) {
    const score = scoreForCategory(result, category);
    // Solo se recomienda sobre lo que se vio en la foto: si la categoría no se
    // evaluó (p. ej. postura en un primer plano), la app explica por qué no se evaluó.
    if (score === null) continue;
    const b = band(score);
    const baseAdvice = RECOMMENDATION_CATALOG[category][b];

    const relevant = detected.filter((d) => d.categories.includes(category)).map((d) => d.text);
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

function scopeRule(category: RecommendationCategory): string {
  return category === 'SOFT_SKILLS'
    ? 'Da una valoración de conjunto coherente con TODO lo observado (si la vestimenta es casual, no la llames pulida ni formal).'
    : `Habla SOLO de ${CATEGORY_LABELS[category]}; no aconsejes sobre otras categorías (sonrisa, postura, ropa o fondo) salvo que sean de esta.`;
}

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
    ? ` En su foto se detectó que ${detected.join(' y ')}: menciónalo y dile cómo corregirlo para la foto de su postulación.`
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
          'Eres un asesor de imagen profesional y empleabilidad para jóvenes en Lima, Perú. Das consejos breves (máximo 2 frases), concretos, motivadores y en español, en texto plano sin Markdown. Tu consejo debe ser coherente con el puntaje recibido y basarse solo en lo observado. No afirmes ni corrijas nada que lo observado no mencione (por ejemplo, no pidas cambiar el fondo, la ropa o una prenda si no se indicó un problema con ellos), y no pidas añadir algo que lo observado ya muestra (si dice "Sonrisa visible", no pidas sonreír). Si todo lo observado está bien, refuérzalo y da un detalle fino opcional.',
      },
      {
        role: 'user',
        content: `El usuario es ${prof} y obtuvo ${score}/100 en ${CATEGORY_LABELS[category]}. ${BAND_GUIDANCE[band(score)]}${frame}${evidence} ${scopeRule(category)} Dale un consejo breve y accionable, adaptado a su rubro, para mejorar su imagen profesional en una entrevista.${issues}`,
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
