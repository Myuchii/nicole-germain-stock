import React from 'react'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { PlusCircle, FileText, ChevronRight, Clock, Scissors, Shirt, CheckCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function getPartnerDashboardData() {
  // 🟢 On tape directement dans la table CLIENT au lieu de PARTNER
  const clientData = await prisma.client.findFirst({
    where: { 
      // Tu peux utiliser le nom ou l'email, ici on utilise l'email qu'on a défini dans l'action
      email: 'campingcar-b2b@nicolegermain.fr' 
    },
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

  return clientData
}

export default async function PartnerDashboardPage() {
  const partner = await getPartnerDashboardData()
  const quotes = partner?.quotes || []

  const totalOrders = quotes.length
  const pendingCut = quotes.filter(q => q.items.some(i => i.statusProduction === 'A_COUPER')).length
  const inCouture = quotes.filter(q => q.items.some(i => i.statusProduction === 'EN_COUTURE') && !q.items.some(i => i.statusProduction === 'A_COUPER')).length
  const completed = quotes.filter(q => q.items.every(i => i.statusProduction === 'PRET')).length

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
                  <th className="p-4 text-center">Plan(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {quotes.map((quote) => (
                  <React.Fragment key={quote.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-4 align-top border-r border-slate-100">
                        <div className="space-y-1">
                          <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md text-sm block w-max">{quote.reference}</span>
                          <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Clock size={10}/> {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                          <div className="pt-2">
                            {getGlobalStatusBadge(quote.items)}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-700 align-top border-r border-slate-100">
                        {quote.client?.name || 'Non spécifié'}
                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">{quote.client?.phone || 'Pas de téléphone'}</p>
                      </td>
                      <td colSpan={3} className="p-0 align-top">
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-slate-100">
                            {quote.items.map((item: any, idx: number) => (
                              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                                <td className="p-3 w-2/5">
                                  <p className="font-bold text-slate-800 leading-snug">{item.customName || 'Article sur-mesure'}</p>
                                </td>
                                <td className="p-3 w-2/5 text-center font-mono font-bold text-slate-600 border-l border-slate-100/50">
                                  {item.coteA && item.coteB ? (
                                    <span>A:{item.coteA} × B:{item.coteB} <span className="text-[10px] text-slate-400 font-normal"><br/>(Bonnet {item.bonnet})</span></span>
                                  ) : (
                                    <span className="text-slate-400 font-normal">Standard</span>
                                  )}
                                </td>
                                <td className="p-3 w-1/5 text-right border-l border-slate-100/50">
                                  {item.statusProduction === 'PRET' && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px] whitespace-nowrap"><CheckCircle size={12}/> Prêt</span>}
                                  {item.statusProduction === 'EN_COUTURE' && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px] whitespace-nowrap"><Shirt size={12}/> En Couture</span>}
                                  {item.statusProduction === 'A_COUPER' && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-[10px] whitespace-nowrap"><Scissors size={12}/> À couper</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                      <td className="p-4 align-top text-center border-l border-slate-100 bg-slate-50/30">
                        {quote.items[0]?.blueprintUrl ? (() => {
                          try {
                            const files = JSON.parse(quote.items[0].blueprintUrl)
                            if (files.doc || files.schema) {
                              return (
<div className="flex flex-col gap-1.5 items-center w-full">
                                  {/* 🟢 Boucle sur les multiples bons Word/PDF */}
                                  {files.docs && files.docs.length > 0 ? (
                                    files.docs.map((url: string, index: number) => (
                                      <a key={index} href={`/api/documents?url=${url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-200/50 transition-colors w-full justify-center whitespace-nowrap shadow-sm">
                                        📄 Bon {files.docs.length > 1 ? `#${index + 1}` : ''}
                                      </a>
                                    ))
                                  ) : (
                                    /* 🟢 Fallback pour les commandes historiques avec un seul "doc" */
                                    files.doc && (
                                      <a href={`/api/documents?url=${files.doc}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-200/50 transition-colors w-full justify-center whitespace-nowrap shadow-sm">
                                        📄 Le Bon
                                      </a>
                                    )
                                  )}
                                  
                                  {/* 🟢 Le Schéma (unique) */}
                                  {files.schema && (
                                    <a href={`/api/documents?url=${files.schema}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-200/50 transition-colors w-full justify-center whitespace-nowrap shadow-sm">
                                      📐 Schéma
                                    </a>
                                  )}
                                </div>
                              )
                            }
                          } catch (e) {
                            return (
                              <a href={`/api/documents?url=${quote.items[0].blueprintUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex flex-col items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 p-2 rounded-lg transition-colors"><FileText size={16}/> Plan</a>
                            )
                          }
                        })() : (
                          <span className="text-slate-400 text-[10px] italic">Aucun</span>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}