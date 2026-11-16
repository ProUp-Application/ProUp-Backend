import { z } from 'zod';

const cvText = z
  .string()
  .trim()
  .min(80, 'El CV es muy corto para analizarlo: pega el texto completo o adjunta el archivo.')
  .max(9000, 'El CV es demasiado largo (máximo 9000 caracteres).');

export const analyzeCvSchema = z.object({
  text: cvText,
  hasTables: z.boolean().optional(),
  hasImages: z.boolean().optional(),
});

export const improveCvSchema = z.object({
  text: cvText,
  targetRole: z.string().trim().max(120).optional(),
});

const s = (max: number) => z.string().trim().max(max);

export const structuredCvSchema = z.object({
  fullName: s(120),
  headline: s(160).optional(),
  contact: z.object({
    email: s(120).optional(),
    phone: s(40).optional(),
    location: s(120).optional(),
    linkedin: s(200).optional(),
    website: s(200).optional(),
  }),
  profile: s(1500).optional(),
  experience: z
    .array(
      z.object({
        role: s(160),
        organization: s(160),
        period: s(80).optional(),
        location: s(120).optional(),
        achievements: z.array(s(500)).max(12),
      }),
    )
    .max(15),
  education: z
    .array(z.object({ degree: s(200), institution: s(200), period: s(80).optional() }))
    .max(10),
  skills: z.array(s(80)).max(40),
  certifications: z
    .array(z.object({ name: s(200), issuer: s(160).optional(), year: s(10).optional() }))
    .max(20),
  languages: z.array(s(80)).max(10),
  other: z.array(z.object({ title: s(80), items: z.array(s(400)).max(15) })).max(6),
});

export const exportCvSchema = z.object({ cv: structuredCvSchema });

export const matchVacancySchema = z.object({
  cvText,
  vacancyText: z
    .string()
    .trim()
    .min(50, 'Pega la descripción completa de la vacante (requisitos y funciones).')
    .max(6000),
});
