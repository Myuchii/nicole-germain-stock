import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const fabrics = await prisma.fabric.findMany({
      where: { isArchived: false },
      orderBy: { reference: 'asc' }
    })
    return NextResponse.json(fabrics)
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}