/**
 * Reglas de cálculo de scores de imagen profesional.
 * Escala 0-100 (entero). Pesos heurísticos (NO validados empíricamente):
 * se documentan así y se ajustan por sector. Ver RECOMENDACIONES_ARQUITECTO_MVP.md (D4).
 *
 * Solo se puntúa lo que se ve en la foto: vestimenta y postura llegan como `null`
 * cuando el encuadre no las muestra (p. ej. un primer plano). En ese caso el puntaje
 * global se calcula con las categorías evaluadas y sus pesos se renormalizan, en vez
 * de rellenar lo que falta con un valor supuesto.
 */

export interface PartialScores {
  face: number;
  clothing: number | null;
  posture: number | null;
  context: number;
}

type Category = 'face' | 'clothing' | 'posture' | 'context';
type Weights = Record<Category, number>;

const SECTOR_WEIGHTS: Record<string, Weights> = {
  default: { face: 0.3, clothing: 0.3, posture: 0.25, context: 0.15 },
  finanzas: { face: 0.3, clothing: 0.35, posture: 0.2, context: 0.15 },
  banca: { face: 0.3, clothing: 0.35, posture: 0.2, context: 0.15 },
  tecnologia: { face: 0.3, clothing: 0.25, posture: 0.25, context: 0.2 },
  creativo: { face: 0.35, clothing: 0.25, posture: 0.25, context: 0.15 },
  educacion: { face: 0.3, clothing: 0.3, posture: 0.25, context: 0.15 },
  salud: { face: 0.3, clothing: 0.3, posture: 0.25, context: 0.15 },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function weightsForSector(sector?: string | null): Weights {
  if (!sector) return SECTOR_WEIGHTS.default;
  return SECTOR_WEIGHTS[sector.toLowerCase().trim()] ?? SECTOR_WEIGHTS.default;
}

/** Categorías con puntaje (las que se vieron en la foto). */
export function evaluatedCategories(scores: PartialScores): Category[] {
  return (['face', 'clothing', 'posture', 'context'] as Category[]).filter(
    (c) => typeof scores[c] === 'number',
  );
}

export function computeOverall(scores: PartialScores, sector?: string | null): number {
  const w = weightsForSector(sector);
  const cats = evaluatedCategories(scores);
  const totalWeight = cats.reduce((acc, c) => acc + w[c], 0);
  if (totalWeight === 0) return 0;
  const sum = cats.reduce((acc, c) => acc + clamp(scores[c] as number) * w[c], 0);
  return clamp(sum / totalWeight);
}

/**
 * Topes por problemas detectados on-device (rawMetrics). Los pesos por sector pueden
 * compensar un rostro bajo con un buen entorno; estos topes lo impiden:
 * - lentes de sol / ojos no visibles → nunca más que "Por mejorar" (≤ 45)
 * - gorra / sombrero                 → nunca "Profesional" (≤ 65)
 * - mano haciendo un gesto (selfie)   → nunca "Profesional" (≤ 74)
 */
export function applyIssueCaps(overall: number, rawMetrics?: Record<string, unknown> | null): number {
  let capped = overall;
  if (rawMetrics?.sunglasses === true) capped = Math.min(capped, 45);
  if (rawMetrics?.hat === true) capped = Math.min(capped, 65);
  if (rawMetrics?.handGesture === true) capped = Math.min(capped, 74);
  return capped;
}

export type Band = 'BAJA' | 'MEDIA' | 'ALTA';

export function band(score: number): Band {
  if (score < 50) return 'BAJA';
  if (score < 75) return 'MEDIA';
  return 'ALTA';
}

export function bandLabel(score: number): string {
  switch (band(score)) {
    case 'BAJA':
      return 'Por mejorar';
    case 'MEDIA':
      return 'Bien / Aceptable';
    case 'ALTA':
      return 'Profesional / Muy bien';
  }
}
