import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().trim().max(120).optional(),
});

export const sendMessageSchema = z.object({
  // 6000 para permitir pegar el texto de un CV para revisión
  content: z.string().trim().min(1).max(6000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
