import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Correo inválido').toLowerCase().trim(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(1, 'El nombre es obligatorio').trim(),
  lastName: z.string().min(1, 'El apellido es obligatorio').trim(),
  // Consentimiento informado (Ley 29733): obligatorio para registrarse
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar el tratamiento de datos personales' }),
  }),
});

export const loginSchema = z.object({
  email: z.string().email('Correo inválido').toLowerCase().trim(),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken es obligatorio'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
