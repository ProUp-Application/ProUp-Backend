import { z } from 'zod';

/**
 * Política de contraseña del registro (la app la muestra en tiempo real con las
 * mismas reglas): mínimo 8 caracteres, con mayúscula, minúscula y número.
 */
export const PASSWORD_RULES: { re: RegExp; message: string }[] = [
  { re: /.{8,}/, message: 'La contraseña debe tener al menos 8 caracteres' },
  { re: /[A-ZÁÉÍÓÚÑ]/, message: 'La contraseña debe incluir al menos una letra mayúscula' },
  { re: /[a-záéíóúñ]/, message: 'La contraseña debe incluir al menos una letra minúscula' },
  { re: /\d/, message: 'La contraseña debe incluir al menos un número' },
];

const passwordSchema = PASSWORD_RULES.reduce(
  (schema, rule) => schema.regex(rule.re, rule.message),
  z.string().max(72, 'La contraseña no puede superar los 72 caracteres'),
);

/** Versión del texto de consentimiento que la app muestra al registrarse. */
export const CONSENT_VERSION = '1.1';

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido, por ejemplo nombre@correo.com'),
  password: passwordSchema,
  firstName: z.string().trim().min(1, 'El nombre es obligatorio').max(60, 'El nombre es demasiado largo'),
  lastName: z.string().trim().min(1, 'El apellido es obligatorio').max(60, 'El apellido es demasiado largo'),
  profession: z.string().trim().max(80).optional(),
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
