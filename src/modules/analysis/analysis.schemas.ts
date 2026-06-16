import { z } from 'zod';

const score = z.number().int().min(0).max(100);

export const createAnalysisSchema = z.object({
  captureType: z.enum(['SELFIE', 'FULL_BODY']),
  // Scores calculados ON-DEVICE (la imagen nunca se envía)
  scores: z.object({
    face: score,
    clothing: score,
    posture: score,
    context: score,
  }),
  clothingFormality: z.enum(['CASUAL', 'SEMI_FORMAL', 'FORMAL']).optional(),
  emotionDetected: z.string().max(40).optional(),
  rawMetrics: z.record(z.any()).optional(),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
