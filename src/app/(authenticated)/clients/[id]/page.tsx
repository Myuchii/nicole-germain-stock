// app/(authenticated)/clients/[id]/page.tsx
import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin, Mail, Phone, FileText, CheckCircle, Clock, XCircle, Scissors, Package, Truck, Ruler, Layers, DollarSign, Globe } from 'lucide-react'

const prisma = new PrismaClient()

// 🛠️ Fonction utilitaire pour générer le bon badge selon l'état du devis/des articles
function getProductionStatusBadge(quote: any) {
  if (quote.status === 'DRAFT') {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg"><Clock size={14}/> Brouillon</span>
  }
  if (quote.status === 'CANCELLED') {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg"><XCircle size={14}/> Annulé</span>
  }

  const items = quote.items || []
  if (items.length === 0) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle size={14}/> Validé</span>
  }

  const statuses = items.map((i: any) => i.statusProduction)

  if (statuses.includes('A_COUPER')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg"><Scissors size={14}/> À Couper</span>
  }
  if (statuses.includes('EN_COUTURE') || statuses.includes('COUTURE') || statuses.includes('A_CONFECTIONNER')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg"><Ruler size={14}/> En Couture</span>
  }
  if (statuses.includes('A_EXPEDIER') || statuses.includes('PRET')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg"><Package size={14}/> À Expédier</span>
  }
  if (statuses.every((s: string) => s === 'EXPEDIE' || s === 'LIVRE')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><Truck size={14}/> Expédié</span>
  }

  return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle size={14}/> Validé</span>
}

// 🛠️ Badge d'origine du client
function getClientSourceBadge(source: string) {
  if (source === 'WEB_VOSGIA') {
    return <span className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-xl text-xs font-bold font-sans">🌐 Boutique PrestaShop</span>
  }
  return <span className="flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-bold font-sans">🧵 Direct Atelier</span>
}

// 🛠️ Badge de lettrage comptable de la commande
function getPaymentStatusBadge(status: string) {
  switch (status) {
    case 'PAYE':
      return <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-bold rounded-lg">✅ Payé</span>
    case 'ACOMPTE_VERSE':
      return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg">⏳ Acompte</span>
    default:
      return <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-bold rounded-lg">❌ Non Payé</span>
  }
}

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  
  const resolvedParams = await params
  const id = resolvedParams.id

  // 1. Récupération complète du client et des fiches ateliers (items)
  const client = await prisma.client.findUnique({
    where: { id: id },
    include: {
      quotes: {
        orderBy: { createdAt: 'desc' }, 
        include: { 
          fabric: true,
          items: true // 🎯 Inclus pour inspecter les pièces réelles et leur quantityMeters
        } 
      }
    }
  })

  if (!client) return notFound()

  // 2. Calcul des statistiques réelles du client
  const validatedQuotes = client.quotes.filter(q => q.status === 'VALIDATED')
  const totalSpent = validatedQuotes.reduce((sum, q) => sum + Number(q.totalPrice), 0)
  
  // Somme cumulée de TOUS les métrages réels rentrés par l'atelier sur ses pièces
  const totalMetersReal = validatedQuotes.reduce((sum, q) => {
    const quoteMeters = q.items?.reduce((itemSum, item) => itemSum + (item.quantityMeters || 0), 0) || 0
    return sum + quoteMeters
  }, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      
      {/* BOUTON RETOUR */}
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft size={16} /> Retour à l'annuaire
      </Link>

      {/* EN-TÊTE DU CLIENT */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 justify-between items-start">
        <div className="space-y-4 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-16 w-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-serif text-3xl font-black">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-serif font-bold text-slate-900">{client.name}</h1>
                {/* 🎯 Ajout de la provenance du client */}
                {getClientSourceBadge((client as any).source)}
              </div>
              {client.company && (
                <p className="flex items-center gap-1.5 text-slate-500 font-medium mt-1">
                  <Building2 size={16} /> {client.company}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {client.email && <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Mail size={14}/> {client.email}</span>}
            {client.phone && <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Phone size={14}/> {client.phone}</span>}
{(client.city || client.zipCode) && (
  <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
    <MapPin size={14}/> {client.address ? `${client.address}, ` : ''}{client.zipCode} {client.city} {client.country ? `(${client.country})` : ''}
  </span>
)}
          </div>
        </div>

        {/* BLOC STATISTIQUES FINANCIÈRES & TEXTILES */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl w-full md:w-auto min-w-[280px] shadow-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Chiffre d'affaires généré</p>
          <p className="text-4xl font-black text-emerald-400">{totalSpent.toFixed(2)} €</p>
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-sm">
            <span className="text-slate-300">Commandes : <strong className="text-white">{validatedQuotes.length}</strong></span>
            <span className="text-slate-300">Tissu coupé : <strong className="text-blue-400 font-mono">{totalMetersReal.toFixed(2)}m</strong></span>
          </div>
        </div>
      </div>

      {/* HISTORIQUE DÉTAILLÉ ET MÉTRAGE DES COMMANDES */}
      <div className="space-y-6">
        <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
          <FileText className="text-indigo-500" /> Historique et suivi des coupes
        </h2>

        {client.quotes.length === 0 ? (
          <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-medium">
            Aucun historique pour ce client pour le moment.
          </div>
        ) : (
          <div className="space-y-6">
            {client.quotes.map((quote) => {
              // Somme des mètres utilisés pour cette commande précise
              const quoteMetersConsumed = quote.items?.reduce((sum, item) => sum + (item.quantityMeters || 0), 0) || 0

              return (
                <div key={quote.id} className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm border-b-2">
                  
                  {/* EN-TÊTE DU BLOC COMMANDE */}
                  <div className="bg-slate-50/70 p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-800 text-base">{quote.reference}</span>
                        {getProductionStatusBadge(quote)}
                        {/* 🎯 Badge du lettrage comptable */}
                        {getPaymentStatusBadge((quote as any).paymentStatus)}
                      </div>
                      <p className="text-xs text-slate-400">
                        Enregistré le {quote.createdAt.toLocaleDateString('fr-FR')} — Tissu principal : {quote.fabric?.name || "Non spécifié"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900">{Number(quote.totalPrice).toFixed(2)} €</p>
                      {quoteMetersConsumed > 0 && (
                        <p className="text-xs text-indigo-600 font-bold font-mono">Total coupé : {quoteMetersConsumed.toFixed(2)} m</p>
                      )}
                    </div>
                  </div>

                  {/* TABLEAU DES PIÈCES DE L'ATELIER ASSOCIEES */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/30 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-100">
                          <th className="px-6 py-2.5 font-bold">Désignation de la pièce (Atelier)</th>
                          <th className="px-6 py-2.5 font-bold text-center">Étape Actuelle</th>
                          <th className="px-6 py-2.5 font-bold text-right">Métrage réel utilisé</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {quote.items && quote.items.length > 0 ? (
                          quote.items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-3.5 font-medium text-slate-700 max-w-md break-words">
                                {item.customName}
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 uppercase tracking-tight text-[10px]">
                                  {item.statusProduction.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-right font-mono">
                                {item.quantityMeters > 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                    {item.quantityMeters.toFixed(2)} m
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">Non coupé</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-6 py-4 text-center text-xs italic text-slate-400">
                              Aucune fiche de production générée pour ce devis.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}