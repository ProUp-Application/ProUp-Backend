import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must have at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  fullName: z.string().min(2).max(120).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: passwordSchema
});

export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1)
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
