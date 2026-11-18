/**
 * Datos de DEMOSTRACIÓN para la sustentación (SUS-03). Solo se ejecuta a pedido:
 *   npm run db:seed-demo
 * Crea (o reinicia) la cuenta demo@proup.pe / Demo2026 con historial de análisis y
 * entrevistas, y 5 usuarios ficticios de comunidad para que la referencia general
 * tenga datos. Todos los datos son inventados.
 */
import bcrypt from 'bcryptjs';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@proup.pe';
const DEMO_PASSWORD = 'Demo2026';

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 3600 * 1000);

async function resetUser(email: string, firstName: string, lastName: string, profession: string) {
  await prisma.user.deleteMany({ where: { email } });
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName,
      lastName,
      profile: { create: { profession, experienceLevel: 'JUNIOR', careerGoals: 'Conseguir mi primer empleo formal en Lima' } },
      consents: { create: { type: 'DATA_PROCESSING', granted: true, version: '1.1' } },
    },
  });
}

async function addAnalysis(
  userId: string,
  createdAt: Date,
  frameType: 'PRIMER_PLANO' | 'MEDIO_CUERPO' | 'CUERPO_COMPLETO',
  scores: { face: number; clothing: number | null; posture: number | null; context: number; overall: number },
  assessment: Prisma.InputJsonValue,
  advice: { category: 'EXPRESSION' | 'CLOTHING' | 'POSTURE' | 'CONTEXT' | 'SOFT_SKILLS'; text: string; priority: number }[],
) {
  await prisma.analysisRequest.create({
    data: {
      userId,
      captureType: frameType === 'PRIMER_PLANO' ? 'SELFIE' : 'FULL_BODY',
      createdAt,
      result: {
        create: {
          createdAt,
          faceScore: scores.face,
          clothingScore: scores.clothing,
          postureScore: scores.posture,
          contextScore: scores.context,
          overallScore: scores.overall,
          clothingFormality: scores.clothing === null ? null : 'SEMI_FORMAL',
          frameType,
          assessment,
          recommendations: {
            create: advice.map((a) => ({ category: a.category, description: a.text, naturalLanguageAdvice: a.text, priority: a.priority })),
          },
        },
      },
    },
  });
}

async function main() {
  const demo = await resetUser(DEMO_EMAIL, 'Lucía', 'Torres', 'sistemas');

  await addAnalysis(
    demo.id,
    daysAgo(12),
    'PRIMER_PLANO',
    { face: 58, clothing: null, posture: null, context: 49, overall: 54 },
    {
      evaluated: [
        { category: 'face', evidence: ['Expresión seria, sin sonrisa (18%)', 'Mirada de frente a la cámara (giro 7°)', 'Ojos visibles'] },
        { category: 'context', evidence: ['Iluminación baja', 'Buen encuadre para un(a) primer plano'] },
      ],
      notEvaluated: [
        { category: 'clothing', reason: 'La foto solo muestra el rostro: no se ve la ropa, así que no evaluamos la vestimenta.' },
        { category: 'posture', reason: 'Es un primer plano: no se ven los hombros y la cadera, así que no evaluamos la postura.' },
      ],
    },
    [
      { category: 'CONTEXT', text: 'Ubícate frente a una ventana para que la luz ilumine tu rostro de frente.', priority: 1 },
      { category: 'EXPRESSION', text: 'Practica una sonrisa natural: transmite cercanía sin perder seriedad.', priority: 2 },
    ],
  );
  await addAnalysis(
    demo.id,
    daysAgo(6),
    'MEDIO_CUERPO',
    { face: 74, clothing: 52, posture: 70, context: 72, overall: 66 },
    {
      evaluated: [
        { category: 'face', evidence: ['Sonrisa leve (45%)', 'Mirada de frente a la cámara (giro 5°)', 'Ojos visibles'] },
        { category: 'clothing', evidence: ['Prendas casuales: polo (78%)', 'Se evaluó de la cintura hacia arriba: no evaluamos pantalón ni calzado.'] },
        { category: 'posture', evidence: ['Hombros nivelados (90%)', 'Torso inclinado (70%)', 'Se evaluó la postura de la parte superior del cuerpo'] },
        { category: 'context', evidence: ['Iluminación adecuada', 'Buen encuadre para un(a) medio cuerpo'] },
      ],
      notEvaluated: [],
      formalityEvidence: ['Casual porque se ve: polo (78%).', 'Se evaluó de la cintura hacia arriba: no evaluamos pantalón ni calzado.'],
    },
    [
      { category: 'CLOTHING', text: 'Cambia el polo por una camisa de tono sobrio: en tecnología el business casual funciona bien.', priority: 2 },
      { category: 'POSTURE', text: 'Endereza el torso y relaja los hombros hacia atrás.', priority: 2 },
    ],
  );
  await addAnalysis(
    demo.id,
    daysAgo(1),
    'CUERPO_COMPLETO',
    { face: 86, clothing: 82, posture: 84, context: 80, overall: 83 },
    {
      evaluated: [
        { category: 'face', evidence: ['Sonrisa visible (72%)', 'Mirada de frente a la cámara (giro 3°)', 'Ojos visibles'] },
        { category: 'clothing', evidence: ['Prendas formales: saco o terno (81%)'] },
        { category: 'posture', evidence: ['Hombros nivelados (95%)', 'Torso recto (88%)'] },
        { category: 'context', evidence: ['Iluminación adecuada', 'Buen encuadre para un(a) cuerpo completo'] },
      ],
      notEvaluated: [],
      formalityEvidence: ['Formal porque se ve: saco o terno (81%).'],
    },
    [{ category: 'SOFT_SKILLS', text: 'Tu imagen es sólida: ahora enfócate en tus respuestas de entrevista.', priority: 3 }],
  );

  await prisma.interviewSimulation.create({
    data: {
      userId: demo.id,
      createdAt: daysAgo(3),
      track: 'Elevator Pitch · Ingeniería de Sistemas / Software',
      questions: ['Preséntate en 60 segundos ante un reclutador en una feria laboral.'],
      responses: [
        {
          question: 'Preséntate en 60 segundos ante un reclutador en una feria laboral.',
          answer: 'Hola, soy Lucía, ingeniera de software de la UPC. En mis prácticas automaticé pruebas y reduje en 30% el tiempo de despliegue.',
          durationSeconds: 48,
          mode: 'VOICE',
        },
      ],
      overallScore: 72,
      confidenceScore: 60,
      durationSeconds: 180,
      strengths: ['Mencionas un logro con una cifra concreta.'],
      improvements: ['Cierra con una llamada a la acción clara.'],
      feedback: 'Buen pitch: agrega qué buscas y cierra pidiendo una reunión.',
      questionFeedback: [
        {
          index: 1,
          question: 'Preséntate en 60 segundos ante un reclutador en una feria laboral.',
          score: 72,
          feedback: 'Buen gancho con un logro medible; falta decir qué puesto buscas y cerrar con una invitación.',
          timeNote: null,
          durationSeconds: 48,
          timeLimitSeconds: 60,
          mode: 'VOICE',
        },
      ],
    },
  });

  // Usuarios ficticios de comunidad (para la referencia general del progreso)
  const community = [
    ['comunidad1@proup.pe', 'Andrés', 'Rojas', 'administracion', 61],
    ['comunidad2@proup.pe', 'María', 'Quispe', 'contabilidad', 70],
    ['comunidad3@proup.pe', 'Jorge', 'Flores', 'industrial', 58],
    ['comunidad4@proup.pe', 'Valeria', 'Ramos', 'marketing', 77],
    ['comunidad5@proup.pe', 'Diego', 'Huamán', 'civil', 66],
  ] as const;
  for (const [email, first, last, prof, overall] of community) {
    const u = await resetUser(email, first, last, prof);
    await addAnalysis(
      u.id,
      daysAgo(4),
      'MEDIO_CUERPO',
      { face: overall, clothing: overall, posture: overall, context: overall, overall },
      { evaluated: [], notEvaluated: [] },
      [],
    );
  }

  // eslint-disable-next-line no-console
  console.log(`✔ Demo lista: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (+5 usuarios de comunidad)`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
