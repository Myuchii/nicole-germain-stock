'use client'
import { useState, useEffect } from 'react'
import { getInventoryData, createFinishedProduct, createMerchandise, deleteProduct, updateProduct, updateLotQuantity } from '@/app/_actions/stock-actions'
import { recordSale, getSalesJournal, getBoutiqueJDV, getBoutiqueJDC } from '@/app/_actions/sales-actions'
import { Download, AlertTriangle, ShoppingCart, Package, ShoppingBag, Plus, Trash2, Search, Eye, EyeOff, Edit2, Pencil, Calendar, FileSpreadsheet, Coins } from 'lucide-react'
import LocationSwitch from '@/components/LocationSwitch'

export default function StockBoutiquePage() {
  const [inventory, setInventory] = useState<any>(null)
  const [journal, setJournal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [saleType, setSaleType] = useState<'PRODUIT_FINI' | 'MARCHANDISE'>('PRODUIT_FINI')
  const [selectedRef, setSelectedRef] = useState('')
  const [selectedQty, setSelectedQty] = useState(1)
  const [cart, setCart] = useState<any[]>([]) 
  
  const [applyVAT, setApplyVAT] = useState(true)
  const [discount, setDiscount] = useState(0)

  const [addType, setAddType] = useState<'PF' | 'MA'>('PF')

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')

  const [startDate, setStartDate] = useState(`${currentYear}-${currentMonth}-01`)
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0])

  const [searchQuery, setSearchQuery] = useState('')
  const [hideOutOfStock, setHideOutOfStock] = useState(false)
  
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editingLot, setEditingLot] = useState<{id: string, type: 'PF' | 'MA', currentQty: number, name: string, price: number} | null>(null)

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

  const handleAddToInvoice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRef) return

    const itemsList = saleType === 'PRODUIT_FINI' ? inventory.finished.items : inventory.merchandise.items
    const targetItem = itemsList.find((i: any) => i.reference === selectedRef)
    
    if (!targetItem) return

    const availableStock = targetItem.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0

    const existingInCart = cart.find(c => c.reference === selectedRef)
    const currentCartQty = existingInCart ? existingInCart.quantity : 0
    if (currentCartQty + selectedQty > availableStock) {
      alert(`Impossible d'ajouter cette quantité. Stock disponible max : ${availableStock}`)
      return
    }

    const price = targetItem.lots?.find((l: any) => l.quantityLeft > 0)?.sellingPriceHT || targetItem.sellingPriceHT

    if (existingInCart) {
      setCart(cart.map(c => c.reference === selectedRef ? { ...c, quantity: c.quantity + selectedQty } : c))
    } else {
      setCart([...cart, {
        reference: selectedRef,
        name: targetItem.name,
        type: saleType,
        quantity: selectedQty,
        priceHT: price
      }])
    }

    setSelectedRef('')
    setSelectedQty(1)
  }

  const handleExportJDV = async () => {
    try {
      const jdvData = await getBoutiqueJDV({ startDate, endDate })
      if (!jdvData || jdvData.length === 0) return alert("Aucune vente enregistrée sur cette période.")

      const headers = [
        "date", "numéro ticket", "type de vente", "motif de remboursement", "nbr d'articles",
        "CA HT 20%", "TVA collectée 20%", "CA TTC 20%", "encaissement CB", "encaissement Espèces",
        "encaissement chèque", "remboursement CB", "remboursement especes", "remboursement cheque",
        "total remboursement", "total remises accordées", "prenom client", "nom client",
        "entreprise client", "email client", "telephone client", "code postal client", "note client"
      ]
      
      const rows = jdvData.map((row: any) => [
        row.date, row.ticketId, row.typeVente, row.motifRemboursement, row.nbrArticles,
        row.caHT20.toFixed(2), row.tva20.toFixed(2), row.caTTC20.toFixed(2), row.cb.toFixed(2),
        row.especes.toFixed(2), row.cheque.toFixed(2), row.remboursementCB.toFixed(2),
        row.remboursementEspeces.toFixed(2), row.remboursementCheque.toFixed(2),
        row.totalRemboursement.toFixed(2), row.totalRemises.toFixed(2), row.clientPrenom,
        row.clientNom, row.clientEntreprise, row.clientEmail, row.clientTelephone,
        row.clientCodePostal, row.clientNote
      ])

      const escapeCSV = (value: any) => value === null || value === undefined ? '""' : `"${value.toString().replace(/"/g, '""')}"`
      const csvContent = [headers, ...rows].map(r => r.map(escapeCSV).join(";")).join("\n")
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `JDV_Boutique_${startDate}_au_${endDate}.csv`; link.click()
    } catch (err) {
      alert("Erreur lors de l'export du JDV")
    }
  }

  const handleExportJDC = async () => {
    try {
      const jdcData = await getBoutiqueJDC({ startDate, endDate })
      if (!jdcData || jdcData.length === 0) return alert("Aucun encaissement sur cette période.")

      const headers = [
        "jour d'ouveture", "heure d'ouverture", "heure de fermeture", "premier ticket", "dernier ticket",
        "nbr de ventes", "nbr de remboursements", "ca HT 20%", "TVA 20% collectée", "CA TTC 20%",
        "encaissement CB", "encaissement Especes", "encaissement Chèque", "Total paiment",
        "Remboursement CB", "remboursement especes", "Remboursement cheques", "tota lremboursement",
        "TTC remisé", "especes à l'ouverture", "ventes en especes", "remboursements en especes",
        "sorties", "especes attendues", "especes constatées", "differences", "nbr d'entrées/sorties", "détail des entrées/sorties"
      ]
      
      const rows = jdcData.map((row: any) => [
        row.jourOuverture, row.heureOuverture, row.heureFermeture, row.premierTicket, row.dernierTicket,
        row.nbrVentes, row.nbrRemboursements, row.caHT20.toFixed(2), row.tva20.toFixed(2), row.caTTC20.toFixed(2),
        row.encaissementCB.toFixed(2), row.encaissementEspeces.toFixed(2), row.encaissementCheque.toFixed(2),
        row.totalPaiement.toFixed(2), row.remboursementCB.toFixed(2), row.remboursementEspeces.toFixed(2),
        row.remboursementCheque.toFixed(2), row.totalRemboursement.toFixed(2), row.ttcRemise.toFixed(2),
        row.especesOuverture.toFixed(2), row.encaissementEspeces.toFixed(2), row.remboursementEspeces.toFixed(2),
        row.sorties.toFixed(2), row.especesAttendues.toFixed(2), row.especesConstatees.toFixed(2),
        row.difference.toFixed(2), row.nbrEntreesSorties, row.detailEntreesSorties
      ])

      const escapeCSV = (value: any) => value === null || value === undefined ? '""' : `"${value.toString().replace(/"/g, '""')}"`
      const csvContent = [headers, ...rows].map(r => r.map(escapeCSV).join(";")).join("\n")
      const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `JDC_Boutique_${startDate}_au_${endDate}.csv`; link.click()
    } catch (err) {
      alert("Erreur lors de l'export du JDC")
    }
  }

  const handleRemoveFromCart = (ref: string) => {
    setCart(cart.filter(item => item.reference !== ref))
  }

  const cartTotalHT = cart.reduce((sum, item) => sum + (item.priceHT * item.quantity), 0)
  const cartTotalHTWithDiscount = cartTotalHT * (1 - discount / 100)
  const cartTotalTTC = applyVAT ? cartTotalHTWithDiscount * 1.20 : cartTotalHTWithDiscount

  const handleDeleteProduct = async (id: string, type: 'PF' | 'MA') => {
    if (confirm("Voulez-vous vraiment supprimer définitivement ce produit du catalogue ?")) {
      const res = await deleteProduct(id, type)
      if (!res.success) alert(res.error)
      else window.location.reload()
    }
  }

  const filterItems = (items: any[]) => {
    return items?.filter((item: any) => {
      const matchesSearch = item.reference.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.name.toLowerCase().includes(searchQuery.toLowerCase())
      const totalStock = item.lots?.reduce((sum: number, l: any) => sum + l.quantityLeft, 0) || 0
      const matchesStockFilter = hideOutOfStock ? totalStock > 0 : true
      return matchesSearch && matchesStockFilter
    })
  }

  const handleExportGlobalCSV = () => {
    if (!inventory) return
    const headers = ["Type", "Référence", "Désignation", "Date d'entrée (Lot)", "Quantité Restante", "Prix Achat Unitaire HT (€)", "Prix Vente Unitaire HT (€)", "Valeur Totale Achat HT (€)", "Valeur Totale Vente HT (€)"]
    const rows: any[][] = []

    inventory.finished.items.forEach((p: any) => {
      const activeLots = p.lots?.filter((l: any) => l.quantityLeft > 0) || []
      if (activeLots.length === 0) rows.push(["PRODUIT FINI", p.reference, p.name, "-", 0, "-", p.sellingPriceHT.toFixed(2), "0.00", "0.00"])
      else activeLots.forEach((lot: any) => rows.push(["PRODUIT FINI", p.reference, p.name, new Date(lot.createdAt).toLocaleDateString('fr-FR'), lot.quantityLeft, "-", (lot.sellingPriceHT || p.sellingPriceHT).toFixed(2), "-", (lot.quantityLeft * (lot.sellingPriceHT || p.sellingPriceHT)).toFixed(2)]))
    })

    inventory.merchandise.items.forEach((m: any) => {
      const activeLots = m.lots?.filter((l: any) => l.quantityLeft > 0) || []
      if (activeLots.length === 0) rows.push(["MARCHANDISE", m.reference, m.name, "-", 0, "-", m.sellingPriceHT.toFixed(2), "0.00", "0.00"])
      else activeLots.forEach((lot: any) => rows.push(["MARCHANDISE", m.reference, m.name, new Date(lot.createdAt).toLocaleDateString('fr-FR'), lot.quantityLeft, (lot.purchasePriceHT || 0).toFixed(2), (lot.sellingPriceHT || m.sellingPriceHT).toFixed(2), (lot.quantityLeft * (lot.purchasePriceHT || 0)).toFixed(2), (lot.quantityLeft * (lot.sellingPriceHT || m.sellingPriceHT)).toFixed(2)]))
    })

    const escapeCSV = (value: any) => value === null || value === undefined ? '""' : `"${value.toString().replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(";")).join("\n")
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Inventaire_Boutique_Lots.csv`; link.click();
  }

  const handleExportSalesCSV = () => {
    if (!journal || journal.length === 0) return alert("Le journal de caisse est vide !")

    const headers = [
      "Date", "Heure", "ID Ticket", "Type Flux", "Référence Article", "Désignation", 
      "Quantité Vendue", "Prix Unitaire Base HT (€)", "Total Ligne Brut HT (€)", 
      "Remise (%)", "Montant Remise HT (€)", "Total Ligne Remisé HT (€)", 
      "TVA Appliquée", "Montant TVA (€)", "Montant Ligne TTC (€)", "Mode Règlement"
    ]
    
    const rows = journal.map((sale: any) => {
      const dateObj = new Date(sale.createdAt)
      const isTTC = sale.isTTC || (!sale.isTaxExempt && sale.taxRate > 0) 
      const tvaPercent = isTTC ? 20 : 0
      
      const htRemise = sale.totalPriceHT 
      const ttc = sale.totalPriceTTC || (isTTC ? htRemise * 1.2 : htRemise)
      const montantTva = ttc - htRemise

      const unitPrice = sale.unitPriceHT || (sale.quantitySold > 0 ? htRemise / sale.quantitySold : 0)
      const remisePercent = sale.discountPercent || 0
      
      const totalBrutHT = unitPrice * sale.quantitySold
      const montantRemiseHT = totalBrutHT - htRemise 

      return [
        dateObj.toLocaleDateString('fr-FR'),
        dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        sale.ticketId || "Vente isolée",
        sale.type === 'PRODUIT_FINI' ? 'CONFECTION' : 'NÉGOCE',
        sale.referenceItem,
        sale.name,
        sale.quantitySold,
        unitPrice.toFixed(2),
        totalBrutHT.toFixed(2),
        `${remisePercent}%`,
        montantRemiseHT.toFixed(2),  
        htRemise.toFixed(2),
        `${tvaPercent}%`,
        montantTva.toFixed(2),
        ttc.toFixed(2),
        sale.paymentMethod
      ]
    })

    const escapeCSV = (value: any) => value === null || value === undefined ? '""' : `"${value.toString().replace(/"/g, '""')}"`
    const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(";")).join("\n")
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `Export_Compta_Caisse.csv`; link.click();
  }

  const totalPFQuantity = inventory?.finished?.items?.reduce((sum: number, p: any) => sum + (p.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0), 0) || 0
  const totalMAQuantity = inventory?.merchandise?.items?.reduce((sum: number, m: any) => sum + (m.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0), 0) || 0
  const pfRetailValue = inventory?.finished?.items?.reduce((sum: number, p: any) => sum + (p.lots?.reduce((s: number, l: any) => s + (l.quantityLeft * (l.sellingPriceHT || p.sellingPriceHT)), 0) || 0), 0) || 0
  const maRetailValue = inventory?.merchandise?.items?.reduce((sum: number, m: any) => sum + (m.lots?.reduce((s: number, l: any) => s + (l.quantityLeft * (l.sellingPriceHT || m.sellingPriceHT)), 0) || 0), 0) || 0
  const totalRetailValueHT = pfRetailValue + maRetailValue
  const totalAlerts = (inventory?.finished?.items?.filter((p: any) => (p.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0) <= p.alertThreshold).length || 0) + (inventory?.merchandise?.items?.filter((m: any) => (m.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0) <= m.alertThreshold).length || 0)

  const groupedJournalArray = Object.values(journal.reduce((acc: any, sale: any) => {
    const key = sale.ticketId || sale.id 
    if (!acc[key]) acc[key] = { ticketId: sale.ticketId || "Vente isolée", createdAt: sale.createdAt, paymentMethod: sale.paymentMethod, totalTicketHT: 0, items: [] }
    acc[key].items.push(sale)
    acc[key].totalTicketHT += sale.totalPriceHT
    return acc
  }, {})).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">🏪 Espace Boutique & Ventes Directes</h1>
          <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Gestion centralisée des stocks finis et du négoce par lots comptables</p>
        </div>
        <button onClick={handleExportGlobalCSV} className="px-5 py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-600 transition-all text-sm shadow-sm">
          <Download size={16} /> Export Global CSV
        </button>
      </div>

      {/* FILTRES & RECHERCHE CATALOGUE */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input type="text" placeholder="Rechercher une référence ou un modèle..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500" />
        </div>
        <button onClick={() => setHideOutOfStock(!hideOutOfStock)} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${hideOutOfStock ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          {hideOutOfStock ? <EyeOff size={16} /> : <Eye size={16} />} {hideOutOfStock ? "Masquer les ruptures : ACTIF" : "Afficher tout le catalogue"}
        </button>
      </div>

      {/* DRAPEAUX STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Valeur Marchande (HT)</p>
            <p className="text-2xl font-serif font-bold text-emerald-600 mt-1">{totalRetailValueHT.toFixed(2)} €</p>
          </div>
          <ShoppingBag className="absolute -right-4 -bottom-4 text-emerald-50 opacity-50" size={80} />
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase">Articles Disponibles</p>
          <p className="text-2xl font-serif font-bold text-slate-900 mt-1">{totalPFQuantity + totalMAQuantity} pièces</p>
        </div>
        <div className={`p-5 rounded-3xl border shadow-sm flex justify-between items-center ${totalAlerts > 0 ? 'bg-red-50 border-red-100 text-red-900' : 'bg-white border-slate-100 text-slate-900'}`}>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Seuils Critiques</p>
            <p className="text-2xl font-serif font-bold mt-1">{totalAlerts} alertes</p>
          </div>
          {totalAlerts > 0 && <AlertTriangle className="text-red-500 animate-pulse" size={24} />}
        </div>
      </div>

      {/* GRILLES STOCKS SÉPARÉS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* PRODUITS FINIS */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2"><Package size={20} className="text-indigo-500" /> Stock Produits Finis</h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="p-3 pl-5">Réf</th><th className="p-3">Désignation</th><th className="p-3 text-center">Total</th><th className="p-3">Lots Actifs (Clic = Modif)</th><th className="p-3 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {filterItems(inventory?.finished?.items)?.map((p: any) => {
                  const totalStock = p.lots?.reduce((sum: number, lot: any) => sum + lot.quantityLeft, 0) || 0
                  return (
                    <tr key={p.id} className={totalStock <= p.alertThreshold ? "bg-red-50/40" : ""}>
                      <td className="p-3 pl-5 font-mono text-indigo-600 font-bold">{p.reference}</td>
                      <td className="p-3 font-bold text-slate-900">{p.name} <span className="text-[10px] text-slate-400 block font-normal">{p.dimensions}</span></td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full font-bold ${totalStock <= p.alertThreshold ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{totalStock}</span></td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {p.lots?.filter((l: any) => l.quantityLeft > 0).length === 0 ? <span className="text-red-500 font-bold">Rupture</span> : (
                          <div className="flex flex-wrap gap-1">
                            {p.lots?.filter((l: any) => l.quantityLeft > 0).map((lot: any) => (
                              <div key={lot.id} onClick={() => setEditingLot({id: lot.id, type: 'PF', currentQty: lot.quantityLeft, name: p.name, price: lot.sellingPriceHT})} className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex flex-col gap-0.5 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors group">
                                <span className="text-slate-700 font-black group-hover:text-indigo-700">{lot.quantityLeft} pcs</span>
                                <span className="text-[9px] uppercase tracking-wider">Vente: <strong>{lot.sellingPriceHT?.toFixed(2)}€</strong></span>
                                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                  <LocationSwitch lotId={lot.id} itemType="FINISHED_PRODUCT" currentLocation={lot.location} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditingProduct({ ...p, type: 'PF' })} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteProduct(p.id, 'PF')} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* MARCHANDISES */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2"><ShoppingBag size={20} className="text-emerald-500" /> Stock Marchandises</h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="p-3 w-12 text-center">Choix</th><th className="p-3">Référence</th><th className="p-3">Désignation</th><th className="p-3">Lots Actifs (Clic = Modif)</th><th className="p-3 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {filterItems(inventory?.merchandise?.items)?.map((m: any) => {
                  const totalStock = m.lots?.reduce((sum: number, lot: any) => sum + lot.quantityLeft, 0) || 0
                  return (
                    <tr key={m.id} className={totalStock <= m.alertThreshold ? "bg-red-50/40" : ""}>
                      <td className="p-3 pl-5 font-mono text-emerald-600 font-bold">{m.reference}</td>
                      <td className="p-3 font-bold text-slate-900">{m.name} <span className="text-[10px] text-slate-400 block font-normal">{m.category}</span></td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full font-bold ${totalStock <= m.alertThreshold ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{totalStock}</span></td>
                      <td className="p-3 text-[11px] text-slate-500">
                        {m.lots?.filter((l: any) => l.quantityLeft > 0).length === 0 ? <span className="text-red-500 font-bold">Rupture</span> : (
                          <div className="flex flex-wrap gap-1">
                            {m.lots?.filter((l: any) => l.quantityLeft > 0).map((lot: any) => (
                              <div key={lot.id} onClick={() => setEditingLot({id: lot.id, type: 'MA', currentQty: lot.quantityLeft, name: m.name, price: lot.sellingPriceHT})} className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg flex flex-col gap-0.5 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors group">
                                <span className="text-slate-700 font-black group-hover:text-emerald-700">{lot.quantityLeft} pcs</span>
                                <span className="text-[9px] uppercase tracking-wider">Achat: <strong className="text-emerald-600">{lot.purchasePriceHT?.toFixed(2)}€</strong> | Vente: <strong className="text-indigo-600">{lot.sellingPriceHT?.toFixed(2)}€</strong></span>
                                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                  <LocationSwitch lotId={lot.id} itemType="MERCHANDISE" currentLocation={lot.location} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 pr-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditingProduct({ ...m, type: 'MA' })} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteProduct(m.id, 'MA')} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
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

      {/* SECTIONS INFÉRIEURES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        
        {/* CAISSE ENREGISTREUSE */}
        <div className="bg-slate-950 p-6 rounded-[2.5rem] text-white space-y-4 shadow-xl self-start">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <ShoppingCart size={18} /> Caisse enregistreuse multi-articles
          </div>
          <h3 className="font-serif font-bold text-xl">Saisie Vente Directe</h3>
          
          <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl gap-1">
            <button onClick={() => { setSaleType('PRODUIT_FINI'); setSelectedRef(''); }} className={`py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'PRODUIT_FINI' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Confection</button>
            <button onClick={() => { setSaleType('MARCHANDISE'); setSelectedRef(''); }} className={`py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'MARCHANDISE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Marchandise</button>
          </div>

          <form onSubmit={handleAddToInvoice} className="space-y-3 text-slate-800 text-sm">
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-1">Sélectionner un article</label>
              <select value={selectedRef} onChange={(e) => setSelectedRef(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-xs" required>
                <option value="">-- Choisir un modèle --</option>
                {inventory && (saleType === 'PRODUIT_FINI' ? inventory.finished.items : inventory.merchandise.items)?.map((item: any) => {
                  const stock = item.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0
                  return <option key={item.id} value={item.reference} disabled={stock <= 0}>[{item.reference}] - {item.name} ({stock} dispo)</option>
                })}
              </select>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-slate-400 text-xs font-bold mb-1">Quantité</label>
                <input type="number" min="1" value={selectedQty} onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)} className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold" required />
              </div>
              <button type="submit" className={`p-3 text-xs font-black text-white rounded-xl transition-all shadow-md ${saleType === 'PRODUIT_FINI' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>+ Ajouter</button>
            </div>
          </form>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Ticket en cours :</p>
            {cart.length === 0 ? (
              <p className="text-slate-500 text-xs italic py-2">Le ticket est vide.</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.reference} className="flex justify-between items-center text-xs bg-slate-900/50 p-2 border border-slate-900 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{item.reference} x{item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-400">{(item.priceHT * item.quantity).toFixed(2)}€ HT</span>
                      <button onClick={() => handleRemoveFromCart(item.reference)} className="text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form action={async (formData) => {
            if(cart.length === 0) return alert("Le panier est vide !")
            formData.append('cart', JSON.stringify(cart)) 
            formData.append('applyVAT', applyVAT.toString()) 
            formData.append('discountPercent', discount.toString())
            const res = await recordSale(formData)
            if(!res.success) alert(res.error)
            else { setCart([]); window.location.reload(); }
          }} className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
              <input type="checkbox" checked={applyVAT} onChange={e => setApplyVAT(e.target.checked)} className="rounded text-indigo-500 focus:ring-indigo-500 h-4 w-4 bg-slate-800 border-slate-700" />
              <div className="text-xs">
                <p className="font-bold text-slate-200">Facturer avec TVA (20%)</p>
                <p className="text-slate-500">Décocher pour les Pros</p>
              </div>
            </label>

            <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Remise (%) :</span>
              <div className="relative flex-1">
                <input type="number" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} min="0" max="100" placeholder="0" className="w-full text-right pr-7 py-1.5 px-2 border border-slate-800 bg-slate-950 text-white rounded-lg text-sm font-bold focus:outline-none focus:border-indigo-500" />
                <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">%</span>
              </div>
            </div>

            <div>
              <select name="paymentMethod" className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-xs">
                <option value="CB">💳 Carte Bancaire</option><option value="ESPECES">💵 Espèces</option><option value="CHEQUE">📝 Chèque</option><option value="VIREMENT">🏦 Virement</option>
              </select>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl flex justify-between items-center border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 font-bold block">Total Général {applyVAT ? 'TTC' : 'HT'}</span>
                {applyVAT && <span className="text-[10px] text-slate-500">Dont TVA : {(cartTotalTTC - cartTotalHT).toFixed(2)}€</span>}
              </div>
              <span className="text-xl font-serif font-black text-slate-100">{applyVAT ? cartTotalTTC.toFixed(2) : cartTotalHT.toFixed(2)} €</span>
            </div>

            <button type="submit" disabled={cart.length === 0} className="w-full py-3.5 bg-white text-slate-950 font-black rounded-xl hover:bg-indigo-400 hover:text-white disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-md text-xs uppercase tracking-wider">
              🔒 Valider l'encaissement
            </button>
          </form>
        </div>

        {/* RECEPTION DE STOCK */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-4 shadow-xl self-start">
          <h3 className="font-serif font-bold text-xl text-slate-900">Réception de Stock</h3>
          
          <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl gap-1">
            <button onClick={() => setAddType('PF')} className={`py-2 text-xs font-bold rounded-lg transition-all ${addType === 'PF' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-900'}`}>Confection</button>
            <button onClick={() => setAddType('MA')} className={`py-2 text-xs font-bold rounded-lg transition-all ${addType === 'MA' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-900'}`}>Marchandise</button>
          </div>

          <form action={async (formData) => {
            const res = addType === 'PF' ? await createFinishedProduct(formData) : await createMerchandise(formData)
            if (!res.success) alert(res.error); else window.location.reload();
          }} className="space-y-3 text-slate-700 text-xs font-bold">
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-slate-500 mb-1">Réf.</label><input type="text" name="reference" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
              <div><label className="block text-slate-500 mb-1">Désignation</label><input type="text" name="name" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
            </div>
            {addType === 'PF' ? (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-slate-500 mb-1">Famille</label><select name="family" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"><option value="FITTED">Drap Housse</option><option value="ENVELOPE">Housse couette</option><option value="FLAT">Drap plat</option></select></div>
                <div><label className="block text-slate-500 mb-1">Dimensions</label><input type="text" name="dimensions" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
              </div>
            ) : (
              <div><label className="block text-slate-500 mb-1">Catégorie</label><input type="text" name="category" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required /></div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-slate-500 mb-1">Qté Initiale</label><input type="number" name="stockQuantity" min="0" defaultValue="1" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
              <div><label className="block text-slate-500 mb-1">Alerte 🚨</label><input type="number" name="alertThreshold" min="0" defaultValue="3" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              {addType === 'MA' && <div><label className="block text-emerald-600 mb-1">Prix Achat HT</label><input type="number" step="0.01" name="purchasePriceHT" className="w-full p-2.5 bg-emerald-50/50 border text-emerald-700 rounded-xl" required /></div>}
              <div className={addType === 'PF' ? "col-span-2" : ""}><label className="block text-indigo-600 mb-1">Prix Vente HT</label><input type="number" step="0.01" name="sellingPriceHT" className="w-full p-2.5 bg-indigo-50/50 border text-indigo-700 rounded-xl" required /></div>
            </div>
            <button type="submit" className="w-full py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-indigo-600 mt-2 text-xs uppercase">Créer Lot</button>
          </form>
        </div>

        {/* 📂 NOUVEAU BLOC CENTRALISÉ : CONSOLE COMPTABLE POUR JDC, JDV & JV */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 self-start flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider">
              <Calendar size={16} /> Rapports Comptables
            </div>
            <h3 className="font-serif font-bold text-xl text-slate-900">Période d'Audit</h3>
            <p className="text-xs text-slate-400">Sélectionnez la fenêtre temporelle pour compiler et exporter vos journaux.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Du</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Au</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* ⚡ LA CENTRALE DES TROIS EXPORTS COMBINÉS */}
          <div className="space-y-2.5 pt-2">
            <button onClick={handleExportSalesCSV} className="w-full py-3 px-4 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-between group">
              <span className="flex items-center gap-2"><FileSpreadsheet size={15} className="text-indigo-400" />Journal Global (JV)</span>
              <Download size={14} className="opacity-60 group-hover:translate-y-0.5 transition-transform" />
            </button>

            <button onClick={handleExportJDV} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-between group">
              <span className="flex items-center gap-2"><FileSpreadsheet size={15} className="text-white" />Journal des Ventes (JDV)</span>
              <Download size={14} className="opacity-60 group-hover:translate-y-0.5 transition-transform" />
            </button>

            <button onClick={handleExportJDC} className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-between group">
              <span className="flex items-center gap-2"><Coins size={15} className="text-emerald-300" />Journal de Caisse (JDC)</span>
              <Download size={14} className="opacity-60 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

      </div>

      {/* JOURNAL DE CAISSE INTERACTIF (Full width en bas de page) */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-slate-50 pb-2">
          <div>
            <h3 className="font-serif font-bold text-lg text-slate-900">📖 Flux de Caisse récents</h3>
            <p className="text-xs text-slate-400 mt-0.5">Historique brut des encaissements par tickets de vente directe en magasin.</p>
          </div>
        </div>
        
        <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2">
          {groupedJournalArray.map((ticket: any) => (
            <div key={ticket.ticketId + ticket.createdAt} className="bg-slate-50 rounded-xl p-3 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                <div>
                  <span className="font-bold text-slate-800 text-xs">{ticket.ticketId !== "Vente isolée" ? `🧾 Ticket ${ticket.ticketId}` : "🧾 Ancienne Vente"}</span>
                  <span className="text-[10px] text-slate-500 ml-2">{new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold mr-2">MOD: {ticket.paymentMethod}</span>
                  <span className="font-black text-indigo-600 text-sm">
                    +{(ticket.items[0]?.isTTC ? ticket.items.reduce((s:number, i:any)=>s+i.totalPriceTTC,0) : ticket.totalTicketHT).toFixed(2)} €
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 pl-1">
                {ticket.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center text-[11px]">
                    <div className="flex items-center gap-1.5"><span className="text-slate-600"><strong>{item.quantitySold}x</strong> {item.name}</span></div>
                    <span className="text-slate-700 font-bold">{item.isTTC ? item.totalPriceTTC?.toFixed(2) : item.totalPriceHT?.toFixed(2)} €</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODALS */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative">
            <h3 className="font-serif font-bold text-xl mb-1 text-slate-900">Modifier l'article</h3>
            <button type="button" onClick={() => setEditingProduct(null)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-xs uppercase">Annuler</button>
          </div>
        </div>
      )}

      {editingLot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><Pencil size={24}/></div>
              <div>
                <h3 className="font-serif font-black text-xl text-slate-900">Ajuster le Lot</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{editingLot.name}</p>
              </div>
            </div>
            <form action={async (formData) => {
              const res = await updateLotQuantity(editingLot.id, editingLot.type, Number(formData.get('quantity')))
              if (!res.success) alert(res.error); else window.location.reload()
            }} className="space-y-4">
              <div>
                <label className="block text-slate-500 text-xs font-bold mb-2">Quantité réelle en rayon :</label>
                <div className="flex items-center gap-2">
                  <input type="number" name="quantity" defaultValue={editingLot.currentQty} min="0" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500" required />
                  <span className="text-slate-400 font-bold">pcs</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingLot(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs uppercase">Annuler</button>
                <button type="submit" className="flex-1 py-3 bg-amber-500 text-white font-black rounded-xl text-xs uppercase shadow-lg shadow-amber-500/30">Mettre à jour</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}