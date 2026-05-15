'use client'
import { useState } from 'react'
import { Fabric } from '@prisma/client'
import { createQuoteFromCalculator } from '@/app/_actions/quote-actions'

interface PriceCalculatorProps {
  fabrics: Fabric[]
}

export default function PriceCalculator({ fabrics }: PriceCalculatorProps) {
  const [selectedId, setSelectedId] = useState('')
  const [qty, setQty] = useState(1)
  const [time, setTime] = useState(60)
  const [rate, setRate] = useState(0.2) 
  const [marge, setMarge] = useState(40)

  // Trouver le tissu sélectionné
  const fabric = fabrics.find(f => f.id === selectedId)
  
  // Calculs (On force la conversion Number car Prisma envoie du Decimal/String)
  const price = fabric 
    ? (fabric.unit === 'METER' ? Number(fabric.pricePerMeter) : Number(fabric.pricePerUnit)) 
    : 0

  const mp = price * qty
  const labor = time * rate
  const totalHt = mp + labor
  const pv = totalHt * (1 + marge / 100)

  // LA FONCTION QUI MANQUAIT :
  const handleSave = async () => {
    if (!selectedId) return alert("Choisis un tissu d'abord ! 🧵")
    
    try {
      await createQuoteFromCalculator({
        fabricId: selectedId,
        quantity: qty,
        totalPrice: pv
      })
      alert("Devis enregistré avec succès ! ✨")
      // On peut réinitialiser si on veut
      setSelectedId('')
    } catch (error) {
      console.error(error)
      alert("Erreur lors de l'enregistrement...")
    }
  }

  return (
    <div className="bg-slate-900 text-white rounded-3xl shadow-2xl p-8 sticky top-8 border border-slate-800">
      <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
        🧮 Devis Express
      </h2>

      <div className="space-y-5">
        <div>
          <label className="text-xs text-slate-400 uppercase font-bold tracking-widest">Sélection Tissu</label>
          <select 
            value={selectedId}
            className="w-full mt-1 p-4 bg-slate-800 border-none rounded-2xl text-white focus:ring-2 focus:ring-indigo-400 transition-all"
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Choisir une référence...</option>
            {fabrics.map(f => (
              <option key={f.id} value={f.id}>{f.name} ({f.color})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 uppercase font-bold tracking-widest">
              Quantité ({fabric?.unit === 'METER' ? 'm' : 'u'})
            </label>
            <input 
              type="number" 
              value={qty} 
              onChange={(e) => setQty(Number(e.target.value))} 
              className="w-full mt-1 p-4 bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-400" 
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase font-bold tracking-widest">Temps (min)</label>
            <input 
              type="number" 
              value={time} 
              onChange={(e) => setTime(Number(e.target.value))} 
              className="w-full mt-1 p-4 bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-indigo-400" 
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 space-y-3">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Matières Premières</span>
            <span className="font-mono">{mp.toFixed(2)}€</span>
          </div>
          <div className="flex justify-between text-sm text-slate-400">
            <span>Main d'œuvre</span>
            <span className="font-mono">{labor.toFixed(2)}€</span>
          </div>
          
          <div className="bg-indigo-600 p-6 rounded-2xl text-center shadow-inner mt-4">
            <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-70 mb-1">Prix de Vente Conseillé</p>
            <p className="text-5xl font-black">{pv.toFixed(2)}€</p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/20"
        >
          Valider le devis
        </button>
      </div>
    </div>
  )
}