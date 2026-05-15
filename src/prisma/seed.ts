import { PrismaClient, UnitType, MovementType, QuoteStatus, UserRole } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // User Nicole
  const hashedPassword = await hash('nicole123', 12)
  await prisma.user.upsert({
    where: { email: 'nicole@germain.com' },
    update: {},
    create: {
      email: 'nicole@germain.com',
      name: 'Nicole Germain',
      password: hashedPassword,
      role: UserRole.ADMIN
    }
  })

  // Tissus avec seuils d'alerte
  await prisma.fabric.createMany({
    data: [
      {
        reference: 'T001',
        name: 'Coton Bleu Marine',
        color: 'Bleu Marine',
        unit: UnitType.METER,
        stockMeters: 150.50,
        alertThresholdMeters: 20.00,
        pricePerMeter: 12.50
      },
      {
        reference: 'T002',
        name: 'Lin Naturel Beige',
        color: 'Beige',
        unit: UnitType.METER,
        stockMeters: 8.25,
        alertThresholdMeters: 10.00,
        pricePerMeter: 18.75
      },
      {
        reference: 'T003',
        name: 'Soie Rouge Italien',
        color: 'Rouge',
        unit: UnitType.UNIT,
        stockUnits: 3,
        alertThresholdUnits: 5,
        pricePerUnit: 45.00
      }
    ],
    skipDuplicates: true
  })

  console.log('✅ Seed complet !')
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())