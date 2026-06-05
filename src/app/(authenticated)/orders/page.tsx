import { PrismaClient, QuoteStatus } from '@prisma/client'
import Link from 'next/link'
import { CheckCircle, Archive } from 'lucide-react'
import { OrderCard } from '@/components/OrderCard'
import SyncWebButton from '@/components/SyncWebButton'

export const dynamic = 'force-dynamic'

const prisma = new PrismaClient()

async function getOrders() {
  return await prisma.quote.findMany({
    where: { status: QuoteStatus.VALIDATED },
    include: {
      client: true,
      items: {
        include: { fabric: true }
      }
    },
    orderBy: { validatedAt: 'desc' }
  })
}

// 🛠️ Interface alignée à 100% avec les exigences de OrderCard
interface OrderProps {
  id: string
  reference: string
  totalPrice: number
  quantity: number
  isTTC: boolean
  createdAt: Date
  validatedAt: Date | null
  client: {
    id: string
    name: string
    company: string | null
    address: string | null
    zipCode: string | null
    city: string | null
  }
  items: Array<{
    id: string
    customName?: string | null // 🆕 Ajouté pour compatibilité
    discountPercent: number    // 🆕 AJOUTÉ : Propriété requise manquante !
    fabric: {
      id: string
      reference: string
      name: string
      color: string
      unit: "METER" | "UNIT"
      width: number | null
      stockMeters: number | null
      pricePerMeter: number
    } | null // 🆕 Peut être null selon le schéma global
    quantityMeters: number | null
    prodTimeMinutes: number
    sellingPrice: number | null
  }>
}

export default async function OrdersPage() {
  const orders = await getOrders() as unknown as OrderProps[]

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* EN-TÊTE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
            Commandes en cours
          </h1>
          <p className="text-slate-500 mt-1">{orders.length} commande(s) validée(s)</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <SyncWebButton />

          <Link 
            href="/orders/archive"
            className="px-5 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-800 hover:text-white transition-all shadow-sm flex items-center gap-2 text-sm"
          >
            <Archive size={18} />
            Archives & SAV
          </Link>

          <Link 
            href="/quotes"
            className="px-5 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2 text-sm"
          >
            Devis en attente
          </Link>
        </div>
      </div>

      {/* LISTE */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300">
          <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-2xl font-bold text-slate-600 mb-2">Aucune commande en cours</h3>
          <p className="text-slate-500 mb-6">Validez vos devis ou synchronisez le site web pour les voir ici</p>
          <Link 
            href="/quotes"
            className="px-8 py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg"
          >
            Voir les devis
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
            />
          ))}
        </div>
      )}
    </div>
  )
}