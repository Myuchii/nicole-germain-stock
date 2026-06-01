import { PrismaClient } from '@prisma/client'
import Link from 'next/link'
import RevenueChart from '@/components/RevenueChart'
import { 
  TrendingUp, 
  Package, 
  Euro, 
  Download, 
  Users,
  ShoppingCart,
  Award,
  Calendar,
  Building2,
  User,
  ArrowDown,
  BarChart3
} from 'lucide-react'

export const dynamic = 'force-dynamic'
const prisma = new PrismaClient()

// 🛠️ Typage pour les paramètres d'URL asynchrones (Next.js 15+)
export default async function DashboardPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ period?: string }> 
}) {
  const resolvedParams = await searchParams
  const period = resolvedParams.period || 'month'

  // --- 1. LOGIQUE DES FILTRES DE TEMPS ---
  const now = new Date()
  let startDate = new Date()
  let periodLabel = "ce mois-ci"

  if (period === 'day') {
    startDate.setHours(0, 0, 0, 0)
    periodLabel = "aujourd'hui"
  } else if (period === 'week') {
    startDate.setDate(now.getDate() - 7) // 7 derniers jours
    periodLabel = "ces 7 derniers jours"
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1) // Depuis le 1er Janvier
    periodLabel = "cette année"
  } else {
    // Par défaut : Mois en cours
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

// --- 2. REQUÊTES BDD PARALLÈLES ---
  const [
    periodQuotes,
    allClients,
    allQuoteItems,
    fabrics,
    finishedProductsRaw, // 🆕 Récupération des Produits Finis
    merchandiseRaw       // 🆕 Récupération des Marchandises avec leurs lots
  ] = await Promise.all([
    prisma.quote.findMany({
      where: { status: 'VALIDATED', createdAt: { gte: startDate } },
    }),
    prisma.client.findMany(),
    prisma.quoteItem.findMany({
      where: { quote: { status: 'VALIDATED', createdAt: { gte: startDate } } },
      include: { fabric: true }
    }),
    prisma.fabric.findMany({ where: { isArchived: false } }),
    
    // 🆕 Les produits finis qui sont en stock
    prisma.finishedProduct.findMany({ 
      where: { stockQuantity: { gt: 0 } }
    }),
    
    // 🆕 Les marchandises (on inclut les lots pour calculer le stock restant)
    prisma.merchandise.findMany({
      include: { lots: true }
    })
  ])

  // 🆕 FUSION ET TRI DES STOCKS BOUTIQUE (PF + Marchandises)
  const mappedMerchandise = merchandiseRaw.map(m => ({
    name: m.name,
    stock: m.lots.reduce((sum, lot) => sum + lot.quantityLeft, 0),
    type: 'Marchandise'
  })).filter(m => m.stock > 0)

  const mappedFinishedProducts = finishedProductsRaw.map(fp => ({
    name: fp.name,
    stock: fp.stockQuantity,
    type: 'Produit Fini'
  }))

  const topBoutiqueDormants = [...mappedFinishedProducts, ...mappedMerchandise]
    .sort((a, b) => b.stock - a.stock) // Du plus grand stock au plus petit
    .slice(0, 3) // On garde le Top 3

  // --- 3. CALCUL DES KPIS ---
  // Chiffre d'affaires & Panier Moyen
  const totalRevenue = periodQuotes.reduce((sum, q) => sum + Number(q.totalPrice), 0)
  const orderCount = periodQuotes.length
  const panierMoyen = orderCount > 0 ? totalRevenue / orderCount : 0

  // Typologie Clients
  const b2bClients = allClients.filter(c => c.company !== null && c.company.trim() !== '')
  const b2cClients = allClients.filter(c => !c.company || c.company.trim() === '')
  const b2bPercent = allClients.length > 0 ? Math.round((b2bClients.length / allClients.length) * 100) : 0
  const b2cPercent = allClients.length > 0 ? 100 - b2bPercent : 0

  // --- 🆕 PRÉPARATION DES DONNÉES DU GRAPHIQUE ---
  const chartDataMap = new Map<string, number>()

  if (period === 'year') {
    // Par mois
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    months.forEach(m => chartDataMap.set(m, 0))
    periodQuotes.forEach(q => {
      const m = months[q.createdAt.getMonth()]
      chartDataMap.set(m, chartDataMap.get(m)! + Number(q.totalPrice))
    })
  } else if (period === 'week') {
    // 7 derniers jours glissants
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' })
      chartDataMap.set(label.charAt(0).toUpperCase() + label.slice(1), 0)
    }
    periodQuotes.forEach(q => {
      const label = q.createdAt.toLocaleDateString('fr-FR', { weekday: 'short' })
      const cleanLabel = label.charAt(0).toUpperCase() + label.slice(1)
      if (chartDataMap.has(cleanLabel)) {
        chartDataMap.set(cleanLabel, chartDataMap.get(cleanLabel)! + Number(q.totalPrice))
      }
    })
  } else if (period === 'month') {
    // Par jour du mois (1 au 31)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      chartDataMap.set(`${i}`, 0)
    }
    periodQuotes.forEach(q => {
      const day = `${q.createdAt.getDate()}`
      if (chartDataMap.has(day)) chartDataMap.set(day, chartDataMap.get(day)! + Number(q.totalPrice))
    })
  } else if (period === 'day') {
    // Par heure (de 8h à 20h)
    for (let i = 8; i <= 20; i++) {
      chartDataMap.set(`${i}h`, 0)
    }
    periodQuotes.forEach(q => {
      const hour = `${q.createdAt.getHours()}h`
      if (chartDataMap.has(hour)) chartDataMap.set(hour, chartDataMap.get(hour)! + Number(q.totalPrice))
    })
  }

  const chartData = Array.from(chartDataMap.entries()).map(([label, total]) => ({ label, total }))

  // Best-sellers (Calcul des tissus les plus vendus en métrage)
  const fabricSales = new Map<string, { name: string, meters: number }>()
  allQuoteItems.forEach(item => {
      if (item.fabricId && item.fabric) { // 👈 On vérifie que l'ID n'est pas null !
        const current = fabricSales.get(item.fabricId) || { name: item.fabric.name, meters: 0 } // (garde le reste de ta ligne tel quel)
        // (garde la ligne fabricSales.set... telle quelle)
        fabricSales.set(item.fabricId, { name: item.fabric.name, meters: current.meters + Number(item.quantityMeters || 0) })
      }
    })
  const topFabrics = Array.from(fabricSales.values())
    .sort((a, b) => b.meters - a.meters)
    .slice(0, 3) // On garde le Top 3

  // Worst-sellers (Ceux à 0 mètre vendu sur la période)
  const soldFabricIds = new Set(allQuoteItems.map(i => i.fabricId))
  const worstFabrics = fabrics
      .filter(f => !soldFabricIds.has(f.id) && (f.stockMeters || 0) > 0)
      .sort((a, b) => (b.stockMeters || 0) - (a.stockMeters || 0)) // Ceux qui prennent le plus de place...
      .slice(0, 3)
  // Valeur totale du stock actuel
  const stockValue = fabrics.reduce((sum, f) => sum + ((f.stockMeters || 0) * Number(f.pricePerMeter)), 0)

  // Composant bouton de filtre
  const FilterButton = ({ value, label }: { value: string, label: string }) => (
    <Link href={`/dashboard?period=${value}`}>
      <button className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${period === value ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
        {label}
      </button>
    </Link>
  )

  // --- NOUVEAU : CALCULS GÉOGRAPHIQUES ---
  // 1. Top Pays
  const countryMap = new Map<string, number>()
  allClients.forEach(c => {
    // Si vide, on assume France par défaut
    const country = (c.country || 'France').trim() 
    // On met la première lettre en majuscule pour faire propre
    const cleanCountry = country.charAt(0).toUpperCase() + country.slice(1).toLowerCase()
    countryMap.set(cleanCountry, (countryMap.get(cleanCountry) || 0) + 1)
  })
  const topCountries = Array.from(countryMap.entries())
    .sort((a, b) => b[1] - a[1]) // Trie du plus grand au plus petit
    .slice(0, 3) // On garde le Top 3

  // 2. Top Départements (Uniquement pour les codes postaux français)
  const deptMap = new Map<string, number>()
  allClients.forEach(c => {
    const country = (c.country || 'France').trim().toLowerCase()
    if ((country === 'france' || country === 'fr') && c.zipCode && c.zipCode.length >= 2) {
      // On prend les 2 premiers chiffres du code postal
      const dept = c.zipCode.substring(0, 2)
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1)
    }
  })
  const topDepts = Array.from(deptMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4) // On garde le Top 4 des départements

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      
      {/* EN-TÊTE & FILTRES TEMPORELS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Business Intelligence</h1>
          <p className="text-slate-500">Performances, ventes et rapports d'exportation.</p>
        </div>
        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <FilterButton value="day" label="Aujourd'hui" />
          <FilterButton value="week" label="7 Jours" />
          <FilterButton value="month" label="Ce mois" />
          <FilterButton value="year" label="Cette année" />
        </div>
      </div>

      {/* --- LIGNE 1 : KPIs PERFORMANCES --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* --- 🆕 LIGNE 1.5 : GRAPHIQUE D'ÉVOLUTION --- */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-indigo-500" /> Évolution du Chiffre d'Affaires
          </h2>
          <span className="text-sm font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">
            {periodLabel}
          </span>
        </div>
        
        {/* Le composant Recharts que nous venons de créer */}
        <RevenueChart data={chartData} />
      </div>

        {/* PANIER MOYEN */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-6">
          <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
            <ShoppingCart size={32} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Panier Moyen</p>
            <h2 className="text-3xl font-black text-slate-800">{panierMoyen.toFixed(2)} €</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Par commande client</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          
          {/* B2B vs B2C */}
          <div>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={14}/> Typologie Base Clients
            </p>
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-2xl font-black text-indigo-600">{b2bPercent}% <Building2 size={16} className="inline text-indigo-300"/></p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Professionnels</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-emerald-600"><User size={16} className="inline text-emerald-300"/> {b2cPercent}%</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Particuliers</p>
              </div>
            </div>
            <div className="w-full bg-emerald-100 rounded-full h-2 flex overflow-hidden">
              <div className="bg-indigo-500 h-2" style={{ width: `${b2bPercent}%` }}></div>
            </div>
          </div>

          {/* 🆕 Localisation Géographique */}
          <div className="mt-5 pt-5 border-t border-slate-50 space-y-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Top Pays</p>
              <div className="flex flex-wrap gap-1.5">
                {topCountries.map(([country, count]) => (
                  <span key={country} className="text-[11px] font-bold bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md border border-slate-100">
                    {country} <span className="text-slate-400 font-medium">({count})</span>
                  </span>
                ))}
              </div>
            </div>

            {topDepts.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Top Départements (FR)</p>
                <div className="flex flex-wrap gap-1.5">
                  {topDepts.map(([dept, count]) => (
                    <span key={dept} className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
                      Dép. {dept} <span className="opacity-60">({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

      {/* --- LIGNE 2 : PALMARÈS & EXPORTS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLONNE GAUCHE : BEST-SELLERS */}
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
            <Award className="text-amber-500" /> Top Matières ({periodLabel})
          </h2>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            {topFabrics.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucune vente sur cette période.</p>
            ) : (
              topFabrics.map((fabric, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 font-black flex items-center justify-center text-xs">#{idx + 1}</div>
                    <span className="font-bold text-slate-700 text-sm">{fabric.name}</span>
                  </div>
                  <span className="font-bold text-emerald-600 text-sm">{fabric.meters.toFixed(1)}m</span>
                </div>
              ))
            )}
          </div>

          <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2 mt-8">
            <ArrowDown className="text-red-500" /> Dormants (Worst-Sellers)
          </h2>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <p className="text-xs text-slate-400 font-bold mb-2">Gros stocks avec 0 vente sur la période :</p>
            {worstFabrics.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Tout le stock tourne bien !</p>
            ) : (
              worstFabrics.map((fabric, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="font-bold text-slate-600 text-sm">{fabric.name}</span>
                  <span className="font-bold text-red-500 text-sm">{(fabric.stockMeters || 0).toFixed(1)}m dispo</span>
                </div>
              ))
            )}
          </div>
          {/* 🚨 STOCK DORMANT BOUTIQUE (PF & MARCHANDISES) */}
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2 mb-3">
              <Package className="text-red-500" /> Dormants (Boutique)
            </h2>
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Gros stocks sur étagère :</p>
              {topBoutiqueDormants.length === 0 ? (
                <p className="text-sm text-slate-400 italic">La boutique a été dévalisée !</p>
              ) : (
                topBoutiqueDormants.map((product, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-600 text-sm truncate max-w-[150px] block" title={product.name}>
                        {product.name}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">{product.type}</span>
                    </div>
                    <span className="font-bold text-red-500 text-xs bg-red-50 px-2 py-1 rounded-md">
                      {product.stock} unités
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : CENTRALE D'EXPORT (Prend 2 colonnes) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
            <Download className="text-indigo-500" /> Centrale d'Exportation CSV
          </h2>
          
          <div className="grid sm:grid-cols-2 gap-4">
            
            {/* EXPORT STOCK */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-300 transition-colors">
              <div>
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-max mb-4">
                  <Package size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Inventaire Global (Stock)</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Valeur totale immobilisée actuelle : <strong className="text-slate-700">{stockValue.toFixed(2)} €</strong>. Exporte l'état précis des rouleaux et produits finis.</p>
              </div>
              <a href="/api/export/stock" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-indigo-600 transition-colors">
                <Download size={16} /> Télécharger l'inventaire
              </a>
            </div>

            {/* EXPORT CLIENTS */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-emerald-300 transition-colors">
              <div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-max mb-4">
                  <Users size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-800">Statistiques Clients (CRM)</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">Base de données complète des {allClients.length} clients avec leurs coordonnées et informations de typologie.</p>
              </div>
              <a href="/api/export/clients" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-emerald-600 transition-colors">
                <Download size={16} /> Exporter les clients
              </a>
            </div>

            {/* EXPORT ATELIER */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-amber-300 transition-colors sm:col-span-2">
              <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-4">
                <div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl w-max mb-4">
                    <Calendar size={24} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">Rapport d'Activité Atelier</h3>
                  <p className="text-sm text-slate-500 mt-1">Temps de confection total, articles coupés, et statuts de production sur la période sélectionnée.</p>
                </div>
                <a href="/api/export/atelier" className="w-full md:w-auto px-6 py-4 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors whitespace-nowrap">
                  <Download size={16} /> Exporter l'activité
                </a>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}