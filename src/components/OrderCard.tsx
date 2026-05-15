"use client"

import { generateQuotePDF } from '@/lib/pdf-generator'
import { Printer, Trash2 } from 'lucide-react'
import { deleteQuote } from '@/app/_actions/quote-actions'

interface Order {
  id: string
  reference: string
  totalPrice: number
  quantity: number
  validatedAt: Date | null  // ← CORRIGÉ
  items: Array<{
    id: string
    fabric: {
      id: string
      reference: string
      name: string
    }
    quantityMeters: number | null
    prodTimeMinutes: number
    sellingPrice: number | null
  }>
}

export function OrderCard({ order }: { order: Order }) {
  const handleDownloadPDF = async () => {
    const products = order.items.map(item => ({
      family: 'FITTED',
      range: 'BASIQUE',
      fabric: {
        reference: item.fabric.reference,
        name: item.fabric.name,
        pricePerMeter: 25
      },
      dims: { L: 200, l: 160, bonnet: 30, diametre: 210 },
      mainFabricMeters: item.quantityMeters || 0,
      laborMinutes: item.prodTimeMinutes,
      totalPriceHT: item.sellingPrice || 0
    }))

    const quoteData = {
      id: order.id,
      reference: order.reference,
      totalPrice: order.totalPrice,
      products
    }

    const pdfBlob = await generateQuotePDF(quoteData)
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
    if (confirm(`Annuler la commande ${order.reference} ?`)) {
      await deleteQuote(order.id)
      window.location.reload()
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
          <p className="text-sm text-slate-500 mt-1">
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
              <div className="font-semibold text-slate-800">{item.fabric.reference}</div>
              <div className="text-sm text-slate-600">{item.fabric.name}</div>
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

      {/* ACTIONS - MAINTENANT DANS CLIENT COMPONENT */}
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