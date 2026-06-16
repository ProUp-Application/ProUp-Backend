import { RecommendationCategory } from '@prisma/client';
import { Band } from '../analysis/scoring';

/**
 * Catálogo estático de recomendaciones (fallback) por categoría y banda.
 * Contextualizado al mercado laboral de Lima Metropolitana.
 * Sirve como respaldo cuando el LLM no está disponible (degradación elegante).
 */
export const RECOMMENDATION_CATALOG: Record<RecommendationCategory, Record<Band, string>> = {
  CLOTHING: {
    BAJA: 'Tu vestimenta se ve informal para un contexto profesional. Opta por una camisa o blusa de tonos sobrios y prendas bien planchadas; en Lima, el business casual funciona en la mayoría de sectores.',
    MEDIA: 'Tu vestimenta es adecuada. Para elevarla, cuida la combinación de colores (máximo 2-3 tonos) y considera una prenda formal extra como un saco para entrevistas importantes.',
    ALTA: '¡Excelente elección de vestimenta! Mantén este nivel de formalidad y asegúrate de que las prendas estén siempre limpias y bien ajustadas.',
  },
  POSTURE: {
    BAJA: 'Tu postura transmite poca seguridad. Endereza la columna, relaja los hombros hacia atrás y evita encorvarte. Una postura erguida proyecta confianza ante un reclutador.',
    MEDIA: 'Buena postura. Trabaja en mantener los hombros nivelados y evitar cruzar los brazos, que puede leerse como actitud defensiva.',
    ALTA: 'Tu postura proyecta seguridad y profesionalismo. Mantenla durante toda la entrevista, especialmente al saludar y al despedirte.',
  },
  EXPRESSION: {
    BAJA: 'Tu expresión facial luce tensa o poco accesible. Practica una sonrisa natural y mantén contacto visual con la cámara; transmite cercanía sin perder seriedad.',
    MEDIA: 'Tu expresión es correcta. Suma una sonrisa genuina en los momentos clave y sostén el contacto visual para generar mayor conexión.',
    ALTA: 'Tu expresión transmite confianza y cercanía. Es ideal para causar una buena primera impresión.',
  },
  CONTEXT: {
    BAJA: 'El entorno de tu foto resta profesionalismo. Busca buena iluminación (de frente, no a contraluz) y un fondo limpio y neutro, sin elementos que distraigan.',
    MEDIA: 'El contexto es aceptable. Mejora la iluminación y ordena el fondo para que toda la atención esté en ti.',
    ALTA: 'El entorno y la iluminación son adecuados y profesionales. ¡Bien hecho!',
  },
  SOFT_SKILLS: {
    BAJA: 'Trabaja tu comunicación no verbal en conjunto: seguridad, contacto visual y una presentación cuidada marcan la diferencia en una entrevista en Lima.',
    MEDIA: 'Vas por buen camino. Refuerza la coherencia entre tu imagen y tu discurso para proyectar una marca personal sólida.',
    ALTA: 'Tu imagen profesional integral es muy sólida. Enfócate ahora en pulir tu narrativa y tus respuestas para entrevistas.',
  },
};

/** Mapea cada categoría al score parcial relevante. */
export const CATEGORY_SCORE_KEY: Record<RecommendationCategory, 'face' | 'clothing' | 'posture' | 'context' | 'overall'> = {
  EXPRESSION: 'face',
  CLOTHING: 'clothing',
  POSTURE: 'posture',
  CONTEXT: 'context',
  SOFT_SKILLS: 'overall',
};
