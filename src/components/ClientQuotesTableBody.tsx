"use client"

import { useState, Fragment } from 'react'
import { ChevronDown, ChevronUp, Clock, Scissors, Shirt, Package, CheckCircle, XCircle, Truck, Ruler } from 'lucide-react'

// 🛠️ Traducteur de moyen de paiement amélioré et sécurisé
function getPaymentMethodBadge(method: any) {
  if (!method) return null;
  
  // Conversion en chaîne propre
  const m = String(method).toLowerCase().trim();
  
  if (m.includes('carte') || m.includes('cb') || m.includes('stripe') || m.includes('visa') || m.includes('mastercard')) {
    return <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md border border-blue-100 font-bold inline-flex items-center gap-1 mt-1">💳 CB</span>
  }
  if (m.includes('virement') || m.includes('bank') || m.includes('transfer')) {
    return <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md border border-indigo-100 font-bold inline-flex items-center gap-1 mt-1">🏦 Virement</span>
  }
  if (m.includes('cheque') || m.includes('chèque')) {
    return <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200 font-bold inline-flex items-center gap-1 mt-1">📝 Chèque</span>
  }
  if (m.includes('espece') || m.includes('espèces') || m.includes('cash')) {
    return <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100 font-bold inline-flex items-center gap-1 mt-1">💵 Espèces</span>
  }

  // 🔥 FALLBACK : Si la valeur est autre chose (ex: "AUTRE", "PENDING"), on l'affiche quand même pour débugger !
  return <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md border border-amber-200 font-bold font-mono inline-flex items-center mt-1">{String(method)}</span>
}

function getProductionStatusBadge(quote: any) {
  if (quote.status === 'DRAFT') return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg"><Clock size={14}/> Brouillon</span>
  if (quote.status === 'CANCELLED') return <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg"><XCircle size={14}/> Annulé</span>
  const items = quote.items || []
  if (items.length === 0) return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle size={14}/> Validé</span>
  const statuses = items.map((i: any) => i.statusProduction)
  if (statuses.includes('A_COUPER')) return <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg"><Scissors size={14}/> À Couper</span>
  if (statuses.includes('EN_COUTURE') || statuses.includes('COUTURE')) return <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg"><Ruler size={14}/> En Couture</span>
  if (statuses.includes('A_EXPEDIER') || statuses.includes('PRET')) return <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg"><Package size={14}/> À Expédier</span>
  if (statuses.every((s: string) => s === 'EXPEDIE' || s === 'LIVRE')) return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><Truck size={14}/> Expédié</span>
  return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle size={14}/> Validé</span>
}

function getItemStatusIcon(status: string) {
  switch (status) {
    case 'A_COUPER': return <Scissors size={12} className="text-blue-500" />
    case 'EN_COUTURE': return <Shirt size={12} className="text-amber-500" />
    case 'PRET': return <Package size={12} className="text-emerald-500" />
    default: return <Clock size={12} className="text-slate-400" />
  }
}

export default function ClientQuotesTableBody({ quotes }: { quotes: any[] }) {
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({})

  const toggleRow = (quoteId: string) => {
    setExpandedQuotes(prev => ({ ...prev, [quoteId]: !prev[quoteId] }))
  }

  return (
    <tbody className="divide-y divide-slate-100">
      {quotes.map((quote) => {
        const isExpanded = !!expandedQuotes[quote.id]
        
        const trueTotalMeters = quote.items && quote.items.length > 0
          ? quote.items.reduce((sum: number, item: any) => sum + (Number(item.quantityMeters) || 0), 0)
          : Number(quote.quantity)

        return (
          <Fragment key={quote.id}>
            <tr 
              onClick={() => toggleRow(quote.id)}
              className="hover:bg-slate-50/80 transition-colors cursor-pointer select-none"
            >
              <td className="p-4 text-sm font-medium text-slate-600">
                {new Date(quote.createdAt).toLocaleDateString('fr-FR')}
              </td>
              <td className="p-4 text-sm flex flex-col items-start justify-center">
                <span className="font-mono text-slate-500">{quote.reference}</span>
                {/* 🎯 APPEL SÉCURISÉ : On passe explicitement le champ configuré */}
                {getPaymentMethodBadge(quote.paymentMethod)}
              </td>
              <td className="p-4 text-sm font-medium text-slate-800">
                {quote.fabric?.name || "Multiple"}
                <span className="text-xs text-slate-400 block">{trueTotalMeters.toFixed(1)} m</span>
              </td>
              <td className="p-4 text-sm font-black text-slate-900 text-right">
                {Number(quote.totalPrice).toFixed(2)} €
              </td>
              <td className="p-4 flex justify-center items-center gap-3">
                {getProductionStatusBadge(quote)}
                <div className="text-slate-400">
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </td>
            </tr>

            {/* LIGNE DÉROULANTE */}
            {isExpanded && (
              <tr className="bg-slate-50/50">
                <td colSpan={5} className="p-4 border-t border-slate-100/70">
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Composition de la commande ({quote.items?.length || 0} articles)</h4>
                    
                    {(!quote.items || quote.items.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">Aucun article enregistré pour ce devis.</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {quote.items.map((item: any) => (
                          <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800">{item.customName || "Article Atelier"}</p>
                              <p className="text-[11px] text-slate-400 font-mono">Métrage : {Number(item.quantityMeters).toFixed(1)} m | Temps : {item.prodTimeMinutes} min</p>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm text-slate-600">
                              {getItemStatusIcon(item.statusProduction)}
                              <span>{item.statusProduction.replace('_', ' ')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </tbody>
  )
}