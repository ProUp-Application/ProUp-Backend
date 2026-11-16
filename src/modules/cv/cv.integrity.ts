import { IntegrityReport, StructuredCv } from './cv.types';
import { appearsIn, contactFrom, normalize, numbersIn, yearsIn } from './cv.text';

/**
 * Control de integridad del CV generado por la IA (ASE-07 y ASE-08), determinista:
 * 1. Descarta organizaciones, instituciones, certificaciones y habilidades que no
 *    aparecen en el CV original, y logros con cifras que el usuario nunca escribió.
 * 2. Los datos de contacto se toman SIEMPRE del CV original, nunca de la IA.
 * 3. Avisa si información del original (años, correo, teléfono) no quedó en la versión
 *    mejorada, para que el usuario no la pierda sin darse cuenta.
 */
export function enforceIntegrity(original: string, cv: StructuredCv): { cv: StructuredCv; report: IntegrityReport } {
  const removed: IntegrityReport['removed'] = [];
  const originalNumbers = new Set(numbersIn(original).map((x) => x.replace('%', '')));

  const canon = (x: string) => x.replace('%', '').replace(/^0+(?=\d)/, '');
  const originalCanon = new Set([...originalNumbers].map(canon));
  const numbersOk = (text: string) => numbersIn(text).every((x) => originalCanon.has(canon(x)));
  // En los periodos solo se exige que los AÑOS existan en el original
  const originalYears = new Set(yearsIn(original));
  const periodOk = (p: string) => yearsIn(p).every((y) => originalYears.has(y));

  // Contacto: solo lo que está en el original
  const contact = contactFrom(original);
  const normOriginal = normalize(original);
  const location = cv.contact.location && appearsIn(original, cv.contact.location) ? cv.contact.location : undefined;
  const website =
    cv.contact.website && normOriginal.includes(normalize(cv.contact.website).replace(/^https?\s*/, ''))
      ? cv.contact.website
      : undefined;
  for (const [field, value] of Object.entries(cv.contact)) {
    if (!value) continue;
    const kept = { email: contact.email, phone: contact.phone, linkedin: contact.linkedin, location, website }[
      field as keyof StructuredCv['contact']
    ];
    const same = (a: string, b: string) =>
      field === 'phone' ? a.replace(/\D/g, '').endsWith(b.replace(/\D/g, '').slice(-9)) : normalize(a) === normalize(b);
    if (!kept) {
      removed.push({ field: `contacto.${field}`, value, reason: 'No aparece en tu CV original.' });
    } else if (!same(kept, value)) {
      removed.push({
        field: `contacto.${field}`,
        value,
        reason: `No coincide con tu CV original; se conserva "${kept}".`,
      });
    }
  }

  const experience = cv.experience
    .filter((e) => {
      const ok = appearsIn(original, e.organization) && appearsIn(original, e.role, 0.5);
      if (!ok) {
        removed.push({
          field: 'experiencia',
          value: `${e.role} — ${e.organization}`,
          reason: 'Este puesto u organización no aparece en tu CV original.',
        });
      }
      return ok;
    })
    .map((e) => ({
      ...e,
      period: e.period && periodOk(e.period) ? e.period : undefined,
      achievements: e.achievements.filter((a) => {
        const ok = numbersOk(a);
        if (!ok) {
          removed.push({ field: 'experiencia.logro', value: a, reason: 'Incluye una cifra que no está en tu CV original.' });
        }
        return ok;
      }),
    }));

  const education = cv.education
    .filter((e) => {
      const ok = appearsIn(original, e.institution) && appearsIn(original, e.degree, 0.5);
      if (!ok) {
        removed.push({
          field: 'formacion',
          value: `${e.degree} — ${e.institution}`,
          reason: 'Este estudio o institución no aparece en tu CV original.',
        });
      }
      return ok;
    })
    .map((e) => ({ ...e, period: e.period && periodOk(e.period) ? e.period : undefined }));

  const certifications = cv.certifications.filter((c) => {
    const ok = appearsIn(original, c.name, 0.5);
    if (!ok) removed.push({ field: 'certificaciones', value: c.name, reason: 'Esta certificación no aparece en tu CV original.' });
    return ok;
  });

  const skills = cv.skills.filter((s) => {
    const ok = appearsIn(original, s, 0.5);
    if (!ok) removed.push({ field: 'habilidades', value: s, reason: 'Esta habilidad no aparece en tu CV original.' });
    return ok;
  });

  const languages = cv.languages.filter((l) => {
    const ok = appearsIn(original, l, 0.5);
    if (!ok) removed.push({ field: 'idiomas', value: l, reason: 'Este idioma no aparece en tu CV original.' });
    return ok;
  });

  let profile = cv.profile;
  if (profile && !numbersOk(profile)) {
    removed.push({ field: 'perfil', value: profile, reason: 'El perfil incluía una cifra que no está en tu CV original.' });
    profile = undefined;
  }
  // Afirmaciones de grado, seniority o experiencia que el usuario no escribió
  // (p. ej. "recién graduada" cuando el CV solo dice la carrera y los años)
  if (profile) {
    const kept: string[] = [];
    for (const sentence of profile.split(/(?<=[.!?])\s+/)) {
      const claim = unverifiedClaim(original, sentence);
      if (claim) {
        removed.push({ field: 'perfil', value: sentence, reason: `Afirma "${claim}", que no aparece en tu CV original.` });
      } else {
        kept.push(sentence);
      }
    }
    profile = kept.join(' ').trim() || undefined;
  }
  let headline = cv.headline;
  if (headline) {
    const claim = unverifiedClaim(original, headline);
    if (claim) {
      removed.push({ field: 'titular', value: headline, reason: `Afirma "${claim}", que no aparece en tu CV original.` });
      headline = undefined;
    }
  }

  const other = cv.other
    .map((o) => ({
      title: o.title,
      items: o.items.filter((i) => {
        const ok = numbersOk(i) && appearsIn(original, i, 0.4);
        if (!ok) removed.push({ field: o.title, value: i, reason: 'No aparece en tu CV original.' });
        return ok;
      }),
    }))
    .filter((o) => o.items.length > 0);

  const result: StructuredCv = {
    fullName: cv.fullName,
    headline,
    contact: {
      email: contact.email,
      phone: contact.phone,
      linkedin: contact.linkedin,
      location,
      website,
    },
    profile,
    experience,
    education,
    skills,
    certifications,
    languages,
    other,
  };

  return { cv: result, report: { removed, possiblyMissing: missingFromImproved(original, result) } };
}

/**
 * Afirmaciones que cambian el perfil profesional del usuario y que la IA tiende a
 * suponer: grado académico, colegiatura, seniority o años de experiencia. Se aceptan
 * solo si una palabra de la misma familia aparece en el CV original.
 */
const CLAIMS: { label: string; re: RegExp }[] = [
  { label: 'graduado/a', re: /\b(recien\s+)?(graduad[oa]s?|egresad[oa]s?)\b/ },
  { label: 'titulado/a', re: /\btitulad[oa]s?\b/ },
  { label: 'bachiller', re: /\bbachiller\b/ },
  { label: 'colegiado/a', re: /\bcolegiad[oa]s?\b/ },
  { label: 'magíster', re: /\b(magister|maestria|mba)\b/ },
  { label: 'senior', re: /\b(senior|semi\s*senior)\b/ },
  { label: 'líder de equipo', re: /\b(lider|jefe|jefa|gerente|coordinador[a]?)\b/ },
  { label: 'años de experiencia', re: /\banos?\s+de\s+experiencia\b/ },
];

export function unverifiedClaim(original: string, text: string): string | null {
  const n = normalize(text);
  const o = normalize(original);
  for (const c of CLAIMS) {
    const m = n.match(c.re);
    if (m && !c.re.test(o)) return m[0];
  }
  return null;
}

/** Datos del original que no quedaron en la versión mejorada (ASE-07). */
export function missingFromImproved(original: string, cv: StructuredCv): IntegrityReport['possiblyMissing'] {
  const improvedText = normalize(cvToPlainText(cv));
  const missing: IntegrityReport['possiblyMissing'] = [];
  for (const y of yearsIn(original)) {
    if (!improvedText.includes(y)) {
      missing.push({ value: y, reason: `El año ${y} aparece en tu CV original y no en la versión mejorada. Revisa que no falte un puesto o estudio.` });
    }
  }
  const contact = contactFrom(original);
  if (contact.email && !cv.contact.email) missing.push({ value: contact.email, reason: 'Falta tu correo.' });
  if (contact.phone && !cv.contact.phone) missing.push({ value: contact.phone, reason: 'Falta tu teléfono.' });
  return missing;
}

export function cvToPlainText(cv: StructuredCv): string {
  return [
    cv.fullName,
    cv.headline,
    ...Object.values(cv.contact),
    cv.profile,
    ...cv.experience.flatMap((e) => [e.role, e.organization, e.period, e.location, ...e.achievements]),
    ...cv.education.flatMap((e) => [e.degree, e.institution, e.period]),
    ...cv.skills,
    ...cv.certifications.flatMap((c) => [c.name, c.issuer, c.year]),
    ...cv.languages,
    ...cv.other.flatMap((o) => [o.title, ...o.items]),
  ]
    .filter(Boolean)
    .join('\n');
}
