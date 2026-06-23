import { z } from 'zod';

export const startInterviewSchema = z.object({
  track: z.string().trim().min(2).max(80), // sector o carrera (ej. "Tecnología", "Finanzas")
});

export const submitInterviewSchema = z.object({
  responses: z
    .array(
      z.object({
        question: z.string().min(1),
        answer: z.string().min(1).max(2000),
      }),
    )
    .min(1),
  nonVerbalScore: z.number().int().min(0).max(100).optional(),
  confidenceScore: z.number().int().min(0).max(100).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export type StartInterviewInput = z.infer<typeof startInterviewSchema>;
export type SubmitInterviewInput = z.infer<typeof submitInterviewSchema>;
