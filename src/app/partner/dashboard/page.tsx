import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { PlusCircle, FileText, ChevronRight, Clock, Scissors, Shirt, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getPartnerDashboardData() {
  // On récupère le partenaire unique
  const partner = await prisma.partner.findUnique({
    where: { email: 'contact@matelas-camping-car.com' },
    include: {
      quotes: {
        include: {
          items: true,
          client: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return partner
}

export default async function PartnerDashboardPage() {
  const partner = await getPartnerDashboardData()
  const quotes = partner?.quotes || []

  // Calcul des compteurs globaux pour ses statistiques
  const totalOrders = quotes.length
  const pendingCut = quotes.filter(q => q.items.some(i => i.statusProduction === 'A_COUPER')).length
  const inCouture = quotes.filter(q => q.items.some(i => i.statusProduction === 'EN_COUTURE') && !q.items.some(i => i.statusProduction === 'A_COUPER')).length
  const completed = quotes.filter(q => q.items.every(i => i.statusProduction === 'PRET')).length

  // Fonction utilitaire pour badge de statut global d'un Bon de Commande
  const getGlobalStatusBadge = (items: any[]) => {
    if (items.every(i => i.statusProduction === 'PRET')) {
      return <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-[11px] flex items-center gap-1 w-fit"><CheckCircle size={12}/> Prêt / Expédié</span>
    }
    if (items.some(i => i.statusProduction === 'EN_COUTURE')) {
      return <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-bold text-[11px] flex items-center gap-1 w-fit"><Shirt size={12}/> En confection</span>
    }
    return <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold text-[11px] flex items-center gap-1 w-fit"><Scissors size={12}/> À couper</span>
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Espace Sous-Traitance B2B</h1>
          <p className="text-sm text-slate-500">Suivi de production et commandes en temps réel — Matelas Camping-car.</p>
        </div>
        <Link 
          href="/partner/nouvelle-commande"
          className="py-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors flex items-center gap-2 shadow-md shadow-indigo-600/10"
        >
          <PlusCircle size={16} />
          Nouvelle commande d'usine
        </Link>
      </div>

      {/* STATS COUNTERS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Commandes</p>
          <p className="text-2xl font-mono font-black text-slate-800 mt-1">{totalOrders}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">En attente Coupe</p>
            <p className="text-2xl font-mono font-black text-blue-600 mt-1">{pendingCut}</p>
          </div>
          <Scissors size={24} className="text-blue-200 shrink-0" />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">En Couture</p>
            <p className="text-2xl font-mono font-black text-amber-500 mt-1">{inCouture}</p>
          </div>
          <Shirt size={24} className="text-amber-200 shrink-0" />
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Prêt / Terminé</p>
            <p className="text-2xl font-mono font-black text-emerald-600 mt-1">{completed}</p>
          </div>
          <CheckCircle size={24} className="text-emerald-200 shrink-0" />
        </div>
      </div>

      {/* TABLEAU DES COMMANDES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-2">
          <FileText size={18} className="text-slate-400" />
          <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">Historique & Avancement Atelier</h2>
        </div>

        {quotes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium text-xs">
            Aucun bon de commande enregistré pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Référence / Date</th>
                  <th className="p-4">Client Final</th>
                  <th className="p-4">Modèle & Matière</th>
                  <th className="p-4 text-center">Dimensions (cm)</th>
                  <th className="p-4">État Atelier</th>
                  <th className="p-4">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {quotes.map((quote) => {
                  const mainItem = quote.items[0]
                  
                  return (
                    <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 space-y-0.5">
                        <span className="font-mono font-bold text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded text-sm">{quote.reference}</span>
                        <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                          <Clock size={10}/> {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </td>
                      <td className="p-4 font-bold text-slate-700">
                        {quote.client?.name || 'Non spécifié'}
                        <p className="text-[10px] text-slate-400 font-normal">{quote.client?.phone || 'Pas de tél'}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800 leading-snug">{mainItem?.customName || 'Article'}</p>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-slate-600 bg-slate-50/40">
                        {mainItem?.coteA && mainItem?.coteB ? (
                          <span>A: {mainItem.coteA} × B: {mainItem.coteB} <span className="text-[10px] text-slate-400 font-normal">(B.{mainItem.bonnet})</span></span>
                        ) : (
                          <span className="text-slate-400 font-normal">Standard</span>
                        )}
                      </td>
                      <td className="p-4 align-middle">
                        {getGlobalStatusBadge(quote.items)}
                      </td>
                      <td className="p-4">
                        {mainItem?.blueprintUrl ? (
                          <a 
                            href={mainItem.blueprintUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5"
                          >
                            Plan.pdf <ChevronRight size={12}/>
                          </a>
                        ) : (
                          <span className="text-slate-400">Aucun</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}