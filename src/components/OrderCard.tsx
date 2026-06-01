"use client"

import { generateQuotePDF } from '@/lib/pdf-generator'
import { Printer, Trash2 } from 'lucide-react'
import { deleteQuote } from '@/app/_actions/quote-actions'

interface Order {
  id: string
  reference: string
  totalPrice: number
  quantity: number
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
    customName?: string | null // 🆕 Ajouté pour TypeScript
    fabric: {
      id: string
      reference: string
      name: string
    } | null // 🆕 Le tissu peut être null sur un article manuel
    quantityMeters: number | null
    prodTimeMinutes: number
    sellingPrice: number | null
  }>
}

export function OrderCard({ order }: { order: Order }) {
  const handleDownloadPDF = async () => {
    // 1. On mappe les vrais produits de la commande avec détection du sur-mesure
    const products = order.items.map(item => {
      const isCustom = !item.fabric || !!item.customName

      return {
        family: isCustom ? 'CUSTOM' : 'FITTED', // 👈 La vraie magie opère ici !
        range: isCustom ? '-' : 'BASIQUE',
        customName: item.customName || undefined, // On passe le nom à pdf-generator
        fabric: {
          reference: item.fabric?.reference || '-',
          name: item.fabric?.name || item.customName || 'Article sur mesure',
          pricePerMeter: 0 
        },
        // Si c'est du sur-mesure on tue les dimensions, sinon fallback classique
        dims: isCustom ? { L: 0, l: 0 } : { L: 200, l: 160, bonnet: 30, diametre: 210 }, 
        mainFabricMeters: item.quantityMeters || 0,
        laborMinutes: item.prodTimeMinutes,
        totalPriceHT: item.sellingPrice || 0
      }
    })

    // 2. On construit l'objet pour le PDF
    const quoteData = {
      id: order.id,
      reference: order.reference,
      totalPrice: order.totalPrice,
      isTTC: false, 
      discountPercent: 0,
      products,
      client: {
        name: order.client?.name || "Client Inconnu",
        address: order.client?.address || undefined,
        zipCode: order.client?.zipCode || undefined,
        city: order.client?.city || undefined,
        company: order.client?.company || undefined
      }
    }

    // 3. Génération et téléchargement
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
    if (!confirm(`Voulez-vous vraiment annuler la commande ${order.reference} ?`)) {
      return
    }

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
          <div key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
            <div>
              <div className="font-semibold text-slate-800">
                {item.fabric?.reference || 'SUR-MESURE'}
              </div>
              <div className="text-sm text-slate-600">
                {item.fabric?.name || item.customName || 'Article Libre'}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-emerald-600">
                {item.sellingPrice?.toFixed(2)}€
              </div>
              <div className="text-xs text-slate-500">
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
          className="px-4 py-3 bg-red-500/90 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl text-sm"
        >
          <Trash2 size={16} />
          Annuler
        </button>
      </div>
    </div>
  )
}