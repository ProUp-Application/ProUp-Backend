/**
 * Reglas de cálculo de scores de imagen profesional.
 * Escala 0-100 (entero). Pesos heurísticos (NO validados empíricamente):
 * se documentan así y se ajustan por sector. Ver RECOMENDACIONES_ARQUITECTO_MVP.md (D4).
 */

export interface PartialScores {
  face: number;
  clothing: number;
  posture: number;
  context: number;
}

type Weights = { face: number; clothing: number; posture: number; context: number };

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

export function computeOverall(scores: PartialScores, sector?: string | null): number {
  const w = weightsForSector(sector);
  const s = {
    face: clamp(scores.face),
    clothing: clamp(scores.clothing),
    posture: clamp(scores.posture),
    context: clamp(scores.context),
  };
  return clamp(s.face * w.face + s.clothing * w.clothing + s.posture * w.posture + s.context * w.context);
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
