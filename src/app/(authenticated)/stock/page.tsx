import { PrismaClient } from '@prisma/client'
import { Plus, Search, Filter } from 'lucide-react'
import Link from 'next/link'

const prisma = new PrismaClient()

export default async function StockPage() {
  const fabricsRaw = await prisma.fabric.findMany()
 const fabrics = fabricsRaw.map(f => ({
  ...f,
  stockMeters: f.stockMeters ? Number(f.stockMeters) : 0,
  pricePerMeter: Number(f.pricePerMeter),
  pricePerUnit: Number(f.pricePerUnit),
  alertThresholdMeters: f.alertThresholdMeters ? Number(f.alertThresholdMeters) : 0,
  // Ajoute ça pour être tranquille :
  createdAt: f.createdAt.toISOString(), 
  updatedAt: f.updatedAt.toISOString(),
}))
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Inventaire des Tissus</h1>
          <p className="text-slate-500">Gérez vos références et suivez vos métrages.</p>
        </div>
      <Link href="/stock/add">
        <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg">
          <Plus size={20} />
          Ajouter un tissu
        </button>
      </Link>
      </div>

      {/* Barre de recherche factice pour l'UI */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher une référence, une couleur..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <button className="px-4 py-3 bg-white border border-slate-100 rounded-2xl text-slate-600 hover:bg-slate-50">
          <Filter size={20} />
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Référence</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Nom</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Couleur</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Stock</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {fabrics.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-indigo-600">{f.reference}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{f.name}</td>
                <td className="px-6 py-4 text-slate-500">{f.color}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-700">
                  {f.unit === 'METER' ? `${f.stockMeters} m` : `${f.stockUnits} u`}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">En stock</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}