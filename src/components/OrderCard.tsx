"use client"

import { useState } from 'react'
import { generateQuotePDF } from '@/lib/pdf-generator'
import { Printer, Trash2, Archive, CheckCircle, Wallet } from 'lucide-react'
// 🟢 Ajout de updateOrderPrice dans les imports
import { deleteQuote, archiveQuote, updateOrderPrice } from '@/app/_actions/quote-actions'
import { togglePaymentStatus } from '@/app/_actions/atelier-actions'

interface Order {
  id: string
  reference: string
  totalPrice: number
  quantity: number
  isTTC: boolean 
  validatedAt: Date | null
  isPaid: boolean 
  paymentMethod?: string | null
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
    blueprintUrl?: string | null // 🟢 AJOUT : Pour lire les plans joints
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
    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col h-full">
      
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
<div className="text-right ml-4 shrink-0">
          <p className="text-3xl font-black text-emerald-600">
            {order.totalPrice.toFixed(2)} <span className="text-lg font-normal">€</span>
          </p>
          <div className="flex flex-col items-end gap-1 mt-1">
            <p className="text-xs text-slate-500">{order.quantity.toFixed(1)}m</p>
            {/* 🟢 Le badge du moyen de paiement */}
            {order.paymentMethod && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase tracking-wider border border-slate-200 shadow-sm">
                💳 {order.paymentMethod}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* PRODUITS */}
      <div className="space-y-3 mb-6 flex-1">
        {order.items.map((item, index) => {
          // 🟢 1. Parsing sécurisé des fichiers joints
          let files: any = null
          if (item.blueprintUrl) {
            try { files = JSON.parse(item.blueprintUrl) } catch (e) {}
          }

          return (
            <div key={index} className="flex flex-col p-4 bg-slate-50 rounded-2xl group-hover:bg-indigo-50/60 transition-colors border border-slate-100">
              
              <div className="flex justify-between items-start">
                <div className="flex-1 pr-4">
                  <div className="font-bold text-slate-800 text-sm leading-snug">
                    {item.customName || item.fabric?.name || 'Article Libre'}
                  </div>
                  
                  <div className="text-[11px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md font-bold text-[10px]">
                      {item.fabric?.reference || 'SUR-MESURE'}
                    </span>
                    • {item.fabric?.name || 'Aucun tissu lié'}
                  </div>
                </div>
                
                <div className="text-right whitespace-nowrap">
                  {/* 🟢 2. Le mini-formulaire pour chiffrer les commandes CC */}
                  {order.reference.startsWith('CC-') ? (
                    <form action={async (formData) => {
                      const newPrice = parseFloat(formData.get('price') as string)
                      if (!isNaN(newPrice)) {
                        await updateOrderPrice(order.id, newPrice) 
                      }
                    }} className="flex items-center justify-end gap-1 mb-1">
                      <input 
                        type="number" 
                        name="price"
                        step="0.01"
                        defaultValue={item.sellingPrice || order.totalPrice || ''}
                        placeholder="0.00"
                        className="w-20 px-2 py-1 text-right text-sm font-black text-emerald-600 border border-emerald-200 bg-emerald-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                      />
                      <span className="text-emerald-600 font-black">€</span>
                      <button type="submit" className="hidden">Ok</button>
                    </form>
                  ) : (
                    <div className="font-black text-emerald-600 text-base">
                      {item.sellingPrice?.toFixed(2)}€
                    </div>
                  )}
                  
                  <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                    {item.quantityMeters?.toFixed(1)}m | {item.prodTimeMinutes}min
                  </div>
                </div>
              </div>

              {/* 🟢 3. Affichage des multiples Bons et du Schéma */}
              {files && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60 mt-2">
                  {files.docs && files.docs.length > 0 ? (
                    files.docs.map((url: string, i: number) => (
                      <a key={i} href={`/api/documents?url=${url}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-[10px] font-bold transition-colors">
                        📄 Bon {files.docs.length > 1 ? `#${i + 1}` : ''}
                      </a>
                    ))
                  ) : files.doc && (
                    <a href={`/api/documents?url=${files.doc}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-[10px] font-bold transition-colors">
                      📄 Voir le Bon
                    </a>
                  )}
                  
                  {files.schema && (
                    <a href={`/api/documents?url=${files.schema}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-[10px] font-bold transition-colors">
                      📐 Voir le Schéma
                    </a>
                  )}
                </div>
              )}

            </div>
          )
        })}
      </div>

      {/* ZONE PAIEMENT ET ACTIONS */}
      <div className="space-y-3 mt-auto">
        <form action={togglePaymentStatus}>
          <input type="hidden" name="quoteId" value={order.id} />
          <input type="hidden" name="isPaid" value={order.isPaid ? 'false' : 'true'} />
          
          <button 
            type="submit" 
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
              order.isPaid 
                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200' 
                : 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
            }`}
          >
            {order.isPaid ? (
              <>
                <CheckCircle size={16} />
                Payé & Transmis à l'atelier
              </>
            ) : (
              <>
                <Wallet size={16} />
                Valider le paiement
              </>
            )}
          </button>
        </form>

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button 
            onClick={handleDownloadPDF}
            className="flex-1 py-2.5 px-3 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-all text-xs"
          >
            <Printer size={14} />
            Imprimer
          </button>
          
          <button 
            onClick={handleDelete}
            className="px-3 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-bold rounded-xl flex items-center justify-center transition-all text-xs"
            title="Annuler la commande"
          >
            <Trash2 size={16} />
          </button>

          <button 
            onClick={handleArchive}
            disabled={isPending}
            title="Archiver la commande (Expédiée)"
            className="px-3 py-2.5 bg-slate-900 text-white hover:bg-slate-700 font-bold rounded-xl flex items-center justify-center transition-all shadow-md text-xs disabled:opacity-50"
          >
            <Archive size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}