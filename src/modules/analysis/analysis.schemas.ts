import { z } from 'zod';

const score = z.number().int().min(0).max(100);
const category = z.enum(['face', 'clothing', 'posture', 'context']);

/**
 * Explicación del análisis calculada on-device: qué se evaluó (con la evidencia
 * visible que sustenta cada puntaje), qué no se pudo evaluar y por qué.
 */
const assessmentSchema = z.object({
  evaluated: z
    .array(
      z.object({
        category,
        evidence: z.array(z.string().max(200)).max(8),
      }),
    )
    .max(4),
  notEvaluated: z
    .array(
      z.object({
        category,
        reason: z.string().max(240),
      }),
    )
    .max(4),
  formalityEvidence: z.array(z.string().max(200)).max(8).optional(),
});

export const createAnalysisSchema = z.object({
  // Lo que eligió el usuario al capturar (la app detecta además el encuadre real)
  captureType: z.enum(['SELFIE', 'FULL_BODY']),
  // Scores calculados ON-DEVICE (la imagen nunca se envía).
  // clothing/posture = null cuando no se ven en la foto: no se asumen.
  scores: z.object({
    face: score,
    clothing: score.nullable(),
    posture: score.nullable(),
    context: score,
  }),
  frameType: z.enum(['PRIMER_PLANO', 'MEDIO_CUERPO', 'CUERPO_COMPLETO']).optional(),
  assessment: assessmentSchema.optional(),
  clothingFormality: z.enum(['CASUAL', 'SEMI_FORMAL', 'FORMAL']).optional(),
  emotionDetected: z.string().max(40).optional(),
  rawMetrics: z.record(z.any()).optional(),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
