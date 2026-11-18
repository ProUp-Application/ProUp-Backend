import { prisma } from '../../lib/prisma';
import { extractJsonObject, llmJsonText, toPlainText } from '../../lib/llm';
import { AppError } from '../../utils/AppError';
import { findProfession, professionLabel } from '../../shared/professions';
import { ATS_DISCLAIMER, ATS_INFO, runAtsChecks, sectionsFound } from './cv.ats';
import { enforceIntegrity } from './cv.integrity';
import { CvIssue, SectionKey, SectionReview, StructuredCv } from './cv.types';

/**
 * Módulo "Mejorar mi CV". Nada de lo que se envía aquí se guarda: el texto del CV
 * se procesa para responder y se descarta (solo queda un evento de auditoría sin
 * contenido). Para analizarlo con IA, el texto se envía al proveedor de IA (Groq).
 */

const SECTION_KEYS: SectionKey[] = ['contacto', 'perfil', 'experiencia', 'formacion', 'habilidades', 'certificaciones', 'idiomas'];
const ISSUE_TYPES: CvIssue['type'][] = ['ortografia', 'redaccion', 'claridad', 'organizacion', 'informacion_incompleta'];

const NO_INVENT_RULE =
  'REGLA CRÍTICA: no inventes NADA. No agregues experiencias, empresas, cargos, estudios, instituciones, certificaciones, ' +
  'habilidades, idiomas, logros, cifras ni fechas que el usuario no haya escrito. Si falta información, déjalo vacío y ' +
  'sugiérele qué agregar en "suggestions". Tampoco afirmes grado académico (egresado, titulado, bachiller), seniority, cargos de liderazgo ni años de experiencia si no están escritos. ' +
  'Puedes reescribir con mejor redacción y verbos de acción lo que SÍ está.';

async function profileFor(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId } });
  const prof = findProfession(profile?.profession);
  return { label: professionLabel(profile?.profession), topics: prof?.topics ?? [] };
}

const extractJson = extractJsonObject;

/** Nombre en español de la sección (la IA a veces responde con las claves del JSON). */
const SECTION_LABELS: Record<string, string> = {
  fullname: 'Nombre',
  headline: 'Titular',
  contact: 'Contacto',
  profile: 'Perfil',
  experience: 'Experiencia',
  education: 'Formación',
  skills: 'Habilidades',
  certifications: 'Certificaciones',
  languages: 'Idiomas',
  other: 'Otras secciones',
};
function sectionLabel(section: string): string {
  return SECTION_LABELS[section.toLowerCase().replace(/[^a-z]/g, '')] ?? section;
}

const str = (v: unknown, max = 600) => (typeof v === 'string' ? toPlainText(v).slice(0, max).trim() : '');
const strArr = (v: unknown, max = 600) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter((x) => x.length > 0) : [];

// ---------------------------------------------------------------------------
//  1) Análisis estructurado por secciones + revisión ATS orientativa
// ---------------------------------------------------------------------------

export async function analyzeCv(
  userId: string,
  input: { text: string; hasTables?: boolean; hasImages?: boolean },
) {
  const prof = await profileFor(userId);
  const ats = runAtsChecks({
    text: input.text,
    professionTopics: prof.topics,
    hasTables: input.hasTables,
    hasImages: input.hasImages,
  });

  const raw = await llmJsonText(
    [
      {
        role: 'system',
        content:
          'Eres un reclutador peruano que revisa CV de jóvenes profesionales. Analiza el CV por secciones y señala errores concretos. ' +
          'Basa cada observación en lo que dice el CV; no supongas lo que no está. Responde SOLO con un objeto JSON, en español y sin Markdown: ' +
          '{"summary": string (2 frases), ' +
          `"sections": [{"key": uno de ${JSON.stringify(SECTION_KEYS)}, "status": "completa"|"mejorable"|"ausente", "observations": string[], "recommendation": string, "example": string}], ` +
          `"issues": [{"type": uno de ${JSON.stringify(ISSUE_TYPES)}, "text": string (fragmento exacto del CV), "suggestion": string}], ` +
          '"tips": string[] (3 sugerencias accionables para presentar mejor su perfil)}. ' +
          'Incluye las 7 secciones. En "example" da un ejemplo de cómo reescribir con SUS datos (sin inventar cifras: si falta una cifra, escribe [cifra]).',
      },
      { role: 'user', content: `Profesión del usuario: ${prof.label}.\n\nCV:\n${input.text}` },
    ],
    { temperature: 0.3, maxTokens: 1800 },
  );

  const parsed = extractJson(raw) as Record<string, unknown> | null;
  const found = sectionsFound(input.text);
  const sections: SectionReview[] = SECTION_KEYS.map((key) => {
    const fromLlm = Array.isArray(parsed?.sections)
      ? (parsed!.sections as Record<string, unknown>[]).find((s) => s?.key === key)
      : undefined;
    if (fromLlm) {
      const status = ['completa', 'mejorable', 'ausente'].includes(String(fromLlm.status))
        ? (fromLlm.status as SectionReview['status'])
        : 'mejorable';
      return {
        key,
        status,
        observations: strArr(fromLlm.observations, 300).slice(0, 4),
        recommendation: str(fromLlm.recommendation, 400),
        example: str(fromLlm.example, 400) || undefined,
      };
    }
    // Sin IA: estado de la sección según los títulos detectados
    const present = key === 'contacto' ? ats.find((c) => c.id === 'contacto')?.status === 'ok' : found.includes(key);
    return {
      key,
      status: present ? 'mejorable' : 'ausente',
      observations: [],
      recommendation: present
        ? 'Revisa que esta sección sea clara y concreta.'
        : 'No identificamos esta sección. Agrégala si tienes información real para ella.',
    };
  });

  const issues: CvIssue[] = Array.isArray(parsed?.issues)
    ? (parsed!.issues as Record<string, unknown>[])
        .map((i) => ({
          type: (ISSUE_TYPES.includes(i?.type as CvIssue['type']) ? i.type : 'redaccion') as CvIssue['type'],
          text: str(i?.text, 300),
          suggestion: str(i?.suggestion, 300),
        }))
        .filter((i) => i.suggestion)
        .slice(0, 10)
    : [];

  await prisma.auditEvent.create({ data: { userId, eventType: 'CV_ANALYZED' } });

  return {
    aiAvailable: parsed !== null,
    summary: str(parsed?.summary, 500) || null,
    sections,
    issues,
    tips: strArr(parsed?.tips, 300).slice(0, 4),
    ats: { info: ATS_INFO, disclaimer: ATS_DISCLAIMER, checks: ats },
  };
}

// ---------------------------------------------------------------------------
//  2) Versión mejorada (editable) con control de integridad
// ---------------------------------------------------------------------------

function toStructuredCv(v: Record<string, unknown> | null): StructuredCv | null {
  if (!v || typeof v !== 'object') return null;
  const contact = (v.contact ?? {}) as Record<string, unknown>;
  const arr = (x: unknown) => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);
  const opt = (x: unknown, max = 200) => str(x, max) || undefined;
  return {
    fullName: str(v.fullName, 120),
    headline: opt(v.headline, 160),
    contact: {
      email: opt(contact.email, 120),
      phone: opt(contact.phone, 40),
      location: opt(contact.location, 120),
      linkedin: opt(contact.linkedin),
      website: opt(contact.website),
    },
    profile: opt(v.profile, 1500),
    experience: arr(v.experience)
      .map((e) => ({
        role: str(e.role, 160),
        organization: str(e.organization, 160),
        period: opt(e.period, 80),
        location: opt(e.location, 120),
        achievements: strArr(e.achievements, 500).slice(0, 12),
      }))
      .filter((e) => e.role || e.organization),
    education: arr(v.education)
      .map((e) => ({ degree: str(e.degree, 200), institution: str(e.institution, 200), period: opt(e.period, 80) }))
      .filter((e) => e.degree || e.institution),
    skills: strArr(v.skills, 80).slice(0, 40),
    certifications: arr(v.certifications)
      .map((c) => ({ name: str(c.name, 200), issuer: opt(c.issuer, 160), year: opt(c.year, 10) }))
      .filter((c) => c.name),
    languages: strArr(v.languages, 80).slice(0, 10),
    other: arr(v.other)
      .map((o) => ({ title: str(o.title, 80), items: strArr(o.items, 400).slice(0, 15) }))
      .filter((o) => o.title && o.items.length),
  };
}

export async function improveCv(userId: string, input: { text: string; targetRole?: string }) {
  const prof = await profileFor(userId);
  const target = input.targetRole ? ` Puesto al que postula: ${input.targetRole}.` : '';

  const raw = await llmJsonText(
    [
      {
        role: 'system',
        content:
          'Eres un reclutador peruano que reescribe CV de jóvenes profesionales para que sean claros, concretos y fáciles de leer por un ATS. ' +
          NO_INVENT_RULE +
          ' Responde SOLO con un objeto JSON, en español y sin Markdown: ' +
          '{"cv": {"fullName": string, "headline": string, "contact": {"email": string, "phone": string, "location": string, "linkedin": string, "website": string}, ' +
          '"profile": string (3-4 líneas basadas solo en el CV), "experience": [{"role": string, "organization": string, "period": string, "location": string, "achievements": string[]}], ' +
          '"education": [{"degree": string, "institution": string, "period": string}], "skills": string[], "certifications": [{"name": string, "issuer": string, "year": string}], ' +
          '"languages": string[], "other": [{"title": string, "items": string[]}]}, ' +
          '"changes": [{"section": string, "description": string}] (qué cambiaste y por qué), ' +
          '"suggestions": string[] (información que el usuario podría agregar si la tiene, p. ej. una cifra de un logro)}. ' +
          'Conserva TODOS los puestos, estudios, certificaciones y datos del original.',
      },
      { role: 'user', content: `Profesión del usuario: ${prof.label}.${target}\n\nCV original:\n${input.text}` },
    ],
    { temperature: 0.2, maxTokens: 3000 },
  );

  const parsed = extractJson(raw) as Record<string, unknown> | null;
  const generated = toStructuredCv((parsed?.cv ?? null) as Record<string, unknown> | null);
  if (!generated) {
    throw new AppError(
      503,
      'CV_GENERATION_FAILED',
      'No pudimos generar la versión mejorada en este momento. Inténtalo de nuevo en unos segundos.',
    );
  }

  const { cv, report } = enforceIntegrity(input.text, generated);

  const changes = Array.isArray(parsed?.changes)
    ? (parsed!.changes as Record<string, unknown>[])
        .map((c) => ({ section: sectionLabel(str(c?.section, 80)), description: str(c?.description, 300) }))
        .filter((c) => c.description)
        .slice(0, 12)
    : [];

  await prisma.auditEvent.create({ data: { userId, eventType: 'CV_IMPROVED' } });

  return {
    cv,
    changes,
    suggestions: strArr(parsed?.suggestions, 300).slice(0, 6),
    integrity: report,
    notice:
      'Revisa y edita todo antes de descargar. Descartamos automáticamente los datos que no aparecían en tu CV original.',
  };
}

// ---------------------------------------------------------------------------
//  3) Comparación con una vacante (ampliación)
// ---------------------------------------------------------------------------

export async function matchVacancy(userId: string, input: { cvText: string; vacancyText: string }) {
  const raw = await llmJsonText(
    [
      {
        role: 'system',
        content:
          'Compara un CV con la descripción de una vacante. Responde SOLO con JSON en español y sin Markdown: ' +
          '{"matches": string[] (requisitos de la vacante que el CV SÍ evidencia, citando el dato del CV), ' +
          '"gaps": string[] (requisitos que el CV NO evidencia; redáctalos como "No se evidencia en tu CV: …", sin asumir que la persona no lo tiene), ' +
          '"suggestions": string[] (cómo destacar experiencia REAL relevante para esta vacante; nunca sugieras inventar)}. ' +
          'Máximo 6 elementos por lista.',
      },
      { role: 'user', content: `VACANTE:\n${input.vacancyText}\n\nCV:\n${input.cvText}` },
    ],
    { temperature: 0.2, maxTokens: 1200 },
  );
  const parsed = extractJson(raw) as Record<string, unknown> | null;
  if (!parsed) {
    throw new AppError(503, 'MATCH_FAILED', 'No pudimos comparar tu CV con la vacante ahora. Inténtalo de nuevo.');
  }
  await prisma.auditEvent.create({ data: { userId, eventType: 'CV_VACANCY_MATCHED' } });
  return {
    matches: strArr(parsed.matches, 300).slice(0, 6),
    gaps: strArr(parsed.gaps, 300).slice(0, 6),
    suggestions: strArr(parsed.suggestions, 300).slice(0, 6),
    notice: 'Es una comparación orientativa: si tienes un requisito que no aparece en tu CV, agrégalo con datos reales.',
  };
}
