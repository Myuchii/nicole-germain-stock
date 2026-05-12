// components/StockTable.tsx
'use client'
import { Fabric } from '@prisma/client'

interface StockTableProps {
  fabrics: Fabric[]
}

export default function StockTable({ fabrics }: StockTableProps) {
  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-50 bg-slate-50/50">
        <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
          📊 État des Stocks
        </h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-slate-400 text-sm uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">Référence</th>
              <th className="px-6 py-4 font-semibold">Tissu</th>
              <th className="px-6 py-4 font-semibold">Quantité</th>
              <th className="px-6 py-4 font-semibold text-center">Alerte</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {fabrics.map((fabric) => {
              // Logique d'alerte selon l'unité
              const isLow = fabric.unit === 'METER' 
                ? Number(fabric.stockMeters) <= Number(fabric.alertThresholdMeters)
                : (fabric.stockUnits || 0) <= (fabric.alertThresholdUnits || 0);

              return (
                <tr key={fabric.id} className={`hover:bg-slate-50 transition-colors ${isLow ? 'bg-red-50/50' : ''}`}>
                  <td className="px-6 py-4 font-mono text-xs text-indigo-600">{fabric.reference}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{fabric.name}</div>
                    <div className="text-xs text-slate-500">{fabric.color}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">
                      {fabric.unit === 'METER' ? `${fabric.stockMeters}m` : `${fabric.stockUnits}u`}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {isLow ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ⚠️ Bas
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}