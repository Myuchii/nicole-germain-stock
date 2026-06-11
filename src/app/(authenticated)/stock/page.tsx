'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Download, AlertTriangle, Trash2, Scissors, Layers, Paperclip, Palette } from 'lucide-react'
import { deleteFabric, deleteAccessory, getFabrics, getAccessories, getAbsoluteStockValue } from '@/app/_actions/fabric-actions'
import { syncAllPrestashopFabrics } from '@/app/_actions/prestashop-actions'
import Link from 'next/link'
import LocationSwitch from '@/components/LocationSwitch'

// ==========================================
// 🆕 COMPOSANT : BOUTON D'ASPIRATION VOSGIA
// ==========================================
function SyncFabricsButton() {
  const [loading, setLoading] = useState(false)

  const handleSync = async () => {
    setLoading(true)
    try {
      const res = await syncAllPrestashopFabrics()
      if (res.success) {
        alert(res.message)
      } else {
        alert(`Erreur : ${res.error}`)
      }
    } catch (err) {
      alert("Erreur réseau lors de la synchronisation.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-3 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold rounded-2xl hover:bg-indigo-100 transition-all disabled:opacity-50 text-sm shadow-sm"
    >
      <Palette size={16} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Aspiration du catalogue...' : 'Aspirer les Tissus Vosgia'}
    </button>
  )
}

// ==========================================
// 🏢 PAGE PRINCIPALE : MAGASIN ATELIER
// ==========================================
export default function StockPage() {
  const [fabrics, setFabrics] = useState<any[]>([])
  const [accessories, setAccessories] = useState<any[]>([]) 
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [absoluteValue, setAbsoluteValue] = useState<number>(0)

  useEffect(() => {
    async function loadData() {
      const data = await getFabrics()
      setFabrics(data)

      const accData = await getAccessories()
      setAccessories(accData)
      
      const realValue = await getAbsoluteStockValue()
      setAbsoluteValue(realValue)
      
      setLoading(false)
    }
    loadData()
  }, [])

  const filterQuery = searchQuery.toLowerCase()
  
  const filteredFabrics = fabrics.filter(f => 
    !f.isArchived && (
      f.name.toLowerCase().includes(filterQuery) || 
      f.reference.toLowerCase().includes(filterQuery) ||
      f.color.toLowerCase().includes(filterQuery)
    )
  )

  const filteredAccessories = accessories.filter(a => 
    !a.isArchived && (
      a.name.toLowerCase().includes(filterQuery) || 
      a.reference.toLowerCase().includes(filterQuery)
    )
  )

  const totalMeters = fabrics.reduce((sum, f) => {
    if (f.lots && f.lots.length > 0) {
      return sum + f.lots.reduce((lotSum: number, lot: any) => lotSum + lot.quantityLeft, 0)
    }
    return f.unit === 'METER' ? sum + Number(f.stockMeters || 0) : sum
  }, 0)

  const totalAlerts = fabrics.filter(f => {
    const stock = f.lots ? f.lots.reduce((s: number, l: any) => s + l.quantityLeft, 0) : (f.unit === 'METER' ? Number(f.stockMeters || 0) : Number(f.stockUnits || 0))
    const threshold = f.unit === 'METER' ? Number(f.alertThresholdMeters || 0) : Number(f.alertThresholdUnits || 0)
    return stock <= threshold
  }).length

  const handleExportCSV = () => {
    const headers = [
      "Catégorie", "Référence", "Désignation", "Couleur/Détail", "Unité", "Date Entrée Lot", 
      "Quantité Restante", "Seuil d'Alerte", "Prix Achat Lot HT (€)", "Valeur Restante HT (€)"
    ]
    
    const rows: any[][] = []

    fabrics.forEach(f => {
      const isMeter = f.unit === 'METER'
      const alert = isMeter ? f.alertThresholdMeters : f.alertThresholdUnits
      const activeLots = f.lots?.filter((l: any) => l.quantityLeft > 0) || []

      if (activeLots.length === 0) {
        const stock = isMeter ? f.stockMeters : f.stockUnits
        const price = isMeter ? f.pricePerMeter : f.pricePerUnit
        rows.push(["TISSU", f.reference, f.name, f.color, f.unit, "-", stock, alert, price?.toFixed(2), (stock * price).toFixed(2)])
      } else {
        activeLots.forEach((lot: any) => {
          rows.push(["TISSU", f.reference, f.name, f.color, f.unit, new Date(lot.createdAt).toLocaleDateString('fr-FR'), lot.quantityLeft, alert, lot.purchasePriceHT?.toFixed(2), (lot.quantityLeft * lot.purchasePriceHT).toFixed(2)])
        })
      }
    })

    accessories.forEach(a => {
      const activeLots = a.lots?.filter((l: any) => l.quantityLeft > 0) || []
      if (activeLots.length === 0) {
         rows.push(["ACCESSOIRE", a.reference, a.name, "-", "UNITÉ", "-", 0, a.alertThreshold, "-", "0.00"])
      } else {
        activeLots.forEach((lot: any) => {
          rows.push(["ACCESSOIRE", a.reference, a.name, "-", "UNITÉ", new Date(lot.createdAt).toLocaleDateString('fr-FR'), lot.quantityLeft, a.alertThreshold, lot.purchasePriceHT?.toFixed(2), (lot.quantityLeft * lot.purchasePriceHT).toFixed(2)])
        })
      }
    })

    const escapeCSV = (value: any) => `"${(value?.toString() || "").replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(";")).join("\n")
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `Inventaire_Atelier_Lots_${new Date().toISOString().split('T')[0]}.csv`
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
          <h1 className="text-3xl font-serif font-bold text-slate-900">Stock Atelier</h1>
          <p className="text-slate-500">Gérez vos tissus et vos accessoires par lots d'achat.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all shadow-sm text-sm">
            <Download size={16} /> Export CSV
          </button>
          
          {/* 🎯 INTÉGRATION PARFAITE DU NOUVEAU BOUTON D'ASPIRATION */}
          <SyncFabricsButton />

          <Link href="/stock/add">
            <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg text-sm">
              <Plus size={18} /> Nouveau Référencement
            </button>
          </Link>
        </div>
      </div>

      {/* GRILLE DES KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Valeur du Stock (PMP / Lots)</p>
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

      {/* RECHERCHE UNIFIÉE */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un tissu, une couleur ou un accessoire..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-medium text-sm" 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* ========================================== */}
        {/* TABLEAU 1 : LES TISSUS */}
        {/* ========================================== */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2">
            <Scissors size={20} className="text-indigo-500" /> Tissus
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-bold text-slate-400 uppercase">Réf / Désignation</th>
                  <th className="px-5 py-4 font-bold text-slate-400 uppercase text-center">Stock Global</th>
                  <th className="px-5 py-4 font-bold text-slate-400 uppercase">Détail des Rouleaux (Lots)</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredFabrics.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Aucun tissu trouvé.</td></tr>
                ) : filteredFabrics.map((f) => {
                  const isMeter = f.unit === 'METER'
                  const threshold = isMeter ? Number(f.alertThresholdMeters) : Number(f.alertThresholdUnits)
                  const totalStock = f.lots ? f.lots.reduce((s: number, l: any) => s + l.quantityLeft, 0) : (isMeter ? Number(f.stockMeters) : Number(f.stockUnits))
                  const isAlert = totalStock <= threshold

                  return (
                    <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${isAlert ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="font-mono font-bold text-indigo-600">{f.reference}</p>
                        <p className="font-bold text-slate-900">{f.name}</p>
                        <p className="text-[10px] text-slate-500">{f.color} • Laize: {f.width || '?'}cm</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-black ${isAlert ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-800'}`}>
                          {totalStock.toFixed(1)} {isMeter ? 'm' : 'p'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-slate-500">
                        {(!f.lots || f.lots.filter((l: any) => l.quantityLeft > 0).length === 0) ? (
                          <span className={totalStock > 0 ? "text-slate-400" : "text-red-500 font-bold"}>
                            {totalStock > 0 ? "Ancien format (sans lot)" : "Rupture de stock"}
                          </span>
                        ) : (
                        <div className="flex flex-wrap gap-1">
                          {f.lots.filter((l: any) => l.quantityLeft > 0).map((lot: any) => (
                            <div key={lot.id} className="bg-white border border-slate-200 p-1.5 rounded-lg flex flex-col gap-0.5 cursor-pointer hover:border-indigo-400 shadow-sm transition-colors group">
                              <span className="text-slate-700 font-black group-hover:text-indigo-700">{lot.quantityLeft}m</span>
                              <span className="text-[9px] uppercase tracking-wider">
                                Achat: <strong className="text-emerald-600">{lot.purchasePriceHT?.toFixed(2)}€</strong>
                              </span>
                              <div className="mt-1">
                                <LocationSwitch 
                                  lotId={lot.id} 
                                  itemType="FABRIC" 
                                  currentLocation={lot.location} 
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={async () => {
                              if (confirm("Voulez-vous supprimer ce tissu ?")) {
                                const res = await deleteFabric(f.id)
                                if (res.success) window.location.reload()
                                else alert(res.error)
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================== */}
        {/* TABLEAU 2 : LES ACCESSOIRES */}
        {/* ========================================== */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2">
            <Paperclip size={20} className="text-amber-500" /> Accessoires & Mercerie
          </h2>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-4 font-bold text-slate-400 uppercase">Réf / Désignation</th>
                  <th className="px-5 py-4 font-bold text-slate-400 uppercase text-center">Stock Global</th>
                  <th className="px-5 py-4 font-bold text-slate-400 uppercase">Détail des Lots</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredAccessories.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400 italic">Aucun accessoire référencé. Préparez la base de données !</td></tr>
                ) : filteredAccessories.map((a) => {
                  const totalStock = a.lots ? a.lots.reduce((s: number, l: any) => s + l.quantityLeft, 0) : 0
                  const isAlert = totalStock <= (a.alertThreshold || 0)

                  return (
                    <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${isAlert ? 'bg-red-50/30' : ''}`}>
                      <td className="px-5 py-3">
                        <p className="font-mono font-bold text-amber-600">{a.reference}</p>
                        <p className="font-bold text-slate-900">{a.name}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full font-black ${isAlert ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-800'}`}>
                          {totalStock} pcs
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-slate-500">
                        {(!a.lots || a.lots.filter((l: any) => l.quantityLeft > 0).length === 0) ? (
                          <span className="text-red-500 font-bold">Rupture de stock</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {a.lots.filter((l: any) => l.quantityLeft > 0).map((lot: any) => (
                              <div key={lot.id} className="bg-white border border-slate-200 p-1.5 rounded-lg flex flex-col gap-0.5 cursor-pointer hover:border-amber-400 shadow-sm transition-colors group">
                                <span className="text-slate-700 font-black group-hover:text-amber-700">{lot.quantityLeft} pcs</span>
                                <span className="text-[9px] uppercase tracking-wider">
                                  Achat: <strong className="text-emerald-600">{lot.purchasePriceHT?.toFixed(2)}€</strong>
                                </span>
                                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                  <LocationSwitch 
                                    lotId={lot.id} 
                                    itemType="ACCESSORY" 
                                    currentLocation={lot.location} 
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={async () => {
                              if (confirm("Voulez-vous supprimer cet accessoire ?")) {
                                const res = await deleteAccessory(a.id)
                                if (res.success) window.location.reload()
                                else alert(res.error)
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}