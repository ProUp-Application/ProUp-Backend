import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAtsChecks, sectionsFound } from '../src/modules/cv/cv.ats';
import { enforceIntegrity } from '../src/modules/cv/cv.integrity';
import { StructuredCv } from '../src/modules/cv/cv.types';
import { SAMPLE_CV } from './fixtures';

const base: StructuredCv = {
  fullName: 'Lucía Torres Quispe',
  headline: 'Bachiller en Ingeniería de Software',
  contact: { email: 'lucia.torres.demo@correo.com', phone: '987 654 321', location: 'Lima, Perú' },
  profile: 'Egresada de Ingeniería de Software con interés en desarrollo backend.',
  experience: [
    {
      role: 'Practicante de Desarrollo',
      organization: 'Fintech Andina SAC',
      period: '03/2024 – 12/2024',
      achievements: ['Automaticé pruebas de integración y reduje en 30% el tiempo de despliegue.'],
    },
  ],
  education: [
    {
      degree: 'Ingeniería de Software',
      institution: 'Universidad Peruana de Ciencias Aplicadas (UPC)',
      period: '2019 – 2024',
    },
  ],
  skills: ['Node.js', 'TypeScript', 'PostgreSQL'],
  certifications: [{ name: 'Scrum Fundamentals Certified', year: '2023' }],
  languages: ['Inglés intermedio'],
  other: [],
};

test('detecta las secciones convencionales del CV', () => {
  assert.deepEqual(sectionsFound(SAMPLE_CV).sort(), [
    'certificaciones',
    'experiencia',
    'formacion',
    'habilidades',
    'idiomas',
    'perfil',
  ]);
});

test('la revisión ATS es orientativa y explica cada criterio', () => {
  const checks = runAtsChecks({ text: SAMPLE_CV, professionTopics: ['bases de datos', 'diseño de APIs'] });
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId.contacto.status, 'ok');
  assert.equal(byId.secciones.status, 'ok');
  assert.equal(byId.fechas.status, 'ok');
  assert.ok(checks.every((c) => c.why.length > 20), 'cada criterio explica por qué importa');
});

test('un CV sin secciones ni contacto recibe advertencias', () => {
  const checks = runAtsChecks({
    text: 'Soy una persona responsable y proactiva que busca su primer empleo en Lima.',
    hasTables: true,
  });
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId.contacto.status, 'warning');
  assert.equal(byId.secciones.status, 'warning');
  assert.equal(byId.formato.status, 'warning');
});

test('un CV fiel al original no pierde nada', () => {
  const { cv, report } = enforceIntegrity(SAMPLE_CV, base);
  assert.deepEqual(report.removed, []);
  assert.equal(cv.experience.length, 1);
  assert.equal(cv.experience[0].achievements.length, 1);
  assert.equal(cv.experience[0].period, '03/2024 – 12/2024');
});

test('descarta experiencias, certificaciones, habilidades y cifras inventadas por la IA', () => {
  const invented: StructuredCv = {
    ...base,
    experience: [
      {
        ...base.experience[0],
        achievements: [
          ...base.experience[0].achievements,
          'Lideré un equipo de 12 personas y aumenté las ventas en 45%.',
        ],
      },
      { role: 'Analista Senior', organization: 'Banco Ficticio del Sur', period: '2025', achievements: [] },
    ],
    certifications: [...base.certifications, { name: 'AWS Solutions Architect Professional' }],
    skills: [...base.skills, 'Kubernetes'],
  };
  const { cv, report } = enforceIntegrity(SAMPLE_CV, invented);
  assert.equal(cv.experience.length, 1, 'se descarta la organización que no existe en el original');
  assert.equal(cv.experience[0].achievements.length, 1, 'se descarta el logro con cifras inventadas');
  assert.equal(cv.certifications.length, 1);
  assert.ok(!cv.skills.includes('Kubernetes'));
  assert.ok(report.removed.length >= 4, `se reportan los datos descartados (${report.removed.length})`);
});

test('los datos de contacto salen del original aunque la IA los cambie', () => {
  const { cv, report } = enforceIntegrity(SAMPLE_CV, {
    ...base,
    contact: { email: 'otro@correo.com', phone: '999 999 999' },
  });
  assert.equal(cv.contact.email, 'lucia.torres.demo@correo.com');
  assert.equal(cv.contact.phone, '987 654 321');
  assert.ok(report.removed.some((r) => r.value === 'otro@correo.com'));
});

test('avisa si un año del original no aparece en la versión mejorada', () => {
  const { report } = enforceIntegrity(SAMPLE_CV, { ...base, certifications: [] });
  assert.ok(report.possiblyMissing.some((m) => m.value === '2023'));
});

test('la extracción de Word conserva los saltos de línea de una celda', async () => {
  const { htmlToText } = await import('../src/modules/chat/attachment.service');
  const text = htmlToText('<table><tr><td><p>ana@correo.com<br />987 654 321</p></td><td><p>Lima</p></td></tr></table><h1>EXPERIENCIA</h1><ul><li>Logro &amp; resultado</li></ul>');
  assert.match(text, /ana@correo\.com\n987 654 321/);
  assert.match(text, /EXPERIENCIA\n- Logro & resultado/);
});

test('descarta del perfil y del titular afirmaciones que el CV no respalda (caso real: "recién graduada" en un CV que no lo decía)', () => {
  const { cv, report } = enforceIntegrity(SAMPLE_CV, {
    ...base,
    headline: 'Ingeniera Senior de Software',
    profile: 'Ingeniera de Software titulada y proactiva. Tiene experiencia en desarrollo backend con Node.js.',
  });
  assert.equal(cv.headline, undefined);
  assert.equal(cv.profile, 'Tiene experiencia en desarrollo backend con Node.js.');
  assert.ok(report.removed.some((r) => /titulada/.test(r.reason)));
  assert.ok(report.removed.some((r) => /senior/.test(r.reason)));
});

test('conserva la afirmación si el CV original la respalda', () => {
  const { cv } = enforceIntegrity(SAMPLE_CV, { ...base, headline: 'Bachiller en Ingeniería de Software' });
  assert.equal(cv.headline, 'Bachiller en Ingeniería de Software');
});
