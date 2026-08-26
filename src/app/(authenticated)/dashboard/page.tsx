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
  BarChart3,
  ChevronLeft, 
  ChevronRight,
  Palette,
  Scissors,
  Gauge,
  AlertOctagon,
  TrendingDown
} from 'lucide-react'

export const dynamic = 'force-dynamic'
const prisma = new PrismaClient()

// 🟢 Le dictionnaire officiel de traduction pour passer l'anglais technique en français
const familyLabels: Record<string, string> = { 
  FITTED: 'Drap housse', 
  FLAT: 'Drap plat', 
  ENVELOPE: 'Housse de couette', 
  ROUND: 'Drap rond', 
  BOLSTER: 'Traversin', 
  ALESE: 'Protège matelas',
  CUSTOM: 'Sur-mesure',
  'SUR-MESURE': 'Sur-mesure'
}

export default async function DashboardPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ period?: string; offset?: string }> 
}) {
  // --- 1. LOGIQUE DES FILTRES DE TEMPS DYNAMIQUES ANNEE N ---
  const resolvedParams = await searchParams
  const period = resolvedParams.period || 'month'
  const offset = resolvedParams.offset ? parseInt(resolvedParams.offset) : 0

  const now = new Date()
  let startDate = new Date()
  let endDate = new Date()
  let periodLabel = ""

  const prevOffset = offset + 1
  const nextOffset = offset - 1

  if (period === 'day') {
    startDate.setDate(now.getDate() - offset)
    startDate.setHours(0, 0, 0, 0)
    endDate.setDate(now.getDate() - offset)
    endDate.setHours(23, 59, 59, 999)

    periodLabel = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    if (offset === 0) periodLabel = "Aujourd'hui"
    if (offset === 1) periodLabel = "Hier"

  } else if (period === 'week') {
    startDate.setDate(now.getDate() - 7 - (offset * 7))
    startDate.setHours(0, 0, 0, 0)
    endDate.setDate(now.getDate() - (offset * 7))
    endDate.setHours(23, 59, 59, 999)

    periodLabel = `Du ${startDate.getDate()}/${startDate.getMonth()+1} au ${endDate.getDate()}/${endDate.getMonth()+1}`

  } else if (period === 'year') {
    const targetYear = now.getFullYear() - offset
    startDate = new Date(targetYear, 0, 1)
    endDate = new Date(targetYear, 11, 31, 23, 59, 59)
    periodLabel = `Année ${targetYear}`

  } else {
    const targetMonth = now.getMonth() - offset
    startDate = new Date(now.getFullYear(), targetMonth, 1)
    endDate = new Date(now.getFullYear(), targetMonth + 1, 0, 23, 59, 59)
    periodLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }

  // FENÊTRE DE TEMPS DYNAMIQUE ANNEE N-1
  const startDatePrev = new Date(startDate)
  startDatePrev.setFullYear(startDate.getFullYear() - 1)
  
  const endDatePrev = new Date(endDate)
  endDatePrev.setFullYear(endDate.getFullYear() - 1)

  const prevPeriodUrl = `/dashboard?period=${period}&offset=${prevOffset}`
  const nextPeriodUrl = `/dashboard?period=${period}&offset=${nextOffset}`
  const hasNextPeriod = offset > 0

// --- 2. REQUÊTES BDD (INCLUANT N-1) ---
  const [
    periodQuotes,
    periodQuotesPrev, 
    allClients,
    allQuoteItems,
    fabrics,
    finishedProductsRaw,
    merchandiseRaw,
    allTimedItems,
    returnedQuotesRaw
  ] = await Promise.all([
    prisma.quote.findMany({
      // 🟢 FIX : On inclut VALIDATED et ARCHIVED
      where: { status: { in: ['VALIDATED', 'ARCHIVED'] }, validatedAt: { gte: startDate, lte: endDate } }, 
    }),
    prisma.quote.findMany({
      // 🟢 FIX : On inclut VALIDATED et ARCHIVED
      where: { status: { in: ['VALIDATED', 'ARCHIVED'] }, validatedAt: { gte: startDatePrev, lte: endDatePrev } }, 
    }),
    prisma.client.findMany(),
    prisma.quoteItem.findMany({
      // 🟢 FIX : On inclut VALIDATED et ARCHIVED
      where: { quote: { status: { in: ['VALIDATED', 'ARCHIVED'] }, validatedAt: { gte: startDate } } },
      include: { fabric: true, quote: true }
    }),
    prisma.fabric.findMany({ where: { isArchived: false } }),
    prisma.finishedProduct.findMany({ where: { stockQuantity: { gt: 0 } } }),
    prisma.merchandise.findMany({ include: { lots: true } }),
    prisma.quoteItem.findMany({
      where: { finishedAt: { not: null }, startedCoutureAt: { not: null } },
      include: { quote: true }
    }),
    prisma.quote.findMany({
      where: { returnReason: { not: null } }
    })
  ])

  // --- 3. TRAITEMENT DES MEILLEURES ET PIRES VENTES ---
  const colorSalesMap = new Map<string, number>()
  const productSalesMap = new Map<string, number>()

  allQuoteItems.forEach(item => {
    if (item.fabric?.color) {
      const colorClean = item.fabric.color.trim().toUpperCase()
      colorSalesMap.set(colorClean, (colorSalesMap.get(colorClean) || 0) + Number(item.quantityMeters || 0))
    }
    const jsonProducts = (item.quote.products as any[]) || []
    const matched = jsonProducts.find(p => p.fabricId === item.fabricId) || jsonProducts[0]
    if (matched?.family) {
      // 🟢 Traduction directe de la famille en français avant de l'ajouter aux statistiques
      const frenchFamily = familyLabels[matched.family] || matched.family
      productSalesMap.set(frenchFamily, (productSalesMap.get(frenchFamily) || 0) + 1)
    }
  })

  const topColors = Array.from(colorSalesMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const topProducts = Array.from(productSalesMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const fabricSales = new Map<string, { name: string, meters: number }>()
  allQuoteItems.forEach(item => {
    if (item.fabricId && item.fabric) {
      const current = fabricSales.get(item.fabricId) || { name: item.fabric.name, meters: 0 }
      fabricSales.set(item.fabricId, { name: item.fabric.name, meters: current.meters + Number(item.quantityMeters || 0) })
    }
  })
  const topFabrics = Array.from(fabricSales.values()).sort((a, b) => b.meters - a.meters).slice(0, 3)

  const soldFabricIds = new Set(allQuoteItems.map(i => i.fabricId))
  const worstFabrics = fabrics
      .filter(f => !soldFabricIds.has(f.id) && (f.stockMeters || 0) > 0)
      .sort((a, b) => (b.stockMeters || 0) - (a.stockMeters || 0))
      .slice(0, 3)

  const worstColors = fabrics
      .filter(f => f.color && !colorSalesMap.has(f.color.trim().toUpperCase()) && (f.stockMeters || 0) > 0)
      .map(f => ({ color: f.color.trim().toUpperCase(), stock: f.stockMeters || 0 }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 3)

  // --- AUTRES CALCULS & TRADUCTION DES CHRONOMÈTRES ---
  const familyChronoStats = new Map<string, { totalRealMinutes: number, totalItemsCount: number, theoretical: number }>()
  allTimedItems.forEach(item => {
    const jsonProducts = (item.quote.products as any[]) || []
    const matched = jsonProducts.find(p => p.fabricId === item.fabricId) || jsonProducts[0]
    
    // 🟢 Traduction de la clé de famille pour les statistiques d'audits chrono
    const rawFamily = matched?.family || 'SUR-MESURE'
    const family = familyLabels[rawFamily] || rawFamily

    if (item.finishedAt && item.startedCoutureAt) {
      const realMin = Math.round((new Date(item.finishedAt).getTime() - new Date(item.startedCoutureAt).getTime()) / 1000 / 60)
      const current = familyChronoStats.get(family) || { totalRealMinutes: 0, totalItemsCount: 0, theoretical: item.prodTimeMinutes || 30 }
      familyChronoStats.set(family, { totalRealMinutes: current.totalRealMinutes + realMin, totalItemsCount: current.totalItemsCount + 1, theoretical: item.prodTimeMinutes || current.theoretical })
    }
  })
  const chronoAverages = Array.from(familyChronoStats.entries()).map(([family, data]) => ({ family, count: data.totalItemsCount, avgReal: Math.round(data.totalRealMinutes / data.totalItemsCount), avgTheo: data.theoretical }))

  const returnReasonsMap = new Map<string, number>()
  returnedQuotesRaw.forEach(q => { if (q.returnReason) returnReasonsMap.set(q.returnReason, (returnReasonsMap.get(q.returnReason) || 0) + 1) })
  const listReturnReasons = Array.from(returnReasonsMap.entries()).sort((a, b) => b[1] - a[1])

  const mappedMerchandise = merchandiseRaw.map(m => ({ name: m.name, stock: m.lots.reduce((sum, lot) => sum + lot.quantityLeft, 0), type: 'Marchandise' })).filter(m => m.stock > 0)
  const mappedFinishedProducts = finishedProductsRaw.map(fp => ({ name: fp.name, stock: fp.stockQuantity, type: 'Produit Fini' }))
  const topBoutiqueDormants = [...mappedFinishedProducts, ...mappedMerchandise].sort((a, b) => b.stock - a.stock).slice(0, 3)

  const totalRevenue = periodQuotes.reduce((sum, q) => sum + Number(q.totalPrice), 0)
  const orderCount = periodQuotes.length
  const panierMoyen = orderCount > 0 ? totalRevenue / orderCount : 0
  const b2bClients = allClients.filter(c => c.company !== null && c.company.trim() !== '')
  const b2bPercent = allClients.length > 0 ? Math.round((b2bClients.length / allClients.length) * 100) : 0
  const b2cPercent = allClients.length > 0 ? 100 - b2bPercent : 0

  // --- CONSTRUCTION COMPOSANT CHART ---
  const chartDataMap = new Map<string, { current: number, previous: number }>()

  if (period === 'year') {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
    months.forEach(m => chartDataMap.set(m, { current: 0, previous: 0 }))
    
    periodQuotes.forEach(q => {
      const d = q.validatedAt || q.createdAt
      const data = chartDataMap.get(months[d.getMonth()])!
      data.current += Number(q.totalPrice)
    })
    periodQuotesPrev.forEach(q => {
      const d = q.validatedAt || q.createdAt
      const data = chartDataMap.get(months[d.getMonth()])!
      data.previous += Number(q.totalPrice)
    })

  } else if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
      chartDataMap.set(label, { current: 0, previous: 0 })
    }
    periodQuotes.forEach(q => {
      const d = q.validatedAt || q.createdAt
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
      if (chartDataMap.has(label)) chartDataMap.get(label)!.current += Number(q.totalPrice)
    })
    periodQuotesPrev.forEach(q => {
      const d = q.validatedAt || q.createdAt
      const dayOffset = (d.getDay() - startDatePrev.getDay() + 7) % 7
      const targetLabel = Array.from(chartDataMap.keys())[dayOffset]
      if (targetLabel) chartDataMap.get(targetLabel)!.previous += Number(q.totalPrice)
    })

  } else if (period === 'month') {
    const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) chartDataMap.set(`${i}`, { current: 0, previous: 0 })
    
    periodQuotes.forEach(q => {
      const d = q.validatedAt || q.createdAt
      const day = `${d.getDate()}`
      if (chartDataMap.has(day)) chartDataMap.get(day)!.current += Number(q.totalPrice)
    })
    periodQuotesPrev.forEach(q => {
      const d = q.validatedAt || q.createdAt
      const day = `${d.getDate()}`
      if (chartDataMap.has(day)) chartDataMap.get(day)!.previous += Number(q.totalPrice)
    })
  } else {
    chartDataMap.set(periodLabel, { current: totalRevenue, previous: periodQuotesPrev.reduce((sum, q) => sum + Number(q.totalPrice), 0) })
  }

  const chartData = Array.from(chartDataMap.entries()).map(([label, values]) => ({ 
    label, 
    current: values.current, 
    previous: values.previous 
  }))

  const FilterButton = ({ value, label }: { value: string, label: string }) => (
    <Link href={`/dashboard?period=${value}`}>
      <button className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${period === value ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'}`}>
        {label}
      </button>
    </Link>
  )

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Business Intelligence</h1>
          <p className="text-slate-500">Analyses comparatives N vs N-1, ventes de l'atelier et gestion des dormants.</p>
        </div>
        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <FilterButton value="day" label="Aujourd'hui" />
          <FilterButton value="week" label="7 Jours" />
          <FilterButton value="month" label="Ce mois" />
          <FilterButton value="year" label="Cette année" />
        </div>
      </div>

      {/* GRILLE DU CHIFFRE D'AFFAIRES COMPARATIF */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-serif font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="text-indigo-500" size={20} /> Analyse Comparative de Croissance
            </h2>
            
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
              <Link href={prevPeriodUrl} className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 transition-all flex items-center justify-center">
                <ChevronLeft size={16} strokeWidth={2.5} />
              </Link>
              <span className="text-xs font-black text-slate-600 px-2 uppercase tracking-wider min-w-[120px] text-center">
                {periodLabel}
              </span>
              {hasNextPeriod ? (
                <Link href={nextPeriodUrl} className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 transition-all flex items-center justify-center">
                  <ChevronRight size={16} strokeWidth={2.5} />
                </Link>
              ) : (
                <span className="p-1 text-slate-200 cursor-not-allowed flex items-center justify-center">
                  <ChevronRight size={16} strokeWidth={2.5} />
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider mb-4 pl-1">
            <div className="flex items-center gap-1.5 text-indigo-600">
              <span className="w-3 h-3 rounded bg-indigo-600 block"></span> Période Cible (N)
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-3 rounded bg-slate-300 block"></span> Année Précédente (N-1)
            </div>
          </div>
          
          <RevenueChart data={chartData} />
        </div>

        <div className="space-y-6 flex flex-col justify-between">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 flex-1">
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><ShoppingCart size={28} /></div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider">Panier Moyen</p>
              <h2 className="text-2xl font-black text-slate-800 mt-0.5">{panierMoyen.toFixed(2)} €</h2>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-wider mb-3 flex items-center gap-1"><Users size={12}/> Typologie Base Clients</p>
            <div className="flex justify-between text-xs font-bold mb-1.5">
              <span className="text-indigo-600">Pros : {b2bPercent}%</span>
              <span className="text-emerald-600">Particuliers : {b2cPercent}%</span>
            </div>
            <div className="w-full bg-emerald-100 rounded-full h-2 flex overflow-hidden">
              <div className="bg-indigo-500 h-2" style={{ width: `${b2bPercent}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* CHRONOMÈTRES TRADUITS */}
      <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-xl font-serif font-bold text-white flex items-center gap-2">
            <Gauge className="text-rose-400" /> Contrôle des Chronomètres (Objectif 10x / an)
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 font-bold px-3 py-1 rounded-full">Année {now.getFullYear()}</span>
        </div>
        {chronoAverages.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4">Aucune donnée d'audit chrono enregistrée pour le moment.</p>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {chronoAverages.map((stat, i) => {
              const gap = stat.avgReal - stat.avgTheo
              const isOvertime = gap > 0
              return (
                <div key={i} className="bg-slate-800/60 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-slate-200 uppercase tracking-wide">{stat.family}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${stat.count >= 10 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{stat.count}/10 pièces</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-center border-y border-slate-700/30 py-2">
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Moy. Réelle</p><p className="text-lg font-black font-mono text-white">{stat.avgReal} min</p></div>
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Théorique</p><p className="text-lg font-black font-mono text-slate-400">{stat.avgTheo} min</p></div>
                    </div>
                  </div>
                  <p className={`text-xs font-semibold flex justify-between px-1 ${isOvertime ? 'text-rose-400' : 'text-emerald-400'}`}>
                    <span>⚠️ Écart constaté :</span><span className="font-black font-mono">{isOvertime ? `+${gap}` : gap} min</span>
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PALMARÈS EN FRANÇAIS (Top Confections inclut les libellés traduits) */}
      <div className="space-y-3">
        <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp className="text-emerald-500" size={22} /> Palmarès des Succès (Best-Sellers {periodLabel})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Award size={12} className="text-amber-500"/> Top Matières Vendu</h3>
            <div className="space-y-2 pt-1">
              {topFabrics.map((f, i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                  <span className="truncate max-w-[150px]">#{i+1} {f.name}</span>
                  <span className="text-emerald-600 font-mono">{f.meters.toFixed(1)}m</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Palette size={12} className="text-indigo-500"/> Top Coloris Demandé</h3>
            <div className="space-y-2 pt-1">
              {topColors.map(([color, meters], i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                  <span>#{i+1} {color}</span>
                  <span className="text-indigo-600 font-mono">{meters.toFixed(1)}m</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Package size={12} className="text-amber-500"/> Top Confections</h3>
            <div className="space-y-2 pt-1">
              {topProducts.map(([family, count], i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                  <span className="uppercase tracking-wide">#{i+1} {family}</span>
                  <span className="text-amber-600 font-mono">{count} u.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
          <TrendingDown className="text-rose-500" size={22} /> Le Coin des Dormants (Worst-Sellers)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Scissors size={12} className="text-rose-500"/> Tissus Immo. (0 vente)</h3>
            <div className="space-y-2 pt-1">
              {worstFabrics.length === 0 ? <p className="text-xs text-slate-400 italic">Aucun tissu stagnant</p> : worstFabrics.map((f, i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                  <span className="truncate max-w-[150px] font-medium text-slate-600">{f.name}</span>
                  <span className="text-rose-500 font-mono">{(f.stockMeters || 0).toFixed(1)}m</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Palette size={12} className="text-rose-500"/> Coloris Bloqués (0 vente)</h3>
            <div className="space-y-2 pt-1">
              {worstColors.length === 0 ? <p className="text-xs text-slate-400 italic">Aucun coloris stagnant</p> : worstColors.map((c, i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                  <span className="font-medium text-slate-600">{c.color}</span>
                  <span className="text-rose-500 font-mono">{c.stock.toFixed(1)}m</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1"><Package size={12} className="text-rose-500"/> Étagères Boutique Pleines</h3>
            <div className="space-y-2 pt-1">
              {topBoutiqueDormants.map((product, i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-slate-700">
                  <div className="truncate max-w-[140px]"><span className="font-medium text-slate-600">{product.name}</span><span className="text-[9px] text-slate-400 block uppercase">{product.type}</span></div>
                  <span className="text-rose-600 font-mono">{product.stock} u.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="bg-rose-50/60 p-5 rounded-3xl border border-rose-100 shadow-sm space-y-3 lg:col-span-1">
          <h3 className="font-serif font-bold text-rose-900 text-sm flex items-center gap-1.5"><AlertOctagon size={16} className="text-rose-600" /> Raisons des Retours SAV</h3>
          <div className="space-y-2 pt-1">
            {listReturnReasons.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Excellent ! Zéro retour enregistré.</p>
            ) : (
              listReturnReasons.map(([reason, count], i) => (
                <div key={i} className="flex justify-between text-xs font-bold text-rose-900">
                  <span className="truncate max-w-[180px] font-medium">{reason}</span>
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-mono text-[10px]">{count} colis</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <h3 className="font-serif font-bold text-slate-800 text-sm flex items-center gap-1.5"><Download size={16} className="text-indigo-500"/> Téléchargement des rapports financiers</h3>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <a href="/api/export/stock" className="p-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold text-[11px] text-center transition-colors">📦 Inventaire .CSV</a>
            <a href="/api/export/clients" className="p-3 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl font-bold text-[11px] text-center transition-colors">👥 CRM Clients .CSV</a>
            <a href="/api/export/atelier" className="p-3 bg-slate-900 hover:bg-amber-600 text-white rounded-xl font-bold text-[11px] text-center transition-colors">✂️ Rapports Atelier .CSV</a>
          </div>
        </div>
      </div>
    </div>
  )
}