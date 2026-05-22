'use client'
import { useState, useEffect } from 'react'
import { getInventoryData, createFinishedProduct, createMerchandise } from '@/app/_actions/stock-actions'
import { recordSale, getSalesJournal } from '@/app/_actions/sales-actions'
import { Download, AlertTriangle, ShoppingCart, Package, ShoppingBag, Plus } from 'lucide-react'

export default function StockBoutiquePage() {
  const [inventory, setInventory] = useState<any>(null)
  const [journal, setJournal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saleType, setSaleType] = useState<'PRODUIT_FINI' | 'MARCHANDISE'>('PRODUIT_FINI')
  const [addType, setAddType] = useState<'PF' | 'MA'>('PF')

  useEffect(() => {
    async function loadData() {
      try {
        const invRes = await getInventoryData()
        const journalPF = await getSalesJournal('PRODUIT_FINI')
        const journalMA = await getSalesJournal('MARCHANDISE')
        
        const mergedJournal = [...(journalPF || []), ...(journalMA || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        setInventory(invRes)
        setJournal(mergedJournal)
      } catch (error) {
        console.error("Erreur lors du chargement de la boutique:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de l'espace boutique...</div>

  const handleExportGlobalCSV = () => {
    if (!inventory) return
    const headers = ["Type", "Référence", "Désignation", "Stock", "Prix Vente HT (€)", "Valeur HT (€)"]
    
    const pfRows = inventory.finished.items.map((p: any) => {
      // 💡 On calcule le stock via les lots pour l'export aussi
      const totalStock = p.lots?.reduce((sum: number, l: any) => sum + l.quantityLeft, 0) || 0
      return ["PRODUIT FINI", p.reference, p.name, totalStock, p.sellingPriceHT, (totalStock * p.sellingPriceHT).toFixed(2)]
    })
    const maRows = inventory.merchandise.items.map((m: any) => {
      const totalStock = m.lots?.reduce((sum: number, l: any) => sum + l.quantityLeft, 0) || 0
      const totalValue = m.lots?.reduce((sum: number, l: any) => sum + (l.quantityLeft * l.purchasePriceHT), 0) || 0
      return ["MARCHANDISE", m.reference, m.name, totalStock, m.sellingPriceHT, totalValue.toFixed(2)]
    })

    const csvContent = [headers, ...pfRows, ...maRows].map(e => e.join(";")).join("\n")
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Export_Boutique_Global_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // CALCULS KPIs GLOBALS ADAPTÉS AUX LOTS QUANTIFIÉS
  const totalPFQuantity = inventory?.finished?.items?.reduce((sum: number, p: any) => sum + p.stockQuantity, 0) || 0
  const totalMAQuantity = inventory?.merchandise?.items?.reduce((sum: number, m: any) => sum + (m.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0), 0) || 0

  const totalMAValuePurchase = inventory?.merchandise?.items?.reduce((sum: number, m: any) => 
    sum + (m.lots?.reduce((s: number, l: any) => s + (l.quantityLeft * l.purchasePriceHT), 0) || 0), 0) || 0
  
  const totalAlerts = (inventory?.finished?.alertCount || 0) + (inventory?.merchandise?.items?.filter((m: any) => {
    const stock = m.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0
    return stock <= m.alertThreshold
  }).length || 0)

  return (
    <div className="p-8 space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">🏪 Espace Boutique & Ventes Directes</h1>
          <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Gestion centralisée des stocks finis et du négoce par lots comptables</p>
        </div>
        <button 
          onClick={handleExportGlobalCSV}
          className="px-5 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-600 transition-all text-sm shadow-sm"
        >
          <Download size={16} /> Export Global CSV
        </button>
      </div>

      {/* KPI COMPACTS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Valeur absolue d'achat stock négoce</p>
          <p className="text-2xl font-serif font-bold text-slate-900 mt-1">{totalMAValuePurchase.toFixed(2)} €</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Articles Disponibles</p>
          <p className="text-2xl font-serif font-bold text-slate-900 mt-1">
            {totalPFQuantity + totalMAQuantity} pièces
          </p>
        </div>
        <div className={`p-5 rounded-3xl border shadow-sm flex justify-between items-center ${totalAlerts > 0 ? 'bg-red-50 border-red-100 text-red-900' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Seuils Critiques</p>
            <p className="text-2xl font-serif font-bold mt-1">{totalAlerts} alertes</p>
          </div>
          {totalAlerts > 0 && <AlertTriangle className="text-red-500 animate-pulse" size={24} />}
        </div>
      </div>

      {/* ZONE DES STOCKS (2 TABLEAUX) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
{/* TABLEAU ② : PRODUITS FINIS (AVEC LOTS) */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2">
            <Package size={20} className="text-indigo-500" /> ② Stock Produits Finis (Confection)
          </h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="p-3 pl-5">Réf</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-center">Stock Tot.</th>
                  <th className="p-3">Lots Actifs (FIFO)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {inventory?.finished?.items?.map((p: any) => {
                  const totalStock = p.lots?.reduce((sum: number, lot: any) => sum + lot.quantityLeft, 0) || 0
                  return (
                    <tr key={p.id} className={totalStock <= p.alertThreshold ? "bg-red-50/40" : ""}>
                      <td className="p-3 pl-5 font-mono text-indigo-600 font-bold">{p.reference}</td>
                      <td className="p-3 font-bold text-slate-900">{p.name} <span className="text-[10px] text-slate-400 block font-normal">{p.dimensions}</span></td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${totalStock <= p.alertThreshold ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                          {totalStock}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {p.lots?.filter((l: any) => l.quantityLeft > 0).length === 0 ? (
                          <span className="text-red-500 font-bold">Rupture de stock</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.lots?.filter((l: any) => l.quantityLeft > 0).map((lot: any) => (
                              <div key={lot.id} className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex flex-col gap-0.5">
                                <span className="text-slate-700 font-black">{lot.quantityLeft} pcs</span>
                                <span className="text-[9px] uppercase tracking-wider">
                                  Vente: <strong className="text-indigo-600">{lot.sellingPriceHT?.toFixed(2)}€</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

{/* TABLEAU ③ : MARCHANDISES AVEC HISTORIQUE PAR LOTS */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2">
            <ShoppingBag size={20} className="text-emerald-500" /> ③ Stock Marchandises (Lots Achat / Revente)
          </h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="p-3 pl-5">Réf</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-center">Stock Tot.</th>
                  <th className="p-3">Détail des Lots Actifs (FIFO)</th>
                  <th className="p-3 text-right pr-5">Dernier Prix Réf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {inventory?.merchandise?.items?.map((m: any) => {
                  const totalStock = m.lots?.reduce((sum: number, lot: any) => sum + lot.quantityLeft, 0) || 0
                  return (
                    <tr key={m.id} className={totalStock <= m.alertThreshold ? "bg-red-50/40" : ""}>
                      <td className="p-3 pl-5 font-mono text-emerald-600 font-bold">{m.reference}</td>
                      <td className="p-3 font-bold text-slate-900">{m.name} <span className="text-[10px] text-slate-400 block font-normal">{m.category}</span></td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${totalStock <= m.alertThreshold ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                          {totalStock}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {m.lots?.filter((l: any) => l.quantityLeft > 0).length === 0 ? (
                          <span className="text-red-500 font-bold">Rupture de stock</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {m.lots?.filter((l: any) => l.quantityLeft > 0).map((lot: any) => (
                              <div key={lot.id} className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex flex-col gap-0.5">
                                <span className="text-slate-700 font-black">{lot.quantityLeft} pcs</span>
                                <span className="text-[9px] uppercase tracking-wider">
                                  Achat: <strong className="text-emerald-600">{lot.purchasePriceHT?.toFixed(2)}€</strong> | 
                                  Vente: <strong className="text-indigo-600">{lot.sellingPriceHT?.toFixed(2)}€</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right pr-5 font-bold text-slate-400">{m.sellingPriceHT.toFixed(2)} €</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FORMULAIRES ET HISTORIQUE EN BAS DE PAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        
        {/* BLOC 1 : CAISSE ENREGRESTRUISE */}
        <div className="bg-slate-950 p-6 rounded-[2.5rem] text-white space-y-4 shadow-xl self-start">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <ShoppingCart size={18} /> Caisse enregistreuse
          </div>
          <h3 className="font-serif font-bold text-xl">Saisie Vente Directe</h3>
          
          <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl gap-1">
            <button 
              onClick={() => setSaleType('PRODUIT_FINI')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'PRODUIT_FINI' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Confection
            </button>
            <button 
              onClick={() => setSaleType('MARCHANDISE')}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'MARCHANDISE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Marchandise
            </button>
          </div>

          <form action={async (formData) => {
            formData.append('type', saleType)
            const res = await recordSale(formData)
            if(!res.success) alert(res.error)
            else window.location.reload()
          }} className="space-y-4 text-slate-800 text-sm">
            
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-1">Sélectionner l'article</label>
              <select name="reference" className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-xs" required>
                <option value="">-- Choisir dans le stock dispo --</option>
                {inventory && (saleType === 'PRODUIT_FINI' ? inventory.finished.items : inventory.merchandise.items)?.map((item: any) => {
                  // 💡 CORRECTION : On additionne les lots restants, peu importe si c'est Confection ou Marchandise !
                  const stock = item.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0
                  
                  return (
                    <option key={item.id} value={item.reference} disabled={stock <= 0}>
                      [{item.reference}] - {item.name} ({stock} dispo)
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-xs font-bold mb-1">Quantité</label>
                <input type="number" name="quantity" min="1" defaultValue="1" className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold" required />
              </div>
              <div>
                <label className="block text-slate-400 text-xs font-bold mb-1">Règlement</label>
                <select name="paymentMethod" className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold">
                  <option value="CB">💳 Carte</option>
                  <option value="ESPECES">💵 Espèces</option>
                  <option value="CHEQUE">📝 Chèque</option>
                  <option value="VIREMENT">🏦 Virement</option>
                </select>
              </div>
            </div>

            <button type="submit" className={`w-full py-4 text-white font-black rounded-xl transition-all shadow-md mt-2 ${saleType === 'PRODUIT_FINI' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
              Valider l'encaissement
            </button>
          </form>
        </div>

        {/* BLOC 2 : RÉCEPTION DE STOCK / ENTRÉE DE MARCHANDISES PAR LOT */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-4 shadow-xl self-start">
          <h3 className="font-serif font-bold text-xl text-slate-900">Réception de Stock</h3>
          
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl gap-1">
            <button onClick={() => setAddType('PF')} className={`py-2 text-xs font-bold rounded-lg transition-all ${addType === 'PF' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
              Nouvelle Confection
            </button>
            <button onClick={() => setAddType('MA')} className={`py-2 text-xs font-bold rounded-lg transition-all ${addType === 'MA' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>
              Nouvelle Marchandise
            </button>
          </div>

<form action={async (formData) => {
  const res = addType === 'PF' ? await createFinishedProduct(formData) : await createMerchandise(formData)
  if (!res.success) alert(res.error)
  else { alert("Article / Lot ajouté au catalogue !"); window.location.reload(); }
}} className="space-y-3 text-slate-700 text-xs font-bold">
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">Référence Unique</label>
                <input type="text" name="reference" placeholder={addType === 'PF' ? "ex: PF-DRAP-MONACO" : "ex: MA-OREILLER-01"} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Désignation / Nom</label>
                <input type="text" name="name" placeholder="ex: Oreiller Ergonomique" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none" required />
              </div>
            </div>

            {addType === 'PF' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Famille</label>
                  <select name="family" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900">
                    <option value="FITTED">Drap Housse</option>
                    <option value="ENVELOPE">Housse de couette</option>
                    <option value="FLAT">Drap plat</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Dimensions</label>
                  <input type="text" name="dimensions" placeholder="ex: 140x190x30" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900" required />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-slate-500 mb-1">Catégorie</label>
                <input type="text" name="category" placeholder="ex: Oreillers / Couettes" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900" required />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">Quantité Initiale</label>
                <input type="number" name="stockQuantity" min="0" defaultValue="1" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Seuil d'Alerte (🚨)</label>
                <input type="number" name="alertThreshold" min="1" defaultValue={addType === 'PF' ? "5" : "3"} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              {addType === 'MA' && (
                <div>
                  <label className="block text-emerald-600 mb-1">💰 Prix d'Achat HT (€)</label>
                  <input type="number" step="0.01" name="purchasePriceHT" placeholder="0.00" className="w-full p-2.5 bg-emerald-50/50 border border-emerald-100 text-emerald-700 rounded-xl font-bold focus:outline-none" required />
                </div>
              )}
              <div className={addType === 'PF' ? "col-span-2" : ""}>
                <label className="block text-indigo-600 mb-1">📈 Prix de Vente HT (€)</label>
                <input type="number" step="0.01" name="sellingPriceHT" placeholder="0.00" className="w-full p-2.5 bg-indigo-50/50 border border-indigo-100 text-indigo-700 rounded-xl font-bold focus:outline-none" required />
              </div>
            </div>

            <button type="submit" className="w-full py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-indigo-600 transition-colors mt-2 text-xs uppercase tracking-wider">
              Créer et Alimenter Stock
            </button>
          </form>
        </div>

        {/* BLOC 3 : LE JOURNAL DES VENTES UNIQUE CONSOLIDÉ */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="font-serif font-bold text-lg text-slate-900">📖 Journal de Caisse</h3>
            <p className="text-slate-400 text-xs">Flux chronologique des encaissements récents</p>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 pr-2">
            {journal.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-sm">Aucune transaction enregistrée.</p>
            ) : (
              journal.map((sale: any) => (
                <div key={sale.id} className="py-3 flex justify-between items-center text-sm hover:bg-slate-50/50 px-2 rounded-xl transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider ${sale.type === 'PRODUIT_FINI' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {sale.type === 'PRODUIT_FINI' ? 'CONFECTION' : 'NÉGOCE'}
                      </span>
                      <p className="font-bold text-slate-900">{sale.name}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      Réf: <span className="font-mono text-slate-600 font-bold">{sale.referenceItem}</span> — {new Date(sale.createdAt).toLocaleDateString('fr-FR')} à {new Date(sale.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-black text-slate-900">+{sale.totalPriceHT.toFixed(2)} € HT</p>
                    <p className="text-[11px] text-slate-500 font-medium">Qte: <strong className="text-slate-800">{sale.quantitySold}</strong> | Mod: {sale.paymentMethod}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}