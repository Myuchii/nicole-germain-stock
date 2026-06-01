// app/api/export/atelier/route.ts
import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const items = await prisma.quoteItem.findMany({
    include: { quote: true, fabric: true },
    orderBy: { createdAt: 'desc' }
  })
  
  let csv = "Date_Entree;Reference_Devis;Statut_Atelier;Tissu;Quantite;Unite;Temps_Estime_Minutes\n"

  items.forEach(i => {
    const qty = i.quantityMeters || i.quantityUnits || 0
    const unite = i.quantityMeters ? 'Metres' : 'Unites'
    const date = i.createdAt.toLocaleDateString('fr-FR')
    
    csv += `${date};${i.quote?.reference || 'Inconnu'};${i.statusProduction};${i.fabric?.name || 'Inconnu'};${qty};${unite};${i.prodTimeMinutes}\n`
  })

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Rapport_Atelier_Nicole.csv"',
    },
  })
}