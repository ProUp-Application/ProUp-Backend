import { z } from 'zod';

export const updateProfileSchema = z.object({
  targetSector: z.string().trim().max(80).optional(),
  experienceLevel: z.enum(['STUDENT', 'JUNIOR', 'SEMI_SENIOR', 'SENIOR']).optional(),
  careerGoals: z.string().trim().max(1000).optional(),
  preferredJobType: z.string().trim().max(80).optional(),
  location: z.string().trim().max(120).optional(),
});

export const consentSchema = z.object({
  type: z.enum(['DATA_PROCESSING', 'BIOMETRIC_ONDEVICE', 'MARKETING']),
  granted: z.boolean(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
