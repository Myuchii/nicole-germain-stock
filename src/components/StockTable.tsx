'use client'
import { Fabric } from '@prisma/client'

interface Props {
  fabrics: Fabric[]
}

export default function StockTable({ fabrics }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">📊 Inventaire Tissus</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
              <th className="px-6 py-4 text-left rounded-tl-lg">Réf</th>
              <th className="px-6 py-4 text-left">Tissu</th>
              <th className="px-6 py-4 text-left">Stock</th>
              <th className="px-6 py-4 text-left">Prix</th>
              <th className="px-6 py-4 text-left rounded-tr-lg">Alerte</th>
            </tr>
          </thead>
          <tbody>
            {fabrics.map((fabric) => {
              // ✅ Champs de VOTRE schema
              const isLowStock = Number(fabric.stockMeters || 0) < Number(fabric.alertThresholdMeters || 999) || 
                               (fabric.stockUnits || 0) < (fabric.alertThresholdUnits || 999)
              
              return (
                <tr key={fabric.id} className={`border-b hover:bg-gray-50 ${isLowStock ? 'bg-red-50 border-red-200' : ''}`}>
                  <td className="px-6 py-4 font-mono text-sm">{fabric.reference}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{fabric.name}</div>
                    <div className="text-sm text-gray-500">{fabric.color}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-indigo-600">
                      {Number(fabric.stockMeters || 0).toFixed(1)}m
                      {fabric.stockUnits ? ` ${fabric.stockUnits}u` : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono">
                    €{Number(fabric.pricePerMeter || 0).toFixed(2)}/m
                    {fabric.pricePerUnit ? ` €${Number(fabric.pricePerUnit).toFixed(2)}/u` : ''}
                  </td>
                  <td className="px-6 py-4">
                    {isLowStock ? (
                      <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full">
                        ⚠️ Réapprovisionner
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                        ✅ OK
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