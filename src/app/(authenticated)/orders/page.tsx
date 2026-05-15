import { PrismaClient, QuoteStatus } from '@prisma/client'
import Link from 'next/link'
import { Printer, CheckCircle, Trash2, FileText } from 'lucide-react'
import { deleteQuote } from '@/app/_actions/quote-actions'
import { OrderCard } from '@/components/OrderCard' // ← Nouveau composant Client

const prisma = new PrismaClient()

async function getOrders() {
  return await prisma.quote.findMany({
    where: { status: QuoteStatus.VALIDATED },
    include: {
      items: {
        include: { fabric: true }
      }
    },
    orderBy: { validatedAt: 'desc' }
  })
}

export default async function OrdersPage() {
  const orders = await getOrders()

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* EN-TÊTE */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
            Commandes en cours
          </h1>
          <p className="text-slate-500 mt-1">{orders.length} commande(s) validée(s)</p>
        </div>
        <Link 
          href="/quotes"
          className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
        >
          <FileText size={20} />
          Devis en attente
        </Link>
      </div>

      {/* LISTE COMMANDES */}
      {orders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300">
          <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-2xl font-bold text-slate-600 mb-2">Aucune commande en cours</h3>
          <p className="text-slate-500 mb-6">Validez vos devis pour les voir ici</p>
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