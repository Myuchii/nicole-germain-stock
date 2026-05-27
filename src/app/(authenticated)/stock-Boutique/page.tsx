'use client'
import { useState, useEffect } from 'react'
import { getInventoryData, createFinishedProduct, createMerchandise, deleteProduct, updateProduct } from '@/app/_actions/stock-actions'
import { recordSale, getSalesJournal } from '@/app/_actions/sales-actions'
// On rajoute Trash2 pour la suppression et Search, Eye, EyeOff pour les filtres
import { Download, AlertTriangle, ShoppingCart, Package, ShoppingBag, Plus, Trash2, Search, Eye, EyeOff, Edit2} from 'lucide-react'
import { adjustProductStock, adjustProductPrice } from '@/app/_actions/boutique-actions'

export default function StockBoutiquePage() {
  const [inventory, setInventory] = useState<any>(null)
  const [journal, setJournal] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // États pour la caisse et le panier
  const [saleType, setSaleType] = useState<'PRODUIT_FINI' | 'MARCHANDISE'>('PRODUIT_FINI')
  const [selectedRef, setSelectedRef] = useState('')
  const [selectedQty, setSelectedQty] = useState(1)
  const [cart, setCart] = useState<any[]>([]) // 🛒 Notre panier local
  
  // États pour la réception de stock
  const [addType, setAddType] = useState<'PF' | 'MA'>('PF')

  // 🔍 Nouveaux états pour la recherche et les filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [hideOutOfStock, setHideOutOfStock] = useState(false)
  
  const [editingProduct, setEditingProduct] = useState<any>(null)

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

  // ==========================================
  // 🛒 GESTION DU PANIER LOCAL (FRONTEND)
  // ==========================================
  const handleAddToInvoice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRef) return

    // On récupère l'objet complet de l'article pour avoir son nom et son prix
    const itemsList = saleType === 'PRODUIT_FINI' ? inventory.finished.items : inventory.merchandise.items
    const targetItem = itemsList.find((i: any) => i.reference === selectedRef)
    
    if (!targetItem) return

    // On calcule le stock disponible restant (somme des lots restants)
    const availableStock = targetItem.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0

    // Vérification de sécurité locale sur la quantité globale demandée
    const existingInCart = cart.find(c => c.reference === selectedRef)
    const currentCartQty = existingInCart ? existingInCart.quantity : 0
    if (currentCartQty + selectedQty > availableStock) {
      alert(`Impossible d'ajouter cette quantité. Stock disponible max : ${availableStock}`)
      return
    }

    // Détermination du prix de revente indicatif (on prend le prix du lot actif ou le prix maître)
    const price = targetItem.lots?.find((l: any) => l.quantityLeft > 0)?.sellingPriceHT || targetItem.sellingPriceHT

    if (existingInCart) {
      // Si l'article est déjà dans le ticket, on incrémente juste la quantité
      setCart(cart.map(c => c.reference === selectedRef ? { ...c, quantity: c.quantity + selectedQty } : c))
    } else {
      // Sinon, on ajoute la nouvelle ligne
      setCart([...cart, {
        reference: selectedRef,
        name: targetItem.name,
        type: saleType,
        quantity: selectedQty,
        priceHT: price
      }])
    }

    // Reset des inputs de sélection
    setSelectedRef('')
    setSelectedQty(1)
  }

  const handleRemoveFromCart = (ref: string) => {
    setCart(cart.filter(item => item.reference !== ref))
  }

  const cartTotalHT = cart.reduce((sum, item) => sum + (item.priceHT * item.quantity), 0)

// ==========================================
  // 🗑️ FONCTION DE SUPPRESSION DE FICHE CONNECTÉE
  // ==========================================
  const handleDeleteProduct = async (id: string, type: 'PF' | 'MA') => {
    if (confirm("Voulez-vous vraiment supprimer définitivement ce produit du catalogue ? (L'historique des ventes sera conservé dans le journal)")) {
      const res = await deleteProduct(id, type)
      if (!res.success) {
        alert(res.error)
      } else {
        window.location.reload() // On rafraîchit la page pour vider le tableau
      }
    }
  }

  // ==========================================
  // 🔍 FILTRAGE DYNAMIQUE DES TABLEAUX
  // ==========================================
  const filterItems = (items: any[]) => {
    return items?.filter((item: any) => {
      const matchesSearch = item.reference.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.name.toLowerCase().includes(searchQuery.toLowerCase())
      
      const totalStock = item.lots?.reduce((sum: number, l: any) => sum + l.quantityLeft, 0) || 0
      const matchesStockFilter = hideOutOfStock ? totalStock > 0 : true

      return matchesSearch && matchesStockFilter
    })
  }

// ==========================================
  // 📊 EXPORT DU STOCK DÉTAILLÉ (PAR LOTS) - VERSION SÉCURISÉE
  // ==========================================
  const handleExportGlobalCSV = () => {
    if (!inventory) return
    
    // 1. Les nouveaux en-têtes adaptés aux lots
    const headers = [
      "Type", 
      "Référence", 
      "Désignation", 
      "Date d'entrée (Lot)", 
      "Quantité Restante", 
      "Prix Achat Unitaire HT (€)", 
      "Prix Vente Unitaire HT (€)", 
      "Valeur Totale Achat HT (€)",
      "Valeur Totale Vente HT (€)"
    ]
    
    const rows: any[][] = []

    // 2. Export des Produits Finis (Confection) par lots
    inventory.finished.items.forEach((p: any) => {
      const activeLots = p.lots?.filter((l: any) => l.quantityLeft > 0) || []
      
      if (activeLots.length === 0) {
        rows.push(["PRODUIT FINI", p.reference, p.name, "-", 0, "-", p.sellingPriceHT.toFixed(2), "0.00", "0.00"])
      } else {
        activeLots.forEach((lot: any) => {
          const dateStr = new Date(lot.createdAt).toLocaleDateString('fr-FR')
          const priceVente = lot.sellingPriceHT || p.sellingPriceHT
          
          rows.push([
            "PRODUIT FINI", 
            p.reference, 
            p.name, 
            dateStr, 
            lot.quantityLeft, 
            "-", // Pas d'achat unitaire pour la confection
            priceVente.toFixed(2), 
            "-", 
            (lot.quantityLeft * priceVente).toFixed(2)
          ])
        })
      }
    })

    // 3. Export des Marchandises (Négoce) par lots
    inventory.merchandise.items.forEach((m: any) => {
      const activeLots = m.lots?.filter((l: any) => l.quantityLeft > 0) || []
      
      if (activeLots.length === 0) {
        rows.push(["MARCHANDISE", m.reference, m.name, "-", 0, "-", m.sellingPriceHT.toFixed(2), "0.00", "0.00"])
      } else {
        activeLots.forEach((lot: any) => {
          const dateStr = new Date(lot.createdAt).toLocaleDateString('fr-FR')
          const priceAchat = lot.purchasePriceHT || 0
          const priceVente = lot.sellingPriceHT || m.sellingPriceHT

          rows.push([
            "MARCHANDISE", 
            m.reference, 
            m.name, 
            dateStr, 
            lot.quantityLeft, 
            priceAchat.toFixed(2), 
            priceVente.toFixed(2), 
            (lot.quantityLeft * priceAchat).toFixed(2),
            (lot.quantityLeft * priceVente).toFixed(2)
          ])
        })
      }
    })

    // 4. 🛡️ SÉCURITÉ ANTI-DÉCALAGE : Force le format texte pour Excel
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '""'
      const str = value.toString()
      return `"${str.replace(/"/g, '""')}"`
    }

    // Assemblage final
    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(";"))
      .join("\n")
      
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Inventaire_Boutique_Lots_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
// ==========================================
  // 📊 EXPORT DU JOURNAL DES VENTES (AVEC TICKET ID)
  // ==========================================
  const handleExportSalesCSV = () => {
    if (!journal || journal.length === 0) {
      alert("Le journal de caisse est vide, aucune vente à exporter !")
      return
    }

    // 🆕 1. On ajoute "ID Ticket" en tête de colonne
    const headers = [
      "ID Ticket", 
      "Date", 
      "Heure", 
      "Type Flux", 
      "Référence Article", 
      "Désignation", 
      "Quantité Vendue", 
      "Mode Règlement", 
      "Total Ligne HT (€)"
    ]
    
    // 2. Transformation des lignes avec le ticketId
    const rows = journal.map((sale: any) => {
      const dateObj = new Date(sale.createdAt)
      const dateStr = dateObj.toLocaleDateString('fr-FR')
      const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const fluxStr = sale.type === 'PRODUIT_FINI' ? 'CONFECTION' : 'NÉGOCE'
      
      return [
        sale.ticketId || "Vente isolée", // 🆕 L'ID de ticket lie les lignes sous Excel !
        dateStr,
        timeStr,
        fluxStr,
        sale.referenceItem,
        sale.name,
        sale.quantitySold,
        sale.paymentMethod,
        sale.totalPriceHT.toFixed(2)
      ]
    })

    // 3. 🛡️ Sécurité anti-décalage de colonnes
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '""'
      const str = value.toString()
      return `"${str.replace(/"/g, '""')}"`
    }

    // 4. Assemblage et téléchargement
    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(";"))
      .join("\n")
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `Journal_Ventes_Tickets_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

// ==========================================
  // 💡 CALCULS DES KPIs (100% basés sur les Lots)
  // ==========================================
  const totalPFQuantity = inventory?.finished?.items?.reduce((sum: number, p: any) => sum + (p.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0), 0) || 0
  const totalMAQuantity = inventory?.merchandise?.items?.reduce((sum: number, m: any) => sum + (m.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0), 0) || 0

  // 🆕 CALCUL DE LA VALEUR MARCHANDE GLOBALE (Prix de vente public de tout le stock)
  const pfRetailValue = inventory?.finished?.items?.reduce((sum: number, p: any) => 
    sum + (p.lots?.reduce((s: number, l: any) => s + (l.quantityLeft * (l.sellingPriceHT || p.sellingPriceHT)), 0) || 0), 0) || 0
    
  const maRetailValue = inventory?.merchandise?.items?.reduce((sum: number, m: any) => 
    sum + (m.lots?.reduce((s: number, l: any) => s + (l.quantityLeft * (l.sellingPriceHT || m.sellingPriceHT)), 0) || 0), 0) || 0

  const totalRetailValueHT = pfRetailValue + maRetailValue

  // Alertes Seuils
  const pfAlerts = inventory?.finished?.items?.filter((p: any) => (p.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0) <= p.alertThreshold).length || 0
  const maAlerts = inventory?.merchandise?.items?.filter((m: any) => (m.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0) <= m.alertThreshold).length || 0
  const totalAlerts = pfAlerts + maAlerts

  // ==========================================
  // 🧾 REGROUPEMENT DU JOURNAL PAR TICKET DE CAISSE
  // ==========================================
  const groupedJournalArray = Object.values(
    journal.reduce((acc: any, sale: any) => {
      // Clé de regroupement (on utilise l'ID de vente si c'est une vieille vente sans ticket)
      const key = sale.ticketId || sale.id 
      
      if (!acc[key]) {
        acc[key] = {
          ticketId: sale.ticketId || "Vente isolée",
          createdAt: sale.createdAt,
          paymentMethod: sale.paymentMethod,
          totalTicketHT: 0,
          items: []
        }
      }
      acc[key].items.push(sale)
      acc[key].totalTicketHT += sale.totalPriceHT
      return acc
    }, {})
  ).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Tri du plus récent au plus ancien

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

      {/* 🔍 BARRE DE RECHERCHE ET FILTRES DE CATALOGUE COPIEUX */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher une référence ou un modèle..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() => setHideOutOfStock(!hideOutOfStock)}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${hideOutOfStock ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          {hideOutOfStock ? <EyeOff size={16} /> : <Eye size={16} />} 
          {hideOutOfStock ? "Masquer les ruptures : ACTIF" : "Afficher tout le catalogue"}
        </button>
      </div>

      {/* KPI COMPACTS */}
      <div className="grid grid-cols-3 gap-4">
        
        {/* 🆕 NOUVEAU KPI : Valeur Marchande du Stock */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-400 uppercase">Valeur Marchande (HT)</p>
            <p className="text-2xl font-serif font-bold text-emerald-600 mt-1">{totalRetailValueHT.toFixed(2)} €</p>
          </div>
          <ShoppingBag className="absolute -right-4 -bottom-4 text-emerald-50 opacity-50" size={80} />
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
        
        {/* TABLEAU ② : PRODUITS FINIS */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2">
            <Package size={20} className="text-indigo-500" /> Stock Produits Finis (Confection)
          </h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="p-3 pl-5">Réf</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-center">Stock Tot.</th>
                  <th className="p-3">Lots Actifs (FIFO)</th>
                  <th className="p-3 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {filterItems(inventory?.finished?.items)?.map((p: any) => {
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
                                <span className="text-[9px] uppercase tracking-wider">Vente: <strong>{lot.sellingPriceHT?.toFixed(2)}€</strong></span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      {/* 🗑️ BOUTON SUPPRIMER LA LIGNE */}
                      {/* ✏️ BOUTON MODIFIER ET 🗑️ SUPPRIMER */}
                      <td className="p-3 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditingProduct({ ...p, type: 'PF' })} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id, 'PF')} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
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

        {/* TABLEAU ③ : MARCHANDISES */}
        <div className="space-y-3">
          <h2 className="font-serif font-bold text-lg text-slate-800 flex items-center gap-2">
            <ShoppingBag size={20} className="text-emerald-500" /> Stock Marchandises (Lots Achat / Revente)
          </h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                  <th className="p-3 pl-5">Réf</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3 text-center">Stock Tot.</th>
                  <th className="p-3">Détail des Lots Actifs (FIFO)</th>
                  <th className="p-3 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                {filterItems(inventory?.merchandise?.items)?.map((m: any) => {
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
                                <span className="text-[9px] uppercase tracking-wider">Achat: <strong className="text-emerald-600">{lot.purchasePriceHT?.toFixed(2)}€</strong> | Vente: <strong className="text-indigo-600">{lot.sellingPriceHT?.toFixed(2)}€</strong></span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      {/* ✏️ BOUTON MODIFIER ET 🗑️ SUPPRIMER */}
                      <td className="p-3 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setEditingProduct({ ...m, type: 'MA' })} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteProduct(m.id, 'MA')} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
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

      {/* FORMULAIRES ET HISTORIQUE EN BAS DE PAGE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        
        {/* BLOC 1 : CAISSE ENREGISTREUSE OPTIMISÉE AVEC PANIER MULTI-ARTICLES */}
        <div className="bg-slate-950 p-6 rounded-[2.5rem] text-white space-y-4 shadow-xl self-start">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <ShoppingCart size={18} /> Caisse enregistreuse multi-articles
          </div>
          <h3 className="font-serif font-bold text-xl">Saisie Vente Directe</h3>
          
          <div className="grid grid-cols-2 bg-slate-900 p-1 rounded-xl gap-1">
            <button 
              onClick={() => { setSaleType('PRODUIT_FINI'); setSelectedRef(''); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'PRODUIT_FINI' ? 'bg-indigo-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Confection
            </button>
            <button 
              onClick={() => { setSaleType('MARCHANDISE'); setSelectedRef(''); }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${saleType === 'MARCHANDISE' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Marchandise
            </button>
          </div>

          {/* 🛠️ SOUS-FORMULAIRE LOCAL : AJOUTER UN ARTICLE AU TICKET */}
          <form onSubmit={handleAddToInvoice} className="space-y-3 text-slate-800 text-sm">
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-1">Sélectionner un article</label>
              <select 
                value={selectedRef} 
                onChange={(e) => setSelectedRef(e.target.value)} 
                className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-xs" 
                required
              >
                <option value="">-- Choisir un modèle --</option>
                {inventory && (saleType === 'PRODUIT_FINI' ? inventory.finished.items : inventory.merchandise.items)?.map((item: any) => {
                  const stock = item.lots?.reduce((s: number, l: any) => s + l.quantityLeft, 0) || 0
                  return (
                    <option key={item.id} value={item.reference} disabled={stock <= 0}>
                      [{item.reference}] - {item.name} ({stock} dispo)
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-slate-400 text-xs font-bold mb-1">Quantité</label>
                <input 
                  type="number" 
                  min="1" 
                  value={selectedQty} 
                  onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)}
                  className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold" 
                  required 
                />
              </div>
              <button 
                type="submit"
                className={`p-3 text-xs font-black text-white rounded-xl transition-all shadow-md ${saleType === 'PRODUIT_FINI' ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
              >
                + Ajouter au ticket
              </button>
            </div>
          </form>

          {/* 🛒 RENDER DU PANIER DE NICOLE */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <p className="text-slate-400 text-xs uppercase font-bold tracking-wider">Ticket en cours :</p>
            {cart.length === 0 ? (
              <p className="text-slate-500 text-xs italic py-2">Le ticket est vide. Ajoutez un article ci-dessus.</p>
            ) : (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div key={item.reference} className="flex justify-between items-center text-xs bg-slate-900/50 p-2 border border-slate-900 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-200">{item.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{item.reference} x{item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-400">{(item.priceHT * item.quantity).toFixed(2)}€</span>
                      <button onClick={() => handleRemoveFromCart(item.reference)} className="text-slate-500 hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ⚡ FORMULAIRE FINAL : ENVOI DE LA COMMANDE COMPLÈTE AU BACKEND */}
          <form action={async (formData) => {
            if(cart.length === 0) return alert("Le panier est vide !")
            formData.append('cart', JSON.stringify(cart)) // 👈 Injection du panier JSON
            const res = await recordSale(formData)
            if(!res.success) alert(res.error)
            else { setCart([]); window.location.reload(); }
          }} className="space-y-3 pt-2">
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-1">Moyen de règlement global</label>
              <select name="paymentMethod" className="w-full p-3 bg-slate-900 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 font-bold text-xs">
                <option value="CB">💳 Carte Bancaire</option>
                <option value="ESPECES">💵 Espèces</option>
                <option value="CHEQUE">📝 Chèque</option>
                <option value="VIREMENT">🏦 Virement</option>
              </select>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl flex justify-between items-center border border-slate-800">
              <span className="text-xs text-slate-400 font-bold">Total Général HT</span>
              <span className="text-lg font-serif font-black text-slate-100">{cartTotalHT.toFixed(2)} €</span>
            </div>

            <button 
              type="submit" 
              disabled={cart.length === 0}
              className="w-full py-3.5 bg-white text-slate-950 font-black rounded-xl hover:bg-indigo-400 hover:text-white disabled:bg-slate-800 disabled:text-slate-600 transition-all shadow-md text-xs uppercase tracking-wider"
            >
              🔒 Valider l'encaissement ({cart.length} art.)
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
            else { alert("Catalogue / Lot mis à jour !"); window.location.reload(); }
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
                <input type="number" name="alertThreshold" min="0" defaultValue={addType === 'PF' ? "5" : "3"} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900" />
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

        {/* ========================================== */}
      {/* ✏️ MODAL DE MODIFICATION DE PRODUIT */}
      {/* ========================================== */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative">
            <h3 className="font-serif font-bold text-xl mb-1 text-slate-900">Modifier l'article</h3>
            <p className="text-xs text-slate-500 mb-6 font-mono border-b pb-4">Réf: {editingProduct.reference}</p>
            
            <form action={async (formData) => {
              formData.append('id', editingProduct.id)
              formData.append('type', editingProduct.type)
              const res = await updateProduct(formData)
              if (!res.success) alert(res.error)
              else {
                setEditingProduct(null)
                window.location.reload()
              }
            }} className="space-y-4 text-sm text-slate-700 font-bold">
              
              <div>
                <label className="block text-slate-500 text-xs mb-1">Désignation / Nom</label>
                <input type="text" name="name" defaultValue={editingProduct.name} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500" required />
              </div>
              
              {editingProduct.type === 'PF' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Famille</label>
                    <select name="family" defaultValue={editingProduct.family} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <option value="FITTED">Drap Housse</option>
                      <option value="ENVELOPE">Housse de couette</option>
                      <option value="FLAT">Drap plat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 text-xs mb-1">Dimensions</label>
                    <input type="text" name="dimensions" defaultValue={editingProduct.dimensions} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-500 text-xs mb-1">Catégorie</label>
                  <input type="text" name="category" defaultValue={editingProduct.category} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 text-xs mb-1">Seuil d'Alerte (🚨)</label>
                  <input type="number" name="alertThreshold" defaultValue={editingProduct.alertThreshold} min="0" className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs mb-1">Prix Vente Base HT</label>
                  <input type="number" step="0.01" name="sellingPriceHT" defaultValue={editingProduct.sellingPriceHT} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl" required />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors text-xs uppercase tracking-wider">
                  Annuler
                </button>
                <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 transition-colors text-xs uppercase tracking-wider">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

<div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
          
          {/* 🆕 EN-TÊTE DU JOURNAL ET TON BOUTON FRONT-END */}
          <div className="flex justify-between items-center border-b border-slate-50 pb-2">
            <div>
              <h3 className="font-serif font-bold text-lg text-slate-900">📖 Journal de Caisse</h3>
              <p className="text-slate-400 text-xs">Flux chronologique par tickets d'encaissement</p>
            </div>
            
            <button 
              onClick={handleExportSalesCSV}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs shadow-sm"
            >
              <Download size={12} /> Export Journal
            </button>
          </div>
{/* ZONE D'AFFICHAGE DES TICKETS */}
          <div className="max-h-[380px] overflow-y-auto space-y-3 pr-2">
            {groupedJournalArray.length === 0 ? (
              <p className="text-slate-400 text-center py-12 text-sm">Aucune transaction enregistrée.</p>
            ) : (
              groupedJournalArray.map((ticket: any) => (
                <div key={ticket.ticketId + ticket.createdAt} className="bg-slate-50 rounded-xl p-3 border border-slate-100 hover:border-indigo-100 transition-colors shadow-sm">
                  
                  {/* EN-TÊTE DU TICKET (Gris foncé) */}
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                    <div>
                      <span className="font-bold text-slate-800 text-xs">
                        {ticket.ticketId !== "Vente isolée" ? `🧾 Ticket ${ticket.ticketId}` : "🧾 Ancienne Vente"}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2">
                        {new Date(ticket.createdAt).toLocaleDateString('fr-FR')} à {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-bold mr-2 tracking-wider">MOD: {ticket.paymentMethod}</span>
                      <span className="font-black text-indigo-600 text-sm">+{ticket.totalTicketHT.toFixed(2)} €</span>
                    </div>
                  </div>
                  
                  {/* LISTE DES ARTICLES DANS CE TICKET */}
                  <div className="space-y-1.5 pl-1">
                    {ticket.items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1 py-0.5 rounded text-[8px] font-black tracking-wider ${item.type === 'PRODUIT_FINI' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {item.type === 'PRODUIT_FINI' ? 'PF' : 'MA'}
                          </span>
                          <span className="text-slate-600">
                            <strong>{item.quantitySold}x</strong> {item.name} <span className="font-mono text-[9px] text-slate-400">({item.referenceItem})</span>
                          </span>
                        </div>
                        <span className="text-slate-700 font-bold">{item.totalPriceHT.toFixed(2)} €</span>
                      </div>
                    ))}
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