/**
 * Limpia cuentas de prueba para repetir casos de QA (hallazgo H02, CP001).
 *
 *   npm run qa:reset-account -- prueba.cp@correo.com [otro@correo.com ...] [--dry-run] [--force]
 *
 * Borra el usuario y, en cascada, su perfil, consentimientos, dispositivos, análisis
 * (con resultados, recomendaciones y calificaciones), entrevistas y chats. Primero
 * muestra lo que va a borrar. Usa la base de datos de DATABASE_URL.
 *
 * Por seguridad solo acepta correos que parecen de prueba (dominio correo.com,
 * example.com/.org, test, o con "prueba", "test", "qa" o "demo" en el usuario).
 * Para otro correo hay que agregar --force.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const TEST_DOMAINS = /@(correo\.com|example\.(com|org)|test\.com|[a-z0-9-]+\.test)$/i;
const TEST_LOCAL = /(prueba|test|qa|demo)/i;

export function looksLikeTestEmail(email: string): boolean {
  const [local = ''] = email.split('@');
  return TEST_DOMAINS.test(email) || TEST_LOCAL.test(local);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const emails = args.filter((a) => !a.startsWith('--')).map((e) => e.trim().toLowerCase());

  if (!emails.length) {
    console.error('Uso: npm run qa:reset-account -- <correo> [más correos] [--dry-run] [--force]');
    process.exit(1);
  }
  const blocked = emails.filter((e) => !looksLikeTestEmail(e));
  if (blocked.length && !force) {
    console.error(`No parecen cuentas de prueba: ${blocked.join(', ')}. Agrega --force si de verdad quieres borrarlas.`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`- ${email}: no existe (nada que borrar).`);
        continue;
      }
      const uid = user.id;
      const [consents, devices, analyses, results, recs, feedback, interviews, chats, messages] = await Promise.all([
        prisma.consent.count({ where: { userId: uid } }),
        prisma.device.count({ where: { userId: uid } }),
        prisma.analysisRequest.count({ where: { userId: uid } }),
        prisma.analysisResult.count({ where: { analysisRequest: { userId: uid } } }),
        prisma.recommendation.count({ where: { analysisResult: { analysisRequest: { userId: uid } } } }),
        prisma.userFeedback.count({ where: { recommendation: { analysisResult: { analysisRequest: { userId: uid } } } } }),
        prisma.interviewSimulation.count({ where: { userId: uid } }),
        prisma.chatSession.count({ where: { userId: uid } }),
        prisma.chatMessage.count({ where: { session: { userId: uid } } }),
      ]);
      console.log(
        `- ${email} (${user.firstName} ${user.lastName}, creada ${user.createdAt.toISOString().slice(0, 10)}): ` +
          `${consents} consentimientos, ${devices} dispositivos, ${analyses} análisis (${results} resultados, ` +
          `${recs} recomendaciones, ${feedback} calificaciones), ${interviews} entrevistas, ` +
          `${chats} chats (${messages} mensajes).`,
      );
      if (dryRun) continue;
      await prisma.auditEvent.create({
        data: { userId: null, eventType: 'USER_DELETED', payload: { userId: uid, source: 'qa-reset-account' } },
      });
      await prisma.user.delete({ where: { id: uid } }); // el resto se borra en cascada
      console.log('  borrada.');
    }
    if (dryRun) console.log('Modo --dry-run: no se borró nada.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
