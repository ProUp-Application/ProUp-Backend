/**
 * Reglas deterministas de tiempo y puntaje del simulador (sin IA), separadas para
 * poder probarlas con tests.
 */

export type TrackKind = 'BEHAVIORAL' | 'TECHNICAL' | 'EXECUTIVE' | 'PITCH';

/** Tiempo de referencia por respuesta: el Elevator Pitch dura 60 s por diseño. */
export function timeLimitFor(kind: TrackKind): number {
  return kind === 'PITCH' ? 60 : 120;
}

/**
 * Comentario sobre el tiempo usado en una respuesta. Devuelve null si el tiempo
 * es adecuado o no se registró.
 */
export function timeNote(kind: TrackKind, durationSeconds: number | undefined | null): string | null {
  if (typeof durationSeconds !== 'number' || durationSeconds <= 0) return null;
  const limit = timeLimitFor(kind);
  if (kind === 'PITCH') {
    if (durationSeconds > limit + 5) {
      return `Tu pitch duró ${durationSeconds} s y la referencia es ${limit} s: recorta detalles y llega antes a tu propuesta de valor.`;
    }
    if (durationSeconds < 25) {
      return `Tu pitch duró solo ${durationSeconds} s: aprovecha mejor el minuto con un logro concreto y un cierre claro.`;
    }
    return null;
  }
  if (durationSeconds > limit + 30) {
    return `Usaste ${durationSeconds} s; en una entrevista conviene responder en unos ${limit / 60} minutos. Ve más directo al resultado.`;
  }
  if (durationSeconds < 15) {
    return `Respondiste en ${durationSeconds} s: desarrolla un poco más con un ejemplo concreto.`;
  }
  return null;
}

/**
 * Puntaje global de la simulación: se basa en el CONTENIDO evaluado. Solo si se
 * midió la comunicación no verbal con la cámara, aporta el 30 %. La autopercepción
 * de seguridad del usuario no altera el puntaje (es un dato que él mismo declara).
 */
export function combineOverall(contentScore: number, nonVerbalScore?: number | null): number {
  const content = Math.max(0, Math.min(100, Math.round(contentScore)));
  if (typeof nonVerbalScore !== 'number') return content;
  const nv = Math.max(0, Math.min(100, Math.round(nonVerbalScore)));
  return Math.round(content * 0.7 + nv * 0.3);
}
