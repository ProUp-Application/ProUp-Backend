import { z } from 'zod';

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comments: z.string().max(500).optional(),
});

export const appliedSchema = z.object({
  applied: z.boolean(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
