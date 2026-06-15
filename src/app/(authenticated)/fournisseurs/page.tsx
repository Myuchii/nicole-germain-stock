'use client'
import { useState, useEffect } from 'react'
import { getSupplierCatalog, generateProcurementDocument, getProcurementDashboard } from '@/app/_actions/fournisseur-actions'
import { Truck, CheckSquare, Square, AlertTriangle, FileText, Search, Download } from 'lucide-react'
import * as XLSX from 'xlsx' // 🎯 Pense à faire un 'npm install xlsx' dans ton terminal

interface OrderItemState {
  id: string          // id du catalogue ou de la fiche tissu
  reference: string
  name: string
  color: string
  source: string      // "ALERTE ATELIER" ou le nom du Fournisseur
  quantityWanted: number
  pricePerMeter: number | string
  checked: boolean    // État de la ligne (sélectionnée ou retirée)
}

export default function ApprovisionnementPage() {
  const [activeTab, setActiveTab] = useState('')
  const [suppliers, setSuppliers] = useState<string[]>([])
  
  // 🎯 L'état unique qui centralise toutes les décisions de Jade
  const [itemsToOrder, setItemsToOrder] = useState<OrderItemState[]>([])
  
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [finalDoc, setFinalDoc] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      const catRes = await getSupplierCatalog()
      const dashboardRes = await getProcurementDashboard()
      
      setSuppliers(catRes.suppliers)
      if (catRes.suppliers.length > 0) setActiveTab(catRes.suppliers[0])

      // 1. On prépare les alertes automatiques (cochées par défaut, quantité initiale à 15m)
      const alertsMapped: OrderItemState[] = dashboardRes.alerts.fabrics.map((f: any) => ({
        id: f.id,
        reference: f.reference,
        name: f.name,
        color: f.color,
        source: 'ALERTE ATELIER',
        quantityWanted: 15, // Quantité de réassort par défaut pour Jade
        pricePerMeter: f.pricePerMeter || 'À croiser',
        checked: true // 🆕 Coché par défaut !
      }))

      // 2. On prépare les lignes du catalogue Excel (décochées par défaut, quantité à 1)
      const catalogMapped: OrderItemState[] = catRes.items.map((c: any) => ({
        id: c.id,
        reference: c.reference,
        name: c.designation || 'Article',
        color: c.color || 'Standard',
        source: c.supplierName,
        quantityWanted: 1,
        pricePerMeter: c.purchasePriceHT,
        checked: false
      }))

      // On fusionne tout dans notre état dynamique
      setItemsToOrder([...alertsMapped, ...catalogMapped])
      setLoading(false)
    }
    loadData()
  }, [])

  // Basculer la case à cocher d'une ligne
  const toggleRow = (id: string, source: string) => {
    setItemsToOrder(prev => prev.map(item => 
      (item.id === id && item.source === source) ? { ...item, checked: !item.checked } : item
    ))
  }

  // Modifier manuellement la quantité voulue par Jade (mètre ou unité)
  const handleQuantityChange = (id: string, source: string, val: number) => {
    setItemsToOrder(prev => prev.map(item => 
      (item.id === id && item.source === source) ? { ...item, quantityWanted: Math.max(0, val) } : item
    ))
  }

  // Lancement de la génération et de l'export Excel
  const handleGenerate = async () => {
    // On ne garde que ce que Jade a validé (coché) avec une quantité supérieure à 0
    const checkedLines = itemsToOrder.filter(i => i.checked && i.quantityWanted > 0)
    
    if (checkedLines.length === 0) {
      alert("Sélectionne au moins une ligne avec une quantité pour générer le réassort.")
      return
    }

    // Appel à ton action serveur sécurisée
    const doc = await generateProcurementDocument(checkedLines)
    setFinalDoc(doc)

    // 🎯 Déclenchement automatique du téléchargement de l'Excel
    exportToExcel(doc)
  }

  // Fonction magique d'export de fichier Excel .xlsx
  const exportToExcel = (procurementData: any) => {
    const worksheetData = procurementData.lines.map((l: any) => ({
      "Type / Fournisseur": l.source,
      "Référence Article": l.ref,
      "Désignation": l.name,
      "Coloris": l.color,
      "Quantité Commandée": l.quantityOrdered,
      "Prix Unitaire HT": l.unitPriceHT,
      "Total Ligne HT": l.totalHT,
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(worksheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, "Réassort Nicole Germain")
    XLSX.writeFile(workbook, `${procurementData.referenceOrder}.xlsx`)
  }

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de la centrale d'approvisionnement...</div>

  const activeAlerts = itemsToOrder.filter(i => i.source === 'ALERTE ATELIER')
  const checkedCount = itemsToOrder.filter(i => i.checked).length

  return (
    <div className="p-8 space-y-8 w-full max-w-[1440px] mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">📦 Centrale d'Approvisionnement</h1>
        <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Ajuste les alertes de l'atelier, complète avec le catalogue et sors l'Excel</p>
      </div>

      {/* 1. SECTION ALERTE ATELIER PILOTABLE */}
      <div className="bg-red-50/60 border border-red-100 rounded-3xl p-6 space-y-4">
        <h2 className="text-red-900 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle size={16} className="text-red-500 animate-pulse" /> 1. Gérer les Alertes Automatiques de l'Atelier ({activeAlerts.length})
        </h2>
        
        <div className="grid md:grid-cols-2 gap-3">
          {activeAlerts.map(f => (
            <div 
              key={f.id} 
              onClick={() => toggleRow(f.id, 'ALERTE ATELIER')}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 bg-white cursor-pointer ${f.checked ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                <button type="button" className="text-slate-400">
                  {f.checked ? <CheckSquare size={20} className="text-red-600" /> : <Square size={20} />}
                </button>
                <div>
                  <span className="font-mono text-xs font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded mr-2">{f.reference}</span>
                  <div className="text-xs font-bold text-slate-800 mt-1">{f.name} ({f.color})</div>
                </div>
              </div>

              {/* Input Métrage sur-mesure pour Jade */}
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <label className="text-[10px] font-bold text-slate-400">Quantité :</label>
                <input 
                  type="number" 
                  value={f.quantityWanted} 
                  onChange={(e) => handleQuantityChange(f.id, 'ALERTE ATELIER', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-slate-200 bg-slate-50 font-mono font-bold text-center rounded-xl text-xs text-slate-900 focus:outline-none"
                />
                <span className="text-[10px] font-bold text-slate-500">m</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. SECTION DICTIONNAIRE / CATALOGUE FOURNISSEUR */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2"><Truck size={20} className="text-indigo-500" /> 2. Ajouter des articles depuis le catalogue</h2>
            <p className="text-slate-400 text-xs">Coche des lignes supplémentaires et ajuste les volumes pour atteindre ton franco de port.</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input type="text" placeholder="Filtrer le catalogue..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none" />
          </div>
        </div>

        {/* Onglets Fournisseurs */}
        <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
          {suppliers.map(sup => (
            <button key={sup} onClick={() => setActiveTab(sup)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === sup ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
              {sup}
            </button>
          ))}
        </div>

        {/* Tableau Adaptatif avec Input Quantité */}
        <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                <th className="p-3 w-12 text-center">Choix</th>
                <th className="p-3">Référence</th>
                <th className="p-3">Désignation</th>
                <th className="p-3">Couleur</th>
                <th className="p-3 text-center w-32">Quantité Voulue</th>
                <th className="p-3 text-right pr-5">Prix Unitaire HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
              {itemsToOrder
                .filter(i => i.source === activeTab)
                .filter(i => !search || i.reference.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()) || i.color.toLowerCase().includes(search.toLowerCase()))
                .map(item => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-slate-50/80 cursor-pointer ${item.checked ? 'bg-indigo-50/40' : ''}`}
                    onClick={() => toggleRow(item.id, item.source)}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleRow(item.id, item.source)} className="text-slate-400 hover:text-indigo-600">
                        {item.checked ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-600">{item.reference}</td>
                    <td className="p-3 font-bold text-slate-900">{item.name}</td>
                    <td className="p-3 uppercase text-[10px]">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">{item.color}</span>
                    </td>
                    
                    {/* INPUT QUANTITE DIRECTEMENT DANS LE TABLEAU */}
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="number" 
                        value={item.quantityWanted} 
                        onChange={(e) => handleQuantityChange(item.id, item.source, parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center bg-white font-mono font-bold"
                      />
                    </td>
                    
                    <td className="p-3 text-right pr-5 font-mono font-bold text-slate-900">
                      {typeof item.pricePerMeter === 'number' ? `${item.pricePerMeter.toFixed(2)} €` : item.pricePerMeter}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* BARRE D'ACTION BAS DE PAGE */}
        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
          <p className="text-xs font-bold text-slate-500">{checkedCount} ligne(s) sélectionnée(s) au total</p>
          <button 
            onClick={handleGenerate} 
            className="px-6 py-3.5 bg-emerald-600 hover:bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
          >
            <FileText size={16} /> Générer & Télécharger l'Excel
          </button>
        </div>
      </div>

      {/* APERÇU DU DOCUMENT EN TEMPS REEL */}
      {finalDoc && (
        <div className="bg-slate-900 text-white p-6 rounded-[2.5rem] shadow-xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">{finalDoc.referenceOrder}</span>
              <h3 className="font-serif font-bold text-xl mt-1">Aperçu du Réassort Centralisé Exporté</h3>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-xs text-slate-400 font-bold">Le : {finalDoc.date}</p>
              <button onClick={() => exportToExcel(finalDoc)} className="p-2 bg-slate-800 hover:bg-indigo-600 rounded-xl transition-colors" title="Re-télécharger l'Excel">
                <Download size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2 text-xs font-medium max-h-60 overflow-y-auto pr-2">
            {finalDoc.lines.map((line: any, index: number) => (
              <div key={index} className={`flex justify-between items-center p-3 border rounded-xl ${line.source === 'ALERTE ATELIER' ? 'bg-red-950/30 border-red-900/40' : 'bg-slate-800/60 border-slate-800'}`}>
                <div>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded mr-2 ${line.source === 'ALERTE ATELIER' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'}`}>
                    {line.source}
                  </span>
                  <strong className="text-slate-200 font-mono">{line.ref}</strong> — {line.name} ({line.color})
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-slate-400">Quantité : <strong className="text-white font-mono">{line.quantityOrdered}</strong></span>
                  <span className="text-slate-400">U.B : {line.unitPriceHT}</span>
                  <span className="text-emerald-400 font-mono font-bold w-20 text-right">{line.totalHT}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}