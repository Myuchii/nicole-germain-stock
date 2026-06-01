// app/api/export/stock/route.ts
import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const fabrics = await prisma.fabric.findMany({ where: { isArchived: false } })
  const finishedProducts = await prisma.finishedProduct.findMany()
  const merchandise = await prisma.merchandise.findMany({ include: { lots: true } })

  // En-têtes du tableau Excel
  let csv = "Categorie;Reference;Nom;Stock_Restant;Unite;Valeur_Unitaire_HT\n"

  // 1. Tissus
  fabrics.forEach(f => {
    csv += `Tissu;${f.reference};${f.name};${f.stockMeters};Metres;${f.pricePerMeter}\n`
  })
  // 2. Produits Finis
  finishedProducts.forEach(fp => {
    csv += `Produit Fini;${fp.reference};${fp.name};${fp.stockQuantity};Unites;${fp.sellingPriceHT}\n`
  })
  // 3. Marchandises
  merchandise.forEach(m => {
    const stock = m.lots.reduce((acc, lot) => acc + lot.quantityLeft, 0)
    csv += `Marchandise;${m.reference};${m.name};${stock};Unites;${m.sellingPriceHT}\n`
  })

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Inventaire_Stock_Nicole.csv"',
    },
  })
}