"use client"

import { useState } from 'react'
import { generateQuotePDF } from '@/lib/pdf-generator'
import { Printer, Trash2, Archive } from 'lucide-react'
import { deleteQuote, archiveQuote } from '@/app/_actions/quote-actions'

interface Order {
  id: string
  reference: string
  totalPrice: number
  quantity: number
  isTTC: boolean 
  validatedAt: Date | null
  client?: {
    name: string
    address: string | null
    zipCode: string | null
    city: string | null
    company: string | null
  }
  items: Array<{
    id: string
    customName?: string | null 
    discountPercent: number 
    fabric: {
      id: string
      reference: string
      name: string
    } | null 
    quantityMeters: number | null
    prodTimeMinutes: number
    sellingPrice: number | null
    quantityUnits: number | null
  }>
}

export function OrderCard({ order }: { order: Order }) {
  const [isPending, setIsPending] = useState(false)

  const handleDownloadPDF = async () => {
    const products = order.items.map(item => {
      const isCustom = !item.fabric || !!item.customName
    
      return {
        family: isCustom ? 'CUSTOM' : 'FITTED', 
        range: isCustom ? '-' : 'BASIQUE',
        customName: item.customName || undefined, 
        fabric: {
          reference: item.fabric?.reference || '-',
          name: item.fabric?.name || item.customName || 'Article sur mesure',
          pricePerMeter: 0 
        },
        dims: isCustom ? { L: 0, l: 0 } : { L: 200, l: 160, bonnet: 30, diametre: 210 }, 
        mainFabricMeters: item.quantityMeters || 0,
        laborMinutes: item.prodTimeMinutes,
        totalPriceHT: item.sellingPrice || 0,

        // 🆕 AJOUTÉ : Chaque ligne de production d'atelier représente 1 pièce unitaire
        quantity: item.quantityUnits || 1
      }
    })

    const quoteData = {
      id: order.id,
      reference: order.reference,
      totalPrice: order.totalPrice,
      isTTC: order.isTTC, 
      discountPercent: order.items?.[0]?.discountPercent || 0, 
      products,
      client: {
        name: order.client?.name || "Client Inconnu",
        address: order.client?.address || undefined,
        zipCode: order.client?.zipCode || undefined,
        city: order.client?.city || undefined,
        company: order.client?.company || undefined
      }
    }

    const pdfBlob = await generateQuotePDF(quoteData)
    if (!pdfBlob) return

    const pdfUrl = URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = `Commande-${order.reference}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(pdfUrl)
  }

  const handleDelete = async () => {
    if (!confirm(`Voulez-vous vraiment annuler la commande ${order.reference} ?`)) return

    const isAlreadyCoutured = confirm(
      "🧵 Question Atelier :\n\n" +
      "Cet ouvrage a-t-il DÉJÀ été confectionné / cousu ?\n\n" +
      "👉 Cliquez sur [ OK ] pour l'envoyer directement dans le stock BOUTIQUE (Produits Finis).\n" +
      "👉 Cliquez sur [ Annuler ] si le tissu n'a pas encore été coupé (les mètres seront reversés dans le rouleau de stock)."
    )

    const res = await deleteQuote(order.id, isAlreadyCoutured)

    if (res.success) {
      alert(
        isAlreadyCoutured 
          ? "🎉 Commande supprimée de l'atelier et transformée en Produit Fini dans ta Boutique !" 
          : "✅ Commande annulée. Les métrages ont été remis sur le rouleau de tissu."
      )
      window.location.reload()
    } else {
      alert(res.error)
    }
  }

  const handleArchive = async () => {
    if (!confirm(`Marquer la commande ${order.reference} comme expédiée ?\n\nElle sera classée dans les archives.`)) return
    
    setIsPending(true)
    const res = await archiveQuote(order.id)
    setIsPending(false)

    if (res.success) {
      alert("📦 Commande expédiée et archivée avec succès !")
      window.location.reload()
    } else {
      alert(res.error)
    }
  }

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all group">
      {/* EN-TÊTE */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
            {order.reference}
          </h2>
          <p className="text-xs font-bold text-indigo-600 uppercase mt-0.5 tracking-wider">
            👤 {order.client?.name || "Client non spécifié"}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Validée le {order.validatedAt ? new Date(order.validatedAt).toLocaleDateString('fr-FR') : 'N/A'}
          </p>
        </div>
        <div className="text-right ml-4">
          <p className="text-3xl font-black text-emerald-600">
            {order.totalPrice.toFixed(2)} <span className="text-lg font-normal">€</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">{order.quantity.toFixed(1)}m</p>
        </div>
      </div>

      {/* PRODUITS */}
      <div className="space-y-3 mb-8">
        {order.items.map((item, index) => (
          <div key={index} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl group-hover:bg-indigo-50/60 transition-colors">
            <div className="flex-1 pr-4">
              {/* 🎯 FIX ICI : On affiche d'abord le nom complet calculé (Type — [REF] Nom + Spécificités) */}
              <div className="font-bold text-slate-800 text-sm leading-snug">
                {item.customName || item.fabric?.name || 'Article Libre'}
              </div>
              
              {/* 🆕 PETIT BADGE : Donne l'emplacement et le code du rouleau technique pour Nicole */}
              <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md font-bold text-[10px]">
                  {item.fabric?.reference || 'SUR-MESURE'}
                </span>
                • {item.fabric?.name || 'Aucun tissu lié'}
              </div>
            </div>
            
            <div className="text-right whitespace-nowrap">
              <div className="font-black text-emerald-600 text-base">
                {item.sellingPrice?.toFixed(2)}€
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                {item.quantityMeters?.toFixed(1)}m | {item.prodTimeMinutes}min
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="flex gap-3 pt-6 border-t border-slate-200">
        <button 
          onClick={handleDownloadPDF}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] transition-all shadow-lg text-sm"
        >
          <Printer size={16} />
          PDF
        </button>
        
        <button 
          onClick={handleDelete}
          className="px-4 py-3 bg-red-500/90 hover:bg-red-50 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl text-sm"
        >
          <Trash2 size={16} />
          Annuler
        </button>

        <button 
          onClick={handleArchive}
          disabled={isPending}
          title="Archiver la commande (Expédiée)"
          className="px-4 py-3 bg-slate-100 text-slate-500 hover:bg-slate-800 hover:text-white font-bold rounded-xl flex items-center justify-center transition-all shadow-md text-sm disabled:opacity-50"
        >
          <Archive size={16} />
        </button>
      </div>
    </div>
  )
}