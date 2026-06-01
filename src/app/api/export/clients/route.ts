// app/api/export/clients/route.ts
import { PrismaClient } from '@prisma/client'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } })
  
  let csv = "Nom;Societe;Email;Telephone;Adresse;Code_Postal;Ville;Pays\n"
  
  // Fonction pour nettoyer les textes et éviter que Excel ne bugue s'il y a un point-virgule dans l'adresse
  const clean = (str: string | null) => str ? str.replace(/;/g, ',').replace(/\n/g, ' ') : ''

  clients.forEach(c => {
    csv += `${clean(c.name)};${clean(c.company)};${clean(c.email)};${clean(c.phone)};${clean(c.address)};${clean(c.zipCode)};${clean(c.city)};${clean(c.country)}\n`
  })

  return new NextResponse("\uFEFF" + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Base_Clients_Nicole.csv"',
    },
  })
}