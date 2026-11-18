/** Utilidades de texto deterministas para el CV (sin IA). */

/** Minúsculas, sin tildes ni signos: para comparar el CV original con el generado. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@.+%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'para', 'por', 'con', 'una', 'un', 'al',
  'the', 'of', 'and', 'sac', 'saa', 'srl', 'eirl', 's.a.c', 's.a', 'peru',
]);

/** Palabras significativas (3+ letras, sin conectores) de un texto. */
export function significantTokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .map((t) => t.replace(/^\.+|\.+$/g, ''))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * ¿El valor aparece en el texto original? Se acepta si la mayoría de sus palabras
 * significativas está en el original (tolera abreviaturas y reordenamientos).
 */
export function appearsIn(original: string, value: string, minRatio = 0.6): boolean {
  const tokens = significantTokens(value);
  if (tokens.length === 0) return true;
  const haystack = new Set(significantTokens(original));
  const normOriginal = normalize(original);
  const found = tokens.filter((t) => haystack.has(t) || normOriginal.includes(t)).length;
  return found / tokens.length >= minRatio;
}

/** Números relevantes de un texto: cifras, porcentajes y años (p. ej. 30, 30%, 2023). */
export function numbersIn(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)?\s?%?/g) ?? [];
  return matches.map((m) => m.replace(/\s/g, '').replace(',', '.'));
}

export function yearsIn(text: string): string[] {
  return [...new Set(text.match(/\b(19[89]\d|20[0-4]\d)\b/g) ?? [])];
}

export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Celulares peruanos (9 dígitos que empiezan con 9) y teléfonos con código de país
export const PHONE_RE = /(?:\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}/;
export const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i;

export function contactFrom(original: string) {
  return {
    email: original.match(EMAIL_RE)?.[0],
    phone: original.match(PHONE_RE)?.[0]?.trim(),
    linkedin: original.match(LINKEDIN_RE)?.[0],
  };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
