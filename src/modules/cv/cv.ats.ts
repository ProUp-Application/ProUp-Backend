import { AtsCheck } from './cv.types';
import { contactFrom, normalize, numbersIn, wordCount, yearsIn } from './cv.text';

/**
 * Revisión ORIENTATIVA de compatibilidad con sistemas ATS (Applicant Tracking Systems).
 * Son reglas deterministas sobre el texto del CV, cada una con su fundamento (ATS-06).
 * No garantiza superar ningún ATS: cada empresa usa un sistema y criterios distintos.
 */
export const ATS_DISCLAIMER =
  'Revisión orientativa: cada empresa usa un ATS distinto y también filtra por la vacante y otros criterios. ' +
  'Cumplir estas pautas facilita la lectura automática de tu CV, pero no garantiza pasar un filtro.';

export const ATS_INFO =
  'Un ATS (Applicant Tracking System) es el software con el que muchas empresas reciben y ordenan postulaciones. ' +
  'Extrae el texto del CV, lo separa por secciones (experiencia, formación, habilidades) y busca palabras clave del puesto. ' +
  'Si el formato impide leer el texto, tu información puede perderse aunque sea buena.';

const SECTION_PATTERNS: { key: string; label: string; re: RegExp; essential: boolean }[] = [
  { key: 'experiencia', label: 'Experiencia', re: /\bexperiencia\b|\bpracticas?\b|\binternship\b|\bexperience\b/, essential: true },
  { key: 'formacion', label: 'Formación', re: /\beducacion\b|\bformacion\b|\bestudios\b|\beducation\b/, essential: true },
  { key: 'habilidades', label: 'Habilidades', re: /\bhabilidades\b|\bcompetencias\b|\bconocimientos\b|\bskills\b|\bherramientas\b/, essential: true },
  { key: 'perfil', label: 'Perfil o resumen', re: /\bperfil\b|\bresumen\b|\bsobre mi\b|\bobjetivo\b|\bsummary\b/, essential: false },
  { key: 'certificaciones', label: 'Certificaciones o cursos', re: /\bcertificac|\bcertificad|\bcursos?\b/, essential: false },
  { key: 'idiomas', label: 'Idiomas', re: /\bidiomas?\b|\bingles\b|\blanguages?\b/, essential: false },
];

// Símbolos decorativos que algunos ATS leen mal o descartan
const DECORATIVE_RE = /[★☆✓✔✗✘●◆◇■□▪▫►▶➤➢❖♦•●○◉⚫⚪🔹🔸📧📱📞☎✉🏠]/gu;

export interface AtsInput {
  text: string;
  professionTopics?: string[];
  hasTables?: boolean;
  hasImages?: boolean;
}

export function sectionsFound(text: string): string[] {
  const n = normalize(text);
  return SECTION_PATTERNS.filter((s) => s.re.test(n)).map((s) => s.key);
}

export function runAtsChecks(input: AtsInput): AtsCheck[] {
  const { text } = input;
  const n = normalize(text);
  const checks: AtsCheck[] = [];
  const contact = contactFrom(text);

  // 1) Datos de contacto
  const missingContact = [!contact.email && 'correo', !contact.phone && 'teléfono'].filter(Boolean);
  checks.push({
    id: 'contacto',
    label: 'Datos de contacto en texto',
    status: missingContact.length ? 'warning' : 'ok',
    detail: missingContact.length
      ? `No encontramos ${missingContact.join(' ni ')} escrito como texto.`
      : 'Correo y teléfono se leen como texto.',
    why: 'El ATS crea tu ficha de candidato con estos datos; si están dentro de una imagen o un ícono, no los extrae.',
  });

  // 2) Secciones con encabezados convencionales
  const found = sectionsFound(text);
  const missingEssential = SECTION_PATTERNS.filter((s) => s.essential && !found.includes(s.key)).map((s) => s.label);
  checks.push({
    id: 'secciones',
    label: 'Secciones con encabezados convencionales',
    status: missingEssential.length ? 'warning' : 'ok',
    detail: missingEssential.length
      ? `No identificamos estas secciones: ${missingEssential.join(', ')}. Usa títulos estándar como "Experiencia", "Formación" y "Habilidades".`
      : 'Se identifican las secciones principales (experiencia, formación y habilidades).',
    why: 'Los ATS ubican tu información buscando títulos conocidos; nombres creativos ("Mi camino", "Lo que sé hacer") se pueden clasificar mal.',
  });

  // 3) Extensión
  const words = wordCount(text);
  checks.push({
    id: 'extension',
    label: 'Extensión del CV',
    status: words < 150 || words > 900 ? 'warning' : 'ok',
    detail:
      words < 150
        ? `Tiene unas ${words} palabras: puede faltar información sobre tu experiencia o formación.`
        : words > 900
          ? `Tiene unas ${words} palabras (más de 2 páginas): para un perfil joven conviene 1 página.`
          : `Tiene unas ${words} palabras, una extensión adecuada para un perfil joven.`,
    why: 'Un CV breve no da al ATS suficientes palabras clave; uno muy largo diluye lo relevante para el reclutador.',
  });

  // 4) Fechas
  const years = yearsIn(text);
  checks.push({
    id: 'fechas',
    label: 'Fechas de experiencia y estudios',
    status: years.length >= 1 ? 'ok' : 'warning',
    detail: years.length
      ? 'Se identifican fechas en el CV.'
      : 'No encontramos fechas. Indica mes y año de inicio y fin (por ejemplo, "03/2024 – 12/2024").',
    why: 'Muchos ATS calculan los años de experiencia a partir de las fechas de cada puesto.',
  });

  // 5) Símbolos decorativos
  const decorative = text.match(DECORATIVE_RE) ?? [];
  checks.push({
    id: 'simbolos',
    label: 'Viñetas y símbolos estándar',
    status: decorative.length > 3 ? 'warning' : 'ok',
    detail:
      decorative.length > 3
        ? `Encontramos ${decorative.length} símbolos decorativos (íconos, estrellas, viñetas especiales). Usa viñetas simples o guiones.`
        : 'No hay símbolos decorativos que dificulten la lectura.',
    why: 'Los íconos y viñetas especiales pueden convertirse en caracteres extraños o romper el texto al extraerlo.',
  });

  // 6) Tablas, columnas e imágenes (solo se detectan en .docx)
  if (input.hasTables !== undefined || input.hasImages !== undefined) {
    const issues = [input.hasTables && 'tablas', input.hasImages && 'imágenes'].filter(Boolean);
    checks.push({
      id: 'formato',
      label: 'Formato simple (sin tablas ni imágenes)',
      status: issues.length ? 'warning' : 'ok',
      detail: issues.length
        ? `Tu archivo usa ${issues.join(' e ')}. Prefiere un formato de una sola columna.`
        : 'El documento no usa tablas ni imágenes.',
      why: 'Las tablas y las columnas hacen que algunos ATS lean el texto desordenado; el texto dentro de imágenes no se lee.',
    });
  } else {
    checks.push({
      id: 'formato',
      label: 'Formato simple (sin tablas ni imágenes)',
      status: 'info',
      detail: 'En PDF no podemos detectar tablas o columnas. Si tu CV usa dos columnas o gráficos, considera una versión de una columna.',
      why: 'Las tablas y las columnas hacen que algunos ATS lean el texto desordenado; el texto dentro de imágenes no se lee.',
    });
  }

  // 7) Logros medibles
  const figures = numbersIn(text).filter((x) => !/^(19|20)\d\d$/.test(x));
  checks.push({
    id: 'logros',
    label: 'Logros con resultados concretos',
    status: figures.length >= 2 ? 'ok' : 'info',
    detail:
      figures.length >= 2
        ? 'Incluyes cifras o resultados concretos.'
        : 'Casi no hay cifras. Si tienes resultados medibles (porcentajes, cantidades, tiempos), agrégalos.',
    why: 'Los reclutadores priorizan logros verificables; las cifras también ayudan a destacar entre CV similares.',
  });

  // 8) Palabras clave del rubro (sin sugerir que el usuario declare lo que no tiene)
  const topics = input.professionTopics ?? [];
  if (topics.length) {
    const present = topics.filter((t) => normalize(t).split(' ').some((w) => w.length > 3 && n.includes(w)));
    checks.push({
      id: 'palabras_clave',
      label: 'Palabras clave de tu rubro',
      status: present.length >= Math.ceil(topics.length / 2) ? 'ok' : 'info',
      detail: present.length
        ? `Mencionas temas del rubro como: ${present.join(', ')}.`
        : `No encontramos temas frecuentes del rubro (${topics.join(', ')}). Inclúyelos solo si tienes experiencia real en ellos.`,
      why: 'El ATS compara tu CV con las palabras de la vacante: usa los términos que aparecen en el aviso, siempre que reflejen tu experiencia.',
    });
  }

  return checks;
}
