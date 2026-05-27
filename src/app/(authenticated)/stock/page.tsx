'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, Download, AlertTriangle, Trash2, Scissors, Layers } from 'lucide-react'
import { deleteFabric, getFabrics, getAbsoluteStockValue } from '@/app/_actions/fabric-actions'
import Link from 'next/link'

export default function StockPage() {
  const [fabrics, setFabrics] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [absoluteValue, setAbsoluteValue] = useState<number>(0)

useEffect(() => {
  async function loadData() {
    const data = await getFabrics()
    setFabrics(data)
    
    // 🆕 Appel de la valorisation par lots
    const realValue = await getAbsoluteStockValue()
    setAbsoluteValue(realValue)
    
    setLoading(false)
  }
  loadData()
}, [])

  // 🔍 Filtrage instantané
  const filteredFabrics = fabrics.filter(f => 
    !f.isArchived && (
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.color.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  // ==========================================
  // 📈 CALCULS DES KPIs DU STOCK ATELIER (PMP)
  // ==========================================
  const totalValueHT = fabrics.reduce((sum, f) => {
    const isMeter = f.unit === 'METER'
    const stock = isMeter ? Number(f.stockMeters || 0) : Number(f.stockUnits || 0)
    const price = isMeter ? Number(f.pricePerMeter || 0) : Number(f.pricePerUnit || 0)
    return sum + (stock * price)
  }, 0)

  const totalMeters = fabrics.reduce((sum, f) => 
    f.unit === 'METER' ? sum + Number(f.stockMeters || 0) : sum, 0
  )

  const totalAlerts = fabrics.filter(f => {
    const isMeter = f.unit === 'METER'
    const stock = isMeter ? Number(f.stockMeters || 0) : Number(f.stockUnits || 0)
    const threshold = isMeter ? Number(f.alertThresholdMeters || 0) : Number(f.alertThresholdUnits || 0)
    return stock <= threshold
  }).length

  // 📊 Export CSV Tissus
  const handleExportCSV = () => {
    if (fabrics.length === 0) return

    const headers = ["Référence", "Désignation", "Couleur", "Unité", "Laize (cm)", "Stock Actuel", "Seuil d'Alerte", "Prix Achat Moyen HT", "Valeur Totale HT"]
    
    const rows = fabrics.map(f => {
      const isMeter = f.unit === 'METER'
      const stock = isMeter ? f.stockMeters : f.stockUnits
      const price = isMeter ? f.pricePerMeter : f.pricePerUnit
      const alert = isMeter ? f.alertThresholdMeters : f.alertThresholdUnits
      const value = (stock * price).toFixed(2)

      return [f.reference, f.name, f.color, f.unit, f.width || "Non spécifiée", stock, alert, price.toFixed(2), value]
    })

    const escapeCSV = (value: any) => `"${(value?.toString() || "").replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(";")).join("\n")
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Inventaire_Tissus_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de l'atelier...</div>

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Inventaire des Matières</h1>
          <p className="text-slate-500">Gérez vos rouleaux de tissus, laizes et alertes de métrage.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={18} /> Export CSV
          </button>
          <Link href="/stock/add">
            <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg">
              <Plus size={20} /> Nouveau Tissu
            </button>
          </Link>
        </div>
      </div>

      {/* 🆕 GRILLE DES STATISTIQUES GLOBAUX VALORISÉS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Valeur du Stock Matière (PMP)</p>
            <p className="text-2xl font-serif font-bold text-emerald-600 mt-1">{absoluteValue.toFixed(2)} €</p>
          </div>
          <Layers className="absolute -right-4 -bottom-4 text-emerald-50 opacity-40" size={80} />
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Volume Tissus Disponible</p>
            <p className="text-2xl font-serif font-bold text-slate-900 mt-1">{totalMeters.toFixed(1)} mètres</p>
          </div>
          <Scissors className="absolute -right-4 -bottom-4 text-slate-100 opacity-50" size={80} />
        </div>

        <div className={`p-5 rounded-3xl border shadow-sm flex justify-between items-center relative overflow-hidden ${totalAlerts > 0 ? 'bg-red-50 border-red-100 text-red-900' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Alertes Réappro</p>
            <p className="text-2xl font-serif font-bold mt-1">{totalAlerts} références</p>
          </div>
          {totalAlerts > 0 ? (
            <AlertTriangle className="text-red-500 animate-pulse relative z-10" size={28} />
          ) : (
            <AlertTriangle className="absolute -right-4 -bottom-4 text-slate-100 opacity-30" size={80} />
          )}
        </div>
      </div>

      {/* RECHERCHE */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une référence, une couleur, un nom..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-medium" 
          />
        </div>
      </div>

      {/* TABLEAU */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Réf & Laize</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Tissu & Couleur</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Stock Actuel</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-center">Statut</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredFabrics.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Aucun tissu trouvé.</td></tr>
            ) : filteredFabrics.map((f) => {
              const isMeter = f.unit === 'METER'
              const stock = isMeter ? Number(f.stockMeters) : Number(f.stockUnits)
              const threshold = isMeter ? Number(f.alertThresholdMeters) : Number(f.alertThresholdUnits)
              const isAlert = stock <= threshold

              return (
                <tr key={f.id} className={`hover:bg-slate-50/50 transition-colors ${isAlert ? 'bg-red-50/30' : ''}`}>
                  <td className="px-6 py-4">
                    <p className="font-mono text-xs font-bold text-indigo-600">{f.reference}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                      {f.width > 0 ? `Laize: ${f.width} cm` : "Laize: Non spécifiée"}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{f.name}</p>
                    <p className="text-xs text-slate-500">{f.color}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-black text-slate-800 text-lg">{stock}</span>
                    <span className="text-xs text-slate-500 ml-1">{isMeter ? 'm' : 'p'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {stock <= 0 ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 flex items-center justify-center gap-1 w-max mx-auto"><AlertTriangle size={12}/> Rupture</span>
                    ) : isAlert ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center justify-center gap-1 w-max mx-auto"><AlertTriangle size={12}/> Stock Faible</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 w-max mx-auto block">En stock</span>
                    )}
                  </td>
<td className="px-6 py-4 text-right">
                    <button 
                      onClick={async () => {
                        if (confirm("Voulez-vous supprimer ce tissu ?")) {
                          const res = await deleteFabric(f.id)
                          if (!res.success) {
                            alert(res.error)
                          } else {
                            // On affiche le message personnalisé (archivé ou supprimé)
                            alert(`✅ ${res.message || "Opération réussie !"}`)
                            window.location.reload()
                          }
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
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