import { AppError } from '../../utils/AppError';

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

const MAX_CHARS = 5500;

/** Extrae el texto de un CV adjunto (PDF, .docx o .txt). */
export async function extractCvText(file: UploadedFile): Promise<string> {
  const name = (file.originalname || '').toLowerCase();

  let text: string;
  if (name.endsWith('.pdf') || file.mimetype === 'application/pdf') {
    text = await extractPdf(file.buffer);
  } else if (
    name.endsWith('.docx') ||
    file.mimetype.includes('officedocument.wordprocessingml')
  ) {
    text = await extractDocx(file.buffer);
  } else if (name.endsWith('.txt') || file.mimetype.startsWith('text/')) {
    text = file.buffer.toString('utf8');
  } else if (name.endsWith('.doc')) {
    throw AppError.badRequest(
      'El formato .doc antiguo no es compatible. Guarda tu CV como PDF o .docx e inténtalo de nuevo.',
      'UNSUPPORTED_FORMAT',
    );
  } else {
    throw AppError.badRequest(
      'Formato no soportado. Adjunta tu CV en PDF, Word (.docx) o texto (.txt).',
      'UNSUPPORTED_FORMAT',
    );
  }

  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length < 80) {
    throw AppError.badRequest(
      'No pudimos leer texto del archivo (¿es un CV escaneado como imagen?). Prueba con un PDF con texto seleccionable o pega el contenido en el chat.',
      'EMPTY_TEXT',
    );
  }
  return clean.slice(0, MAX_CHARS);
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return String(result?.text ?? '');
  } finally {
    await parser.destroy?.();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return String(result?.value ?? '');
}

export interface CvDocument {
  /** Texto del CV conservando los saltos de línea (para detectar secciones). */
  text: string;
  /** Solo para .docx: si el archivo usa tablas o imágenes (afectan a los ATS). */
  hasTables?: boolean;
  hasImages?: boolean;
}

const MAX_DOC_CHARS = 9000;

/** Extrae el CV para el módulo "Mejorar mi CV": texto con saltos de línea y formato. */
export async function extractCvDocument(file: UploadedFile): Promise<CvDocument> {
  const name = (file.originalname || '').toLowerCase();
  let text: string;
  let hasTables: boolean | undefined;
  let hasImages: boolean | undefined;

  if (name.endsWith('.pdf') || file.mimetype === 'application/pdf') {
    text = await extractPdf(file.buffer);
  } else if (name.endsWith('.docx') || file.mimetype.includes('officedocument.wordprocessingml')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth');
    const [raw, html] = await Promise.all([
      mammoth.extractRawText({ buffer: file.buffer }),
      mammoth.convertToHtml({ buffer: file.buffer }),
    ]);
    text = String(raw?.value ?? '');
    const markup = String(html?.value ?? '');
    hasTables = /<table/i.test(markup);
    hasImages = /<img/i.test(markup);
  } else if (name.endsWith('.txt') || file.mimetype.startsWith('text/')) {
    text = file.buffer.toString('utf8');
  } else {
    throw AppError.badRequest(
      'Formato no soportado. Adjunta tu CV en PDF, Word (.docx) o texto (.txt).',
      'UNSUPPORTED_FORMAT',
    );
  }

  const clean = text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  if (clean.replace(/\s+/g, ' ').length < 80) {
    throw AppError.badRequest(
      'No pudimos leer texto del archivo (¿es un CV escaneado como imagen?). Prueba con un PDF con texto seleccionable o pega el contenido.',
      'EMPTY_TEXT',
    );
  }
  return { text: clean.slice(0, MAX_DOC_CHARS), hasTables, hasImages };
}
