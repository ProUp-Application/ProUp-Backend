import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECTORS = [
  { name: 'Tecnología', formalityRequirements: { dress: 'business_casual', level: 'medio' } },
  { name: 'Finanzas', formalityRequirements: { dress: 'formal', level: 'alto' } },
  { name: 'Banca', formalityRequirements: { dress: 'formal', level: 'alto' } },
  { name: 'Educación', formalityRequirements: { dress: 'business_casual', level: 'medio' } },
  { name: 'Salud', formalityRequirements: { dress: 'business_casual', level: 'medio' } },
  { name: 'Marketing', formalityRequirements: { dress: 'smart_casual', level: 'medio' } },
  { name: 'Creativo', formalityRequirements: { dress: 'smart_casual', level: 'bajo' } },
];

async function main() {
  for (const sector of SECTORS) {
    await prisma.sectorCatalog.upsert({
      where: { name: sector.name },
      create: sector,
      update: { formalityRequirements: sector.formalityRequirements },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`✔ Seed completo: ${SECTORS.length} sectores`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
