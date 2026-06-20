/**
 * Taxonomía de profesiones para jóvenes profesionales de Lima Metropolitana.
 * Es el eje de personalización: adapta scoring de imagen, recomendaciones,
 * preguntas de entrevista y el contexto del chatbot a la profesión del usuario.
 */
export type ProfessionSector =
  | 'finanzas'
  | 'tecnologia'
  | 'creativo'
  | 'educacion'
  | 'salud'
  | 'general';

export interface Profession {
  id: string;
  label: string;
  sector: ProfessionSector; // determina los pesos de scoring (scoring.ts)
  expectedFormality: 'FORMAL' | 'SEMI_FORMAL';
  topics: string[]; // temas para preguntas técnicas de entrevista
}

export const PROFESSIONS: Profession[] = [
  { id: 'administracion', label: 'Administración y Negocios', sector: 'finanzas', expectedFormality: 'FORMAL', topics: ['gestión de procesos', 'indicadores KPI', 'liderazgo de equipos', 'toma de decisiones'] },
  { id: 'contabilidad', label: 'Contabilidad y Finanzas', sector: 'finanzas', expectedFormality: 'FORMAL', topics: ['estados financieros', 'tributación SUNAT', 'análisis de costos', 'normas NIIF'] },
  { id: 'economia', label: 'Economía', sector: 'finanzas', expectedFormality: 'FORMAL', topics: ['análisis económico', 'proyecciones financieras', 'política económica', 'análisis de datos'] },
  { id: 'derecho', label: 'Derecho', sector: 'finanzas', expectedFormality: 'FORMAL', topics: ['derecho laboral', 'redacción de contratos', 'normativa peruana', 'argumentación jurídica'] },
  { id: 'sistemas', label: 'Ingeniería de Sistemas / Software', sector: 'tecnologia', expectedFormality: 'SEMI_FORMAL', topics: ['estructuras de datos', 'bases de datos', 'diseño de APIs', 'metodologías ágiles'] },
  { id: 'industrial', label: 'Ingeniería Industrial', sector: 'general', expectedFormality: 'FORMAL', topics: ['optimización de procesos', 'cadena de suministro', 'gestión de calidad', 'metodología Lean'] },
  { id: 'civil', label: 'Ingeniería Civil', sector: 'general', expectedFormality: 'FORMAL', topics: ['gestión de obras', 'elaboración de presupuestos', 'seguridad en obra', 'normas técnicas'] },
  { id: 'marketing', label: 'Marketing y Publicidad', sector: 'creativo', expectedFormality: 'SEMI_FORMAL', topics: ['marketing digital', 'métricas de campañas', 'branding', 'estrategia en redes sociales'] },
  { id: 'diseno', label: 'Diseño Gráfico / UX', sector: 'creativo', expectedFormality: 'SEMI_FORMAL', topics: ['portafolio de diseño', 'herramientas de diseño', 'experiencia de usuario', 'proceso creativo'] },
  { id: 'comunicaciones', label: 'Comunicaciones / Periodismo', sector: 'creativo', expectedFormality: 'SEMI_FORMAL', topics: ['redacción', 'comunicación estratégica', 'manejo de medios', 'vocería'] },
  { id: 'arquitectura', label: 'Arquitectura', sector: 'creativo', expectedFormality: 'SEMI_FORMAL', topics: ['diseño arquitectónico', 'gestión de proyectos', 'normativa urbana', 'presentación de propuestas'] },
  { id: 'psicologia', label: 'Psicología', sector: 'salud', expectedFormality: 'SEMI_FORMAL', topics: ['evaluación psicológica', 'manejo de casos', 'ética profesional', 'estrategias de intervención'] },
  { id: 'salud', label: 'Salud / Enfermería', sector: 'salud', expectedFormality: 'FORMAL', topics: ['atención al paciente', 'protocolos de bioseguridad', 'trabajo bajo presión', 'trabajo en equipo clínico'] },
  { id: 'educacion', label: 'Educación', sector: 'educacion', expectedFormality: 'SEMI_FORMAL', topics: ['planificación curricular', 'manejo de aula', 'evaluación del aprendizaje', 'educación inclusiva'] },
  { id: 'rrhh', label: 'Recursos Humanos', sector: 'general', expectedFormality: 'FORMAL', topics: ['reclutamiento y selección', 'clima laboral', 'gestión del talento', 'legislación laboral'] },
  { id: 'ventas', label: 'Ventas / Comercial', sector: 'general', expectedFormality: 'SEMI_FORMAL', topics: ['técnicas de venta', 'manejo de objeciones', 'cumplimiento de metas', 'uso de CRM'] },
  { id: 'turismo', label: 'Turismo / Hotelería', sector: 'general', expectedFormality: 'SEMI_FORMAL', topics: ['atención al cliente', 'manejo de idiomas', 'gestión de servicios', 'protocolo y etiqueta'] },
  { id: 'otra', label: 'Otra profesión', sector: 'general', expectedFormality: 'SEMI_FORMAL', topics: ['logros profesionales', 'trabajo en equipo', 'resolución de problemas', 'objetivos de carrera'] },
];

export function findProfession(value?: string | null): Profession | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase().trim();
  return PROFESSIONS.find((p) => p.id === v || p.label.toLowerCase() === v);
}

export function professionLabel(value?: string | null): string {
  return findProfession(value)?.label ?? 'profesional';
}
