export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma' 
import { QuoteStatus } from '@prisma/client'
import Link from 'next/link'
import { CheckCircle, Archive, Search } from 'lucide-react'
import { OrderCard } from '@/components/OrderCard'
import SyncWebButton from '@/components/SyncWebButton'
import ImportOrderModalWrapper from '@/components/ImportOrderModalWrapper'

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
    customName?: string | null 
    discountPercent: number    
    quantityUnits: number
    fabric: {
      id: string
      reference: string
      name: string
      color: string
      unit: "METER" | "UNIT"
      width: number | null
      stockMeters: number | null
      pricePerMeter: number
    } | null 
    quantityMeters: number | null
    prodTimeMinutes: number
    sellingPrice: number | null
  }>
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; source?: string }>
}) {
  const resolvedParams = await searchParams
  const searchQuery = resolvedParams.q || ''
  const sourceFilter = resolvedParams.source || 'ALL'

  const orders = await getOrders() as unknown as OrderProps[]

  // 🎯 FILTRAGE DYNAMIQUE BASÉ SUR TA RÉFÉRENCE "VOS-#", "NG" OU SUR PLACE
  const filteredOrders = orders.filter(order => {
    let provenance = 'SUR_PLACE' 
    const refUpper = order.reference.toUpperCase()
    
    if (refUpper.startsWith('VOS-#')) {
      provenance = 'VOSGIA'
    } else if (refUpper.startsWith('NG-#') || refUpper.includes('NG') || order.items.some(i => i.customName?.toUpperCase().includes('NICOLE GERMAIN'))) {
      provenance = 'SITE_NG'
    }

    const matchesSource = sourceFilter === 'ALL' || provenance === sourceFilter

    const matchesSearch = 
      order.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.some(i => i.customName?.toLowerCase().includes(searchQuery.toLowerCase()))

    return matchesSource && matchesSearch
  })

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* EN-TÊTE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
            Commandes en cours
          </h1>
          <p className="text-slate-500 mt-1">{filteredOrders.length} commande(s) affichée(s)</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <SyncWebButton />

          <Link 
            href="/commandes/archive"
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

      {/* 📥 DEPOIR DE COMMANDE PDF - Placé bien en évidence au-dessus des filtres */}
      <div className="w-full">
        <ImportOrderModalWrapper />
      </div>

      {/* OUTILS DE TRAVAIL : BARRE DE RECHERCHE & FILTRES D'ORIGINE */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <form method="GET" action="/commandes" className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            name="q"
            defaultValue={searchQuery}
            placeholder="Rechercher par client, référence VOS, article..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 transition-all" 
          />
          {sourceFilter !== 'ALL' && <input type="hidden" name="source" value={sourceFilter} />}
        </form>

        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'ALL', label: 'Toutes les origines' },
            { id: 'VOSGIA', label: '🌐 Site Vosgia' },
            { id: 'SITE_NG', label: '✨ Commandes Nicole Germain' },
            { id: 'SUR_PLACE', label: '📝 Devis sur place' }
          ].map(tab => (
            <Link 
              key={tab.id}
              href={`/commandes?source=${tab.id}${searchQuery ? `&q=${searchQuery}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sourceFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* LISTE */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300">
          <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="text-2xl font-bold text-slate-600 mb-2">Aucune commande trouvée</h3>
          <p className="text-slate-500 mb-6">Modifiez vos termes de recherche ou la source sélectionnée.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
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