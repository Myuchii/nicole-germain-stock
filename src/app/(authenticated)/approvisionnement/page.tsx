'use client'

import { useState, useEffect } from 'react'
import { getSupplierCatalog, generateProcurementDocument, getProcurementDashboard, updateSupplierCatalogItem } from '@/app/_actions/fournisseur-actions'
import { Truck, CheckSquare, Square, AlertTriangle, FileText, Search, Download, Trash2, Plus, X } from 'lucide-react'
import * as XLSX from 'xlsx'

interface OrderItemState {
  id: string          
  reference: string
  name: string
  color: string       
  ngColor: string     
  source: string      
  quantityWanted: number
  pricePerMeter: number
  checked: boolean    
}

export default function ApprovisionnementPage() {
  const [activeTab, setActiveTab] = useState('')
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [itemsToOrder, setItemsToOrder] = useState<OrderItemState[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [finalDoc, setFinalDoc] = useState<any>(null)
  
  const [isModalOpen, setIsModalOpen] = useState(false)

  async function reloadCatalog() {
    const catRes = await getSupplierCatalog()
    const dashboardRes = await getProcurementDashboard()
    
    setSuppliers(catRes.suppliers)
    if (catRes.suppliers.length > 0 && !activeTab) setActiveTab(catRes.suppliers[0])
    
    const alertsMapped: OrderItemState[] = dashboardRes.alerts.fabrics.map((f: any) => ({
      id: f.id,
      reference: f.reference,
      name: f.name,
      color: f.color || 'Standard',
      ngColor: f.ngColor || f.color || 'Standard',
      source: 'ALERTE ATELIER',
      quantityWanted: 15, 
      pricePerMeter: Number(f.pricePerMeter) || 0,
      checked: true 
    }))

    const catalogMapped: OrderItemState[] = catRes.items.map((c: any) => ({
      id: c.id,
      reference: c.reference,
      name: c.designation || 'Article',
      color: c.color || 'Standard',
      ngColor: c.ngColor || '', 
      source: c.supplierName,
      quantityWanted: 1,
      pricePerMeter: Number(c.purchasePriceHT) || 0,
      checked: false
    }))

    setItemsToOrder([...alertsMapped, ...catalogMapped])
  }

  useEffect(() => {
    reloadCatalog().then(() => setLoading(false))
  }, [])

  const toggleRow = (id: string, source: string) => {
    setItemsToOrder(prev => prev.map(item => 
      (item.id === id && item.source === source) ? { ...item, checked: !item.checked } : item
    ))
  }

  const handleQuantityChange = (id: string, source: string, val: number) => {
    setItemsToOrder(prev => prev.map(item => 
      (item.id === id && item.source === source) ? { ...item, quantityWanted: Math.max(0, val) } : item
    ))
  }

  const handleUpdateLine = async (id: string, currentSource: string, fields: { price?: number, color?: string, ngColor?: string }) => {
    if (currentSource === 'ALERTE ATELIER') return

    setItemsToOrder(prev => prev.map(item => 
      (item.id === id && item.source === currentSource) 
        ? { 
            ...item, 
            pricePerMeter: fields.price !== undefined ? fields.price : item.pricePerMeter,
            color: fields.color !== undefined ? fields.color : item.color,
            ngColor: fields.ngColor !== undefined ? fields.ngColor : item.ngColor
          } 
        : item
    ))
     
    await updateSupplierCatalogItem(id, {
      purchasePriceHT: fields.price,
      color: fields.color,
      ngColor: fields.ngColor
    })
  }

  const handleDeleteLine = async (id: string, currentSource: string) => {
    if (currentSource === 'ALERTE ATELIER') return
    if (!confirm("Voulez-vous vraiment retirer cette référence du catalogue grossiste ?")) return

    setItemsToOrder(prev => prev.filter(item => !(item.id === id && item.source === currentSource)))
  }

  const handleAddManualItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const supplierName = formData.get('supplierName') as string
    const reference = formData.get('reference') as string
    const designation = formData.get('designation') as string
    const color = formData.get('color') as string
    const ngColor = formData.get('ngColor') as string
    const price = parseFloat(formData.get('price') as string || '0')

    const newItem: OrderItemState = {
      id: Math.random().toString(), 
      reference,
      name: designation,
      color,
      ngColor,
      source: supplierName,
      quantityWanted: 1,
      pricePerMeter: price,
      checked: false
    }

    setItemsToOrder(prev => [...prev, newItem])
    if (!suppliers.includes(supplierName)) {
      setSuppliers(prev => [...prev, supplierName])
    }
    setActiveTab(supplierName)
    setIsModalOpen(false) 
  }

  const handleGenerate = async () => {
    const checkedLines = itemsToOrder.filter(i => i.checked && i.quantityWanted > 0)
    if (checkedLines.length === 0) {
      alert("Sélectionne au moins une ligne avec une quantité pour générer le réassort.")
      return
    }
    const doc = await generateProcurementDocument(checkedLines)
    setFinalDoc(doc)
    exportToExcel(doc)
  }

  const exportToExcel = (procurementData: any) => {
    const worksheetData = procurementData.lines.map((l: any) => ({
      "Type / Fournisseur": l.source,
      "Référence Article": l.ref,
      "Désignation": l.name,
      "Coloris Fournisseur": l.color,
      "Quantité Commandée": l.quantityOrdered,
      "Prix Unitaire HT": l.unitPriceHT,
      "Total Ligne HT": l.totalHT,
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(worksheetData)
    XtargetXLSX: XLSX.utils.book_append_sheet(workbook, worksheet, "Réassort Nicole Germain")
    XLSX.writeFile(workbook, `${procurementData.referenceOrder}.xlsx`)
  }

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de la centrale d'approvisionnement...</div>

  const activeAlerts = itemsToOrder.filter(i => i.source === 'ALERTE ATELIER')
  const checkedCount = itemsToOrder.filter(i => i.checked).length

  return (
    <div className="p-8 space-y-8 w-full max-w-[1600px] mx-auto relative">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">📦 Centrale d'Approvisionnement</h1>
        <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Gérez vos alertes d'atelier, mettez à jour la nomenclature de vos fournisseurs et générer vos fichiers de commande.</p>
      </div>

      {/* 1. SECTIONS ALERTES ATELIER */}
      <div className="bg-red-50/60 border border-red-100 rounded-3xl p-6 space-y-4">
        <h2 className="text-red-900 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle size={16} className="text-red-500 animate-pulse" /> 1. Gérer les Alertes Automatiques de l'Atelier ({activeAlerts.length})
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeAlerts.map(f => (
            <div 
              key={f.id} 
              onClick={() => toggleRow(f.id, 'ALERTE ATELIER')}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 bg-white cursor-pointer ${f.checked ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200 opacity-60'}`}
            >
              <div className="flex items-center gap-3">
                {f.checked ? <CheckSquare size={20} className="text-red-600" /> : <Square size={20} />}
                <div>
                  <span className="font-mono text-xs font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded mr-2">{f.reference}</span>
                  <div className="text-xs font-bold text-slate-800 mt-1">{f.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Couleur : {f.color}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                {/* 🎯 CORRECTIF 1 : Input des cartes d'alerte (Le fameux 15) */}
                <input 
                  type="number" 
                  value={f.quantityWanted} 
                  placeholder="15"
                  onChange={(e) => handleQuantityChange(f.id, 'ALERTE ATELIER', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 border border-slate-300 bg-white text-slate-900 font-mono font-black text-center rounded-xl text-xs outline-none focus:border-red-500 focus:ring-1 focus:ring-red-400 placeholder:text-slate-500 shadow-sm"
                />
                <span className="text-[10px] font-bold text-slate-500">m</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. CATALOGUES ET GRILLES TARIFAIRES */}
      <div className="w-full bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-lg font-serif font-bold text-slate-900 flex items-center gap-2"><Truck size={20} className="text-indigo-500" /> 2. Catalogues & Grilles Tarifaires des Grossistes</h2>
            <p className="text-slate-400 text-xs">Cochez vos articles pour l'Excel, ajustez les prix et le dictionnaire de couleurs de Jade en direct.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input type="text" placeholder="Filtrer les références..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none" />
            </div>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-600 transition-colors whitespace-nowrap"
            >
              <Plus size={14} /> Ajouter une référence
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
          {suppliers.map(sup => (
            <button key={sup} onClick={() => setActiveTab(sup)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === sup ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
              {sup}
            </button>
          ))}
        </div>

        <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase text-[10px]">
                <th className="p-3 w-12 text-center">Choix</th>
                <th className="p-3 w-28">Référence</th>
                <th className="p-3">Désignation</th>
                <th className="p-3 w-32">Couleur Grossiste</th>
                <th className="p-3 w-32 text-indigo-600 font-bold">Couleur NG</th>
                <th className="p-3 text-center w-28">Qté Voulue</th>
                <th className="p-3 text-right w-28">Prix m HT</th>
                <th className="p-3 text-center w-16">Retirer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
              {itemsToOrder
                .filter(i => i.source === activeTab)
                .filter(i => !search || i.reference.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()) || i.color.toLowerCase().includes(search.toLowerCase()) || i.ngColor.toLowerCase().includes(search.toLowerCase()))
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
                    <td className="p-3 font-mono font-bold text-slate-900">{item.reference}</td>
                    <td className="p-3 font-bold text-slate-800">{item.name}</td>
                    
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text" 
                        defaultValue={item.color} 
                        onBlur={(e) => handleUpdateLine(item.id, item.source, { color: e.target.value })}
                        className="bg-transparent hover:bg-white border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-1 w-full text-[11px] font-medium transition-all text-slate-900"
                      />
                    </td>

                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="text" 
                        defaultValue={item.ngColor} 
                        placeholder="Ex: Ivoire"
                        onBlur={(e) => handleUpdateLine(item.id, item.source, { ngColor: e.target.value })}
                        className="bg-transparent hover:bg-white border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-1 w-full text-[11px] font-bold text-indigo-600 transition-all placeholder:text-slate-400"
                      />
                    </td>
                    
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {/* 🎯 CORRECTIF 2 : Input numérique du Tableau Central */}
                      <input 
                        type="number" 
                        value={item.quantityWanted} 
                        placeholder="1"
                        onChange={(e) => handleQuantityChange(item.id, item.source, parseFloat(e.target.value) || 0)}
                        className="w-16 px-1.5 py-1.5 border border-slate-300 rounded-xl text-center bg-white text-slate-900 font-mono font-black outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-500 shadow-sm"
                      />
                    </td>
                    
                    <td className="p-2 text-right font-mono font-bold text-slate-900" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block w-20">
                        <input 
                          type="number" 
                          step="0.01"
                          defaultValue={item.pricePerMeter}
                          onBlur={(e) => handleUpdateLine(item.id, item.source, { price: parseFloat(e.target.value) || 0 })}
                          className="bg-transparent hover:bg-white border border-transparent hover:border-slate-200 focus:bg-white focus:border-indigo-500 rounded-lg p-1 w-full text-right font-mono font-bold pr-4 transition-all text-slate-900"
                        />
                        <span className="absolute right-1 top-1 text-slate-400">€</span>
                      </div>
                    </td>

                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleDeleteLine(item.id, item.source)}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
          <p className="text-xs font-bold text-slate-500">{checkedCount} ligne(s) sélectionnée(s)</p>
          <button onClick={handleGenerate} className="px-6 py-3.5 bg-emerald-600 hover:bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md">
            <FileText size={16} /> Générer & Télécharger l'Excel
          </button>
        </div>
      </div>

      {/* 4. MODAL POPUP DESIGN ÉPURÉ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 text-white w-full max-w-md rounded-[2.5rem] p-6 border border-slate-800 shadow-2xl relative space-y-6 scale-in-center">
            
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute right-6 top-6 p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors"
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="font-serif font-bold text-xl text-white">Ajouter une Référence</h3>
              <p className="text-slate-400 text-xs mt-1">Créez une ligne dans la grille tarifaire d'un fournisseur.</p>
            </div>

            <form onSubmit={handleAddManualItem} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Nom du Fournisseur</label>
                <input required type="text" name="supplierName" list="modal-suppliers" placeholder="Ex: CAMILLTEX" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none uppercase tracking-wide font-bold placeholder:text-slate-600" />
                <datalist id="modal-suppliers">
                  {suppliers.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Référence Article</label>
                <input required type="text" name="reference" placeholder="Ex: FIL-40-BLANC" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono focus:border-indigo-500 focus:outline-none placeholder:text-slate-600" />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Désignation / Nom</label>
                <input required type="text" name="designation" placeholder="Ex: Bobine de fil de lin" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none placeholder:text-slate-600" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Couleur Grossiste</label>
                  <input type="text" name="color" placeholder="Ex: Optical White" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 focus:outline-none placeholder:text-slate-600" />
                </div>
                <div className="space-y-1">
                  <label className="text-indigo-300 font-bold uppercase tracking-wider text-[10px]">Couleur NG (Jade)</label>
                  <input type="text" name="ngColor" placeholder="Ex: Blanc Pur" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-400 focus:outline-none font-bold placeholder:text-indigo-400/60" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Prix d'achat au mètre (€ HT)</label>
                <input required type="number" step="0.01" name="price" placeholder="0.00" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono focus:border-indigo-500 focus:outline-none placeholder:text-slate-600" />
              </div>

              <button type="submit" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 text-sm mt-2">
                <Plus size={16} /> Enregistrer dans la grille
              </button>
            </form>
          </div>
        </div>
      )}

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