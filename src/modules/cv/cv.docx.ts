import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx';
import { StructuredCv } from './cv.types';

/**
 * Genera el CV en Word (.docx) con un formato apto para ATS: una sola columna,
 * títulos de sección convencionales, viñetas estándar, sin tablas, imágenes ni íconos,
 * y fuente Arial.
 */
const FONT = 'Arial';

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { color: '999999', style: BorderStyle.SINGLE, size: 6, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: FONT })],
  });
}

function line(text: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 20, font: FONT })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 30 },
    children: [new TextRun({ text, size: 20, font: FONT })],
  });
}

export async function buildCvDocx(cv: StructuredCv): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: cv.fullName || 'Nombre y apellidos', bold: true, size: 32, font: FONT })],
    }),
  );
  if (cv.headline) children.push(line(cv.headline, { size: 22 }));

  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, cv.contact.linkedin, cv.contact.website]
    .filter((x): x is string => !!x && x.trim().length > 0);
  if (contact.length) children.push(line(contact.join(' | ')));

  if (cv.profile?.trim()) {
    children.push(heading('Perfil profesional'));
    children.push(line(cv.profile.trim()));
  }

  if (cv.experience.length) {
    children.push(heading('Experiencia'));
    for (const e of cv.experience) {
      children.push(line([e.role, e.organization].filter(Boolean).join(' — '), { bold: true }));
      const meta = [e.period, e.location].filter(Boolean).join(' | ');
      if (meta) children.push(line(meta, { italics: true }));
      for (const a of e.achievements.filter((x) => x.trim())) children.push(bullet(a.trim()));
    }
  }

  if (cv.education.length) {
    children.push(heading('Formación'));
    for (const e of cv.education) {
      children.push(line([e.degree, e.institution].filter(Boolean).join(' — '), { bold: true }));
      if (e.period) children.push(line(e.period, { italics: true }));
    }
  }

  if (cv.certifications.length) {
    children.push(heading('Certificaciones y cursos'));
    for (const c of cv.certifications) {
      children.push(bullet([c.name, c.issuer, c.year].filter(Boolean).join(' — ')));
    }
  }

  if (cv.skills.length) {
    children.push(heading('Habilidades'));
    children.push(line(cv.skills.filter((s) => s.trim()).join(', ')));
  }

  if (cv.languages.length) {
    children.push(heading('Idiomas'));
    children.push(line(cv.languages.filter((s) => s.trim()).join(', ')));
  }

  for (const o of cv.other) {
    if (!o.items.length) continue;
    children.push(heading(o.title));
    for (const i of o.items.filter((x) => x.trim())) children.push(bullet(i.trim()));
  }

  const doc = new Document({
    creator: 'ProUp',
    title: `CV — ${cv.fullName}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
