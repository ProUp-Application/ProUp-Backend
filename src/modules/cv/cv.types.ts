/** CV estructurado que genera la IA, el usuario edita y luego se exporta a Word. */
export interface StructuredCv {
  fullName: string;
  headline?: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
  profile?: string;
  experience: {
    role: string;
    organization: string;
    period?: string;
    location?: string;
    achievements: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    period?: string;
  }[];
  skills: string[];
  certifications: { name: string; issuer?: string; year?: string }[];
  languages: string[];
  /** Otras secciones del CV original (proyectos, voluntariado…). */
  other: { title: string; items: string[] }[];
}

export type SectionKey =
  | 'contacto'
  | 'perfil'
  | 'experiencia'
  | 'formacion'
  | 'habilidades'
  | 'certificaciones'
  | 'idiomas';

export interface SectionReview {
  key: SectionKey;
  status: 'completa' | 'mejorable' | 'ausente';
  observations: string[];
  recommendation: string;
  example?: string;
}

export interface CvIssue {
  type: 'ortografia' | 'redaccion' | 'claridad' | 'organizacion' | 'informacion_incompleta';
  text: string;
  suggestion: string;
}

export interface AtsCheck {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'info';
  detail: string;
  /** Por qué importa para la lectura automatizada (ATS-06). */
  why: string;
}

export interface IntegrityReport {
  /** Datos que la IA agregó y no aparecen en el CV original: se descartan. */
  removed: { field: string; value: string; reason: string }[];
  /** Información del original que no aparece en la versión mejorada. */
  possiblyMissing: { value: string; reason: string }[];
}
