'use client'
import { useState } from 'react'
import { Fabric } from '@prisma/client'

interface PriceCalculatorProps {
  fabrics: Fabric[]
}

export default function PriceCalculator({ fabrics }: PriceCalculatorProps) {
  const [selectedId, setSelectedId] = useState('')
  const [qty, setQty] = useState(1)
  const [time, setTime] = useState(60)
  const [rate, setRate] = useState(0.5) // Coût minute par défaut
  const [marge, setMarge] = useState(40) // 40% par défaut

  const fabric = fabrics.find(f => f.id === selectedId)
  
  // Calcul de la MP
  const mp = fabric 
    ? (fabric.unit === 'METER' ? Number(fabric.pricePerMeter) : Number(fabric.pricePerUnit)) * qty 
    : 0

  const labor = time * rate
  const totalHt = mp + labor
  const pv = totalHt * (1 + marge / 100)

  return (
    <div className="bg-slate-900 text-white rounded-3xl shadow-2xl p-8 sticky top-8">
      <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
        🧮 Devis Express
      </h2>

      <div className="space-y-5">
        <div>
          <label className="text-xs text-slate-400 uppercase font-bold">Sélection Tissu</label>
          <select 
            className="w-full mt-1 p-3 bg-slate-800 border-none rounded-xl text-white focus:ring-2 focus:ring-indigo-400"
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Choisir un tissu...</option>
            {fabrics.map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.color})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 uppercase font-bold">Quantité ({fabric?.unit === 'METER' ? 'm' : 'u'})</label>
            <input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full mt-1 p-3 bg-slate-800 border-none rounded-xl" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase font-bold">Temps (min)</label>
            <input type="number" value={time} onChange={(e) => setTime(Number(e.target.value))} className="w-full mt-1 p-3 bg-slate-800 border-none rounded-xl" />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Matière Première</span>
            <span>{mp.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400 mb-4">
            <span>Main d'œuvre</span>
            <span>{labor.toFixed(2)}€</span>
          </div>
          <div className="bg-indigo-600 p-4 rounded-2xl text-center">
            <p className="text-xs uppercase font-bold opacity-80">Prix de Vente Conseillé</p>
            <p className="text-4xl font-black">{pv.toFixed(2)}€</p>
          </div>
        </div>

        <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-slate-200 transition-transform active:scale-95">
          ✨ Valider la vente
        </button>
      </div>
    </div>
  )
}