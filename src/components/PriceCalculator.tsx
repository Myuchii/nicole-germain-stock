'use client'
import { useState } from 'react'
import { Fabric } from '@prisma/client'

interface Props {
  fabrics: Fabric[]  // ✅ Fixé
}

export default function PriceCalculator({ fabrics }: Props) {  // ✅ Fixé
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [prodTime, setProdTime] = useState(60)
  const [costPerMinute, setCostPerMinute] = useState(2.5)  // ✅ Fixé

  const calculatePV = (): number => {  // ✅ pv → calculatePV
    if (!selectedFabric || !quantity) return 0
    
    const mpCost = selectedFabric.unit === 'METER'
      ? Number(selectedFabric.pricePerMeter || 0) * quantity
      : Number(selectedFabric.pricePerUnit || 0) * quantity
    
    const laborCost = prodTime * costPerMinute
    const marge = (mpCost + laborCost) * 0.4
    return mpCost + laborCost + marge
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">🧮 Calculateur PV</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tissu</label>
          <select 
            onChange={(e) => {
              const fabric = fabrics.find(f => f.reference === e.target.value)  // ✅ fabrics
              setSelectedFabric(fabric || null)
            }}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sélectionner un tissu</option>
            {fabrics.map(fabric => (  // ✅ fabrics
              <option key={fabric.id} value={fabric.reference}>
                {fabric.name} ({fabric.color})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quantité</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            min="0"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Temps prod (min)</label>
            <input
              type="number"
              value={prodTime}
              onChange={(e) => setProdTime(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Coût/min (€)</label>
            <input
              type="number"
              step="0.1"
              value={costPerMinute}  // ✅ Fixé
              onChange={(e) => setCostPerMinute(Number(e.target.value))}  // ✅ Fixé
              className="w-full p-3 border border-gray-300 rounded-lg"
              min="0"
            />
          </div>
        </div>

        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
          <h3 className="text-xl font-bold text-gray-800 mb-4">💰 Prix de Vente</h3>
          <div className="text-4xl font-bold text-indigo-600 text-center">
            €{calculatePV().toFixed(2)}  {/* ✅ calculatePV() */}
          </div>
          <div className="text-sm text-gray-600 mt-2 text-center">
            Formule: (Temps × Coût/min) + MP + 40% marge
          </div>
        </div>

        <button className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl">
          💾 Enregistrer Devis
        </button>
      </div>
    </div>
  )
}