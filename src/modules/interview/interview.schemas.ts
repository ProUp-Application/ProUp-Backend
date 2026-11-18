import { z } from 'zod';

export const startInterviewSchema = z.object({
  track: z.string().trim().min(2).max(80), // sector o carrera (ej. "Tecnología", "Finanzas")
});

export const submitInterviewSchema = z.object({
  responses: z
    .array(
      z.object({
        question: z.string().min(1),
        // Hasta ~3 minutos hablados transcritos
        answer: z.string().min(1).max(3500),
        // Tiempo que el usuario usó para responder esta pregunta
        durationSeconds: z.number().int().min(0).max(1800).optional(),
        // VOICE = grabada y transcrita (revisada por el usuario); TEXT = escrita
        mode: z.enum(['VOICE', 'TEXT']).optional(),
      }),
    )
    .min(1),
  // Solo cuando se midió con la cámara (práctica con video); no se autoevalúa
  nonVerbalScore: z.number().int().min(0).max(100).optional(),
  // Autopercepción del usuario: se guarda, pero no altera el puntaje del contenido
  confidenceScore: z.number().int().min(0).max(100).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export type StartInterviewInput = z.infer<typeof startInterviewSchema>;
export type SubmitInterviewInput = z.infer<typeof submitInterviewSchema>;
