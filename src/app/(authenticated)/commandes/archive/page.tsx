import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ArchiveListClient from '@/components/ArchiveListClient'
import ReturnSavModal from '@/components/ReturnSavModal'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

async function getArchivedOrders() {
  return await prisma.quote.findMany({
    where: {
      status: { in: ['ARCHIVED', 'CANCELLED'] } // On prend les expédiées et les annulées
    },
    include: {
      client: true,
      items: { include: { fabric: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export default async function ArchivePage() {
  const rawOrders = await getArchivedOrders()
  
  // Normalisation des prix pour éviter les bugs d'affichage de types Prisma Decimal
  const orders = rawOrders.map(o => ({
    ...o,
    totalPrice: Number(o.totalPrice),
    quantity: Number(o.quantity),
    items: o.items.map(i => ({
      ...i,
      sellingPrice: Number(i.sellingPrice),
      quantityMeters: Number(i.quantityMeters)
    }))
  }))

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* RETOUR ET TITRE */}
      <div className="flex items-center gap-4">
        <Link href="/commandes" className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Archives & SAV</h1>
          <p className="text-slate-500">Consultez l'historique, gérez les retours colis et réactivez des commandes.</p>
        </div>
      </div>

      {/* COMPOSANT DE FILTRAGE DYNAMIQUE */}
      <ArchiveListClient initialOrders={JSON.parse(JSON.stringify(orders))} />
    </div>
  )
}