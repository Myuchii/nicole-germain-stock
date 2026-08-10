export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { Scissors, Shirt, Package, Layers, AlertTriangle, Palette, ArrowLeft, Filter } from 'lucide-react'
import ProductionCard from '@/components/ProductionCard'
import { validateCuttingStep, rollbackToCouture, rollbackToCutting, linkFabricToItem } from '@/app/_actions/atelier-actions'
import { getAtelierSettings } from '@/app/_actions/settings-actions' 
import SyncWebButton from '@/components/SyncWebButton'
import BulkCutForm from '@/components/BulkCutForm'
import { shipBulkOrder } from '@/app/_actions/atelier-actions'
import Link from 'next/link'

// 🛠️ Le Traducteur Local : Extraction chirurgicale (Mise à jour Bicolore & Volants)
function parsePrestashopProductLocal(productName: string) {
  let family = 'CUSTOM'
  let subFamilyLabel = ''
  const textLower = productName.toLowerCase()
  
  const isRoundStructure = textLower.includes('rond') || textLower.includes('ronde') || textLower.includes('bulle')
  const isProtegeMatelas = textLower.includes('protè') || textLower.includes('prote') || textLower.includes('alès') || textLower.includes('ales')
  const hasHousse = textLower.includes('housse')
  const hasCouette = textLower.includes('couette')
  const hasVolant = textLower.includes('volant')

  // 1️⃣ IDENTIFICATION DE LA FAMILLE TECHNIQUE
  if (isRoundStructure) {
    family = 'ROUND'
  } else if (hasHousse && textLower.includes('drap')) {
    family = 'FITTED'
  } else if (textLower.includes('drap') && textLower.includes('plat')) {
    family = 'FLAT'
  } else if (hasCouette) {
    family = 'ENVELOPE'
  } else if (textLower.includes('traversin')) {
    family = 'BOLSTER'
  } else if (isProtegeMatelas) {
    family = 'FITTED'
  } else if (hasVolant) {
    family = 'CUSTOM' // Taie avec volant ou coussin
  }

  // 2️⃣ LIBELLÉ D'AFFICHAGE PRÉCIS
  if (isProtegeMatelas) {
    subFamilyLabel = isRoundStructure ? 'Protège matelas rond' : 'Protège matelas'
  }
  else if (hasCouette && !hasHousse) {
    subFamilyLabel = 'Couette'
  }
  else if (hasCouette && hasHousse) {
    subFamilyLabel = 'Housse de couette bicolore'
  }
  else if (hasVolant) {
    subFamilyLabel = 'Taie avec volant'
  }
  else if (hasHousse && textLower.includes('drap')) {
    subFamilyLabel = 'Drap housse'
  }
  else if (textLower.includes('drap') && textLower.includes('plat')) {
    subFamilyLabel = 'Drap plat'
  }
  else if (textLower.includes('traversin')) {
    subFamilyLabel = 'Traversin'
  }

  let L = 200, l = 160, bonnet = 0, diametre = 210, grammage = 0
  let dualColorsLabel = ''

  // 🎨 EXTRACTION DES COULEURS BICOLORES OU VOLANTS DIFFÉRENTS
  // Cas A : Housses de couette (dessous / dessus)
  const dessousMatch = productName.match(/dessous\s*[:.]?\s*([A-Za-zÀ-ÿ\s]+?)(?=\s+Couleurs|\s+Dimensions|$)/i)
  const dessusMatch = productName.match(/dessus\s*[:.]?\s*([A-Za-zÀ-ÿ\s]+?)(?=\s+Couleurs|\s+Dimensions|$)/i)
  
  // Cas B : Taies avec volant (Couleurs / Couleurs volant)
  const couleurCorpsMatch = productName.match(/couleurs\s*[:.]?\s*([A-Za-zÀ-ÿ\s]+?)(?=\s+Couleurs\s+volant|\s+Dimensions|$)/i)
  const couleurVolantMatch = productName.match(/couleurs\s+volant\s*[:.]?\s*([A-Za-zÀ-ÿ\s]+)/i)

  if (dessusMatch && dessousMatch) {
    dualColorsLabel = `${dessusMatch[1].trim()} / ${dessousMatch[1].trim()}`
  } else if (couleurCorpsMatch && couleurVolantMatch) {
    // On vérifie si les deux couleurs sont différentes
    const corp = couleurCorpsMatch[1].trim()
    const volant = couleurVolantMatch[1].trim()
    if (corp.toLowerCase() !== volant.toLowerCase()) {
      dualColorsLabel = `${corp} (Volant: ${volant})`
    }
  } else if (textLower.includes('bi couleur') || textLower.includes('bi-couleur') || textLower.includes('bicolore')) {
    dualColorsLabel = 'Bicolore'
  }

  // EXTRACTION DU GRAMMAGE
  const grammageMatch = textLower.match(/(\d{3})\s*gr/)
  if (grammageMatch) grammage = parseInt(grammageMatch[1], 10)

  // 3️⃣ TRAITEMENT DES DIMENSIONS
  if (family === 'ROUND') {
    const diametreMatch = textLower.match(/(?:diamètre|diametre|dimensions|diam)\s*[:.]?\s*(?:.*?)\s*(\d{2,3})/)
    if (diametreMatch) diametre = parseInt(diametreMatch[1], 10)
    L = diametre
    l = diametre
  } 
  else {
    const cleanTextForDims = textLower.replace(/\b2\s*x\s*(?=\d{2,3}\s*x)/g, '')
    const largeurMatch = cleanTextForDims.match(/largeur\s*[:.]?\s*(\d+)/)
    const longueurMatch = cleanTextForDims.match(/longueur\s*[:.]?\s*(\d+)/)
    const crossMatch = cleanTextForDims.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)

    if (largeurMatch && longueurMatch) {
      l = parseInt(largeurMatch[1], 10)
      L = parseInt(longueurMatch[1], 10)
    } else if (crossMatch) {
      const val1 = parseInt(crossMatch[1], 10)
      const val2 = parseInt(crossMatch[2], 10)
      l = Math.min(val1, val2)
      L = Math.max(val1, val2)
    }
  }

  const bonnetSection = textLower.match(/(?:bonnet|epaisseur|épaisseur)\s*[:.]?\s*(?:[^\d]*?)\s*(\d{1,3})/)
  if (bonnetSection) {
    const parsedBonnet = parseInt(bonnetSection[1], 10)
    if (parsedBonnet < 60) bonnet = parsedBonnet
  }

  return { family, subFamilyLabel, isRoundStructure, dualColorsLabel, dims: { L, l, bonnet, diametre, grammage } }
}

interface AtelierPageProps {
  searchParams: Promise<{ view?: string; type?: string; groupBy?: string }>
}

export default async function AtelierPage({ searchParams }: AtelierPageProps) {
  // 🟢 On capte le nouveau paramètre (par défaut : on groupe par dimensions)
  const { view, type = 'all', groupBy = 'dimensions' } = await searchParams

  const availableFabrics = await prisma.fabric.findMany({
    orderBy: { name: 'asc' }
  })

  // 🟢 On ajoute la gestion du groupement dans l'URL
  const buildUrl = (targetView?: string, targetType?: string, targetGroupBy?: string) => {
    const params = new URLSearchParams()
    if (targetView) params.set('view', targetView)
    if (targetType && targetType !== 'all') params.set('type', targetType)
    if (targetGroupBy && targetGroupBy !== 'dimensions') params.set('groupBy', targetGroupBy)
    const qs = params.toString()
    return qs ? `/atelier?${qs}` : '/atelier'
  }
  const settings = await getAtelierSettings()

  const totalTimedItemsCount = await prisma.quoteItem.count({
    where: { finishedAt: { not: null }, startedCoutureAt: { not: null } }
  })

  const allItems = await prisma.quoteItem.findMany({
    where: {
      quote: { 
        status: 'VALIDATED', 
        isPaid: true
      },
      statusProduction: { in: ['A_COUPER', 'EN_COUTURE', 'PRET'] } 
    },
    include: { 
      fabric: true, 
      quote: {
        include: {
          client: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  const items = allItems.filter(item => {
    const isB2B = item.quote.reference.startsWith('CC-') || item.quote.client?.name === 'CAMPING CAR'
    if (type === 'b2b') return isB2B
    if (type === 'classic') return !isB2B
    return true
  })

  const boutiqueStock = await prisma.finishedProduct.findMany({
    where: { stockQuantity: { gt: 0 } }
  })

  const groupedCutting: { [key: string]: any } = {}
  const familyLabels: Record<string, string> = { FITTED: 'Drap housse', FLAT: 'Drap plat', ENVELOPE: 'Housse de couette', ROUND: 'Drap rond', BOLSTER: 'Traversin', CUSTOM: 'Sur-mesure' }

items.filter(i => i.statusProduction === 'A_COUPER').forEach(item => {
    const nameToParse = item.customName || item.fabric?.name || ''
    const matchedProduct = parsePrestashopProductLocal(nameToParse)

    // 🟢 La dimension de base sans notion de couleur
    const baseDimKey = matchedProduct.isRoundStructure
      ? `DIAM-${matchedProduct.dims.diametre}${matchedProduct.dims.bonnet ? `-B${matchedProduct.dims.bonnet}` : ''}${matchedProduct.dims.grammage ? `-G${matchedProduct.dims.grammage}` : ''}`
      : `${matchedProduct.dims.l}x${matchedProduct.dims.L}${matchedProduct.dims.bonnet ? `-B${matchedProduct.dims.bonnet}` : ''}${matchedProduct.dims.grammage ? `-G${matchedProduct.dims.grammage}` : ''}`

    const readableBaseDimStr = matchedProduct.isRoundStructure
      ? `Rond Diam.${matchedProduct.dims.diametre}cm${matchedProduct.dims.bonnet ? ` (B.${matchedProduct.dims.bonnet})` : ''}${matchedProduct.dims.grammage ? ` [${matchedProduct.dims.grammage}g]` : ''}`
      : `${matchedProduct.dims.l}×${matchedProduct.dims.L}${matchedProduct.dims.bonnet ? ` (B.${matchedProduct.dims.bonnet})` : ''}${matchedProduct.dims.grammage ? ` [${matchedProduct.dims.grammage}g]` : ''}`

    const fabricKey = item.fabricId || 'CUSTOM'
    
    // 🎯 LOGIQUE DE REGROUPEMENT DYNAMIQUE SELON LE CHOIX DE L'ATELIER
    let uniqueGroupKey = ''
    let finalDimsStr = readableBaseDimStr

    if (groupBy === 'color') {
      // 🎨 Mode Couleur : On sépare par Rouleau de Tissu + Dimension
      uniqueGroupKey = `${fabricKey}-${matchedProduct.family}-${baseDimKey}`
    } else if (groupBy === 'bonnet') {
      // 🪡 Mode Bonnet : On regroupe UNIQUEMENT par Bonnet (peu importe la largeur/longueur ou le tissu)
      uniqueGroupKey = `${matchedProduct.family}-BONNET-${matchedProduct.dims.bonnet}`
      finalDimsStr = `Toutes dimensions — Bonnet de ${matchedProduct.dims.bonnet} cm`
    } else {
      // 📏 Mode Dimension (Par défaut) : Matelassage (on groupe par taille, on ignore le tissu)
      uniqueGroupKey = `${matchedProduct.family}-${baseDimKey}`
    }

    const existsInBoutique = boutiqueStock.find(fp => 
      fp.family === matchedProduct.family && fp.dimensions.toLowerCase().includes(baseDimKey.toLowerCase())
    )

    const productTypeLabel = matchedProduct.subFamilyLabel || familyLabels[matchedProduct.family] || 'Article'
    const displayColor = matchedProduct.dualColorsLabel || item.fabric?.color || 'Standard'

    if (!groupedCutting[uniqueGroupKey]) {
      groupedCutting[uniqueGroupKey] = {
        fabricRef: item.fabric?.reference || 'SUR-MESURE',
        fabricName: item.fabric?.name || 'Article Libre',
        fabricColor: displayColor, 
        productType: productTypeLabel, 
        dimsStr: finalDimsStr,
        boutiqueAlert: existsInBoutique ? { name: existsInBoutique.name, qty: existsInBoutique.stockQuantity } : null,
        itemsList: []
      }
    }
    groupedCutting[uniqueGroupKey].itemsList.push(item)
  })

  const cuttingGroups = Object.values(groupedCutting).sort((groupA: any, groupB: any) => {
    const dateA = new Date(groupA.itemsList[0].createdAt).getTime()
    const dateB = new Date(groupB.itemsList[0].createdAt).getTime()
    return dateA - dateB 
  })

  cuttingGroups.forEach((group: any) => {
    group.itemsList.sort((itemA: any, itemB: any) => {
      return new Date(itemA.createdAt).getTime() - new Date(itemB.createdAt).getTime()
    })
  })

  const enCouture = items
    .filter(i => i.statusProduction === 'EN_COUTURE')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const pret = items
    .filter(i => i.statusProduction === 'PRET')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Planning de l'Atelier</h1>
          <p className="text-slate-500">Suivi en temps réel de la coupe groupée et de la confection Nicole Germain.</p>
        </div>
        <SyncWebButton />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl border border-slate-200/60 shadow-sm w-fit">
          <div className="pl-2 pr-3 flex items-center gap-1.5 text-slate-400 font-black text-[10px] uppercase tracking-wider">
            <Filter size={12}/> Flux
          </div>
          <Link 
            href={buildUrl(view, 'all')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
              type === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'
            }`}
          >
            Tous les dossiers
          </Link>
          <Link 
            href={buildUrl(view, 'classic')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
              type === 'classic' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'
            }`}
          >
            Standards / Vosgia
          </Link>
          <Link 
            href={buildUrl(view, 'b2b')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
              type === 'b2b' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'
            }`}
          >
            Sous-traitance B2B
          </Link>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex flex-wrap gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 w-full md:w-auto">
            <Link 
              href={buildUrl(undefined, type)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${
                !view ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-extrabold' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/30'
              }`}
            >
              Vue Globale
            </Link>
            
            <Link 
              href={buildUrl('coupe', type)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
                view === 'coupe' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
              }`}
            >
              <Scissors size={14} className={view === 'coupe' ? 'animate-bounce' : ''} /> 
              <span>Poste Coupe</span>
              <span className={`px-2 py-0.5 text-[10px] rounded-md font-mono ${view === 'coupe' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {cuttingGroups.reduce((acc, g: any) => acc + g.itemsList.length, 0)}
              </span>
            </Link>

            <Link 
              href={buildUrl('couture', type)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
                view === 'couture' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
              }`}
            >
              <Shirt size={14} /> 
              <span>Poste Couture</span>
              <span className={`px-2 py-0.5 text-[10px] rounded-md font-mono ${view === 'couture' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {enCouture.length}
              </span>
            </Link>

            <Link 
              href={buildUrl('expedition', type)} 
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
                view === 'expedition' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-extrabold' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
              }`}
            >
              <Package size={14} /> 
              <span>Expédition</span>
              <span className={`px-2 py-0.5 text-[10px] rounded-md font-mono ${view === 'expedition' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {pret.length}
              </span>
            </Link>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 items-start ${!view ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 max-w-3xl mx-auto'}`}>
        
{/* COLONNE 1 : COUPE */}
        {(!view || view === 'coupe') && (
          <div className="bg-slate-100 p-4 rounded-3xl space-y-4 border border-slate-200 w-full animate-in fade-in duration-200">
            
            {/* 🎯 EN-TÊTE AVEC LES NOUVEAUX BOUTONS DE FILTRES */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
              <h2 className="font-black text-slate-800 flex items-center gap-2 px-2 text-sm uppercase tracking-wider whitespace-nowrap">
                <Scissors size={18} className="text-blue-600" /> 1. À couper
                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">{cuttingGroups.reduce((acc, g: any) => acc + g.itemsList.length, 0)} pcs</span>
              </h2>
              
              {/* 🟢 AJOUT DE flex-wrap ICI pour que les boutons passent à la ligne si besoin */}
              <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full xl:w-auto">
                <span className="text-[9px] font-black text-slate-400 uppercase ml-2 mr-1">Grouper :</span>
                <Link href={buildUrl(view, type, 'dimensions')} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${groupBy === 'dimensions' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>📏 Dim.</Link>
                <Link href={buildUrl(view, type, 'color')} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${groupBy === 'color' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>🎨 Coul.</Link>
                <Link href={buildUrl(view, type, 'bonnet')} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${groupBy === 'bonnet' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>🪡 Bonnet</Link>
              </div>
            </div>
            
            {cuttingGroups.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-6 bg-white rounded-2xl border border-slate-100">Rien à couper aujourd'hui.</p>
            ) : (
              cuttingGroups.map((group: any, idx) => {
                const isMultiCut = group.itemsList.length > 1
                const totalMeters = group.itemsList.reduce((sum: number, i: any) => sum + (i.quantityMeters || 0), 0)

                // 🎯 On calcule s'il y a plusieurs couleurs/tissus dans le même paquet pour changer l'étiquette !
                const distinctFabrics = Array.from(new Set(group.itemsList.map((i: any) => i.fabric?.reference || 'SUR-MESURE')))
                const distinctColors = Array.from(new Set(group.itemsList.map((i: any) => i.fabric?.color || 'Standard')))
                const isMultiTissus = distinctFabrics.length > 1

                return (
                  <div key={idx} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-4 ${isMultiCut ? 'border-indigo-300 ring-2 ring-indigo-500/5 bg-indigo-50/5' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1 items-center">
                          {/* 🟢 ÉTIQUETTES DYNAMIQUES */}
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${isMultiTissus ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                            {isMultiTissus ? 'MULTI-TISSUS' : group.fabricRef}
                          </span>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded flex items-center gap-0.5">
                            <Palette size={10}/> 
                            {distinctColors.length > 1 ? 'MULTI-COULEURS' : group.fabricColor.toUpperCase()}
                          </span>
                          {isMultiCut && <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1"><Layers size={10}/> MULTI-COUPE ({group.itemsList.length})</span>}
                        </div>
                        <h3 className="font-black text-slate-800 text-base pt-1 leading-tight">{group.productType} — <span className="font-mono font-bold text-sm text-slate-600">{group.dimsStr}</span></h3>
                        
                        {/* On cache le nom du tissu si c'est un mix */}
                        {!isMultiTissus && <p className="text-[11px] text-slate-400 font-medium">Tissu : {group.fabricName}</p>}
                      </div>
                      <div className="text-right bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl border border-indigo-100/50 min-w-[75px]">
                        <p className="text-[9px] font-black uppercase tracking-wider opacity-60">À dérouler</p>
                        <p className="text-base font-mono font-black">{totalMeters.toFixed(1)}<span className="text-xs font-normal ml-0.5">m</span></p>
                      </div>
                    </div>

                    {group.boutiqueAlert && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-1.5 text-[11px] font-medium shadow-inner">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                        <p>Existe en Boutique ! Reste <strong>{group.boutiqueAlert.qty} u.</strong> de "{group.boutiqueAlert.name}".</p>
                      </div>
                    )}

                    {isMultiCut && <BulkCutForm itemIds={group.itemsList.map((item: any) => item.id)} count={group.itemsList.length} />}

                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      {group.itemsList.map((item: any) => {
                        const matchedProduct = parsePrestashopProductLocal(item.customName || item.fabric?.name || '')
                        const isBicolor = !!matchedProduct.dualColorsLabel

                        return (
                          <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 shadow-sm">
                            
{/* FORMULAIRE : SÉLECTION DES TISSUS */}
                            <form action={linkFabricToItem} className="flex flex-col gap-2 border-b border-slate-200/60 pb-3 w-full">
                              <div className="flex justify-between items-center gap-2 w-full">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider truncate">
                                  {isBicolor ? 'Rouleaux (Bicolore) :' : 'Rouleau assigné :'}
                                </label>
                                <button type="submit" className="shrink-0 px-3 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm">
                                  Enregistrer
                                </button>
                              </div>
                              
                              <div className="flex flex-col gap-2 w-full">
                                <input type="hidden" name="itemId" value={item.id} />
                                
                                <div className="flex items-center gap-2 w-full">
                                  {isBicolor && <span className="shrink-0 text-[10px] font-bold text-slate-400 w-10 text-right">FACE A</span>}
                                  {/* 🟢 AJOUT DE min-w-0 et truncate */}
                                  <select 
                                    name="fabricId" 
                                    defaultValue={item.fabricId || ""}
                                    className="flex-1 min-w-0 truncate text-xs p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-indigo-500 font-medium"
                                  >
                                    <option value="" disabled>Associer un rouleau...</option>
                                    {availableFabrics.map((fabric: any) => (
                                      <option key={`A-${fabric.id}`} value={fabric.id}>
                                        {fabric.reference} - {fabric.name} ({fabric.color})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {isBicolor && (
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="shrink-0 text-[10px] font-bold text-amber-500 w-10 text-right">FACE B</span>
                                    {/* 🟢 AJOUT DE min-w-0 et truncate */}
                                    <select 
                                      name="fabricBId" 
                                      defaultValue={item.fabricBId || ""}
                                      className="flex-1 min-w-0 truncate text-xs p-1.5 bg-amber-50/50 border border-amber-200 rounded-lg text-slate-700 outline-none focus:border-amber-500 font-medium"
                                    >
                                      <option value="">(Aucun second rouleau lié)</option>
                                      {availableFabrics.map((fabric: any) => (
                                        <option key={`B-${fabric.id}`} value={fabric.id}>
                                          {fabric.reference} - {fabric.name} ({fabric.color})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </form>

                            {/* FORMULAIRE : VALIDATION DE LA COUPE */}
                            <form action={validateCuttingStep} className="flex flex-col gap-3 text-xs">
                              <input type="hidden" name="itemId" value={item.id} />
                              
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <span className="font-mono text-indigo-600 font-bold">{item.quote.reference}</span>
                                  {item.customName && <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-tight break-words">{item.customName}</p>}
                                  
                                  {item.blueprintUrl && (() => {
                                    try {
                                      const files = JSON.parse(item.blueprintUrl)
                                      if (files.doc || files.schema) {
                                        return (
                                          <div className="flex items-center gap-3 mt-2">
                                            {files.doc && (
                                              <a href={`/api/documents?url=${files.doc}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/50 transition-colors shadow-sm">📄 Voir le Bon</a>
                                            )}
                                            {files.schema && (
                                              <a href={`/api/documents?url=${files.schema}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200/50 transition-colors shadow-sm">📐 Voir le Schéma</a>
                                            )}
                                          </div>
                                        )
                                      }
                                    } catch (e) {
                                      return (
                                        <div className="mt-2">
                                          <a href={`/api/documents?url=${item.blueprintUrl}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Consulter la fiche matelas</a>
                                        </div>
                                      )
                                    }
                                  })()}
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold shrink-0">Prévu: {item.prodTimeMinutes} min</span>
                              </div>
                              
                              <div className="flex flex-col gap-2 pt-2 border-t border-slate-100/60 mt-1">
                                
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isBicolor ? (
                                      <span className="text-slate-500 text-[10px] uppercase font-bold w-12 text-right">Face A :</span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px] uppercase font-bold">Métrage réel :</span>
                                    )}
                                    <input type="number" name="realMetersA" step="0.1" defaultValue={Number(item.quantityMeters).toFixed(1)} className="w-16 p-1 text-center bg-white border border-slate-200 rounded-lg font-black text-indigo-600 outline-none" />
                                    <span className="text-slate-400 font-bold">m</span>
                                  </div>
                                  
                                  {!isBicolor && (
                                    <div className="flex gap-1.5">
                                      <button type="submit" name="isChute" value="false" className="py-1.5 px-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap">✂️ Rouleau</button>
                                      <button type="submit" name="isChute" value="true" className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap">♻️ Chute</button>
                                    </div>
                                  )}
                                </div>

                                {isBicolor && (
                                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100/50">
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-500 text-[10px] uppercase font-bold w-12 text-right">Face B :</span>
                                      <input type="number" name="realMetersB" step="0.1" defaultValue={(item as any).quantityMetersB ? Number((item as any).quantityMetersB).toFixed(1) : ''} placeholder="0.0" className="w-16 p-1 text-center bg-amber-50/30 border border-amber-200 rounded-lg font-black text-amber-600 outline-none" />
                                      <span className="text-slate-400 font-bold">m</span>
                                    </div>
                                    
                                    <div className="flex gap-1.5">
                                      <button type="submit" name="isChute" value="false" className="py-1.5 px-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap">✂️ Couper les 2</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </form>

                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* COLONNE 2 : COUTURE */}
        {(!view || view === 'couture') && (
          <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100 w-full animate-in fade-in duration-200">
            <h2 className="font-black text-slate-700 flex items-center justify-between px-2 text-sm uppercase tracking-wider">
              <span className="flex items-center gap-2"><Shirt size={18} className="text-amber-500" /> 2. En couture</span>
              <span className="text-xs bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full font-mono">{enCouture.length}</span>
            </h2>
            {enCouture.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-6 bg-white rounded-2xl border border-slate-100/70">Aucun ouvrage à la machine.</p>
            ) : (
              enCouture.map(item => (
                <div key={item.id} className="relative group">
                  <form action={rollbackToCutting} className="absolute top-4 right-4 z-10">
                    <input type="hidden" name="itemId" value={item.id} />
                    <button 
                      type="submit"
                      title="Renvoyer l'article à la coupe"
                      className="p-2 bg-slate-950 hover:bg-blue-600 text-white rounded-xl transition-all duration-200 shadow-md hover:scale-105 flex items-center justify-center group/btn"
                    >
                      <ArrowLeft size={14} className="group-hover/btn:-translate-x-0.5 transition-transform" />
                    </button>
                  </form>

                  <ProductionCard item={item} currentTimedCount={totalTimedItemsCount} auditQuota={settings?.auditQuota ?? 10} />
                </div>
              ))
            )}
          </div>
        )}

        {/* COLONNE 3 : PRÊT / ENVOI */}
        {(!view || view === 'expedition') && (() => {
          const ordersMap: Record<string, {
            id: string
            reference: string
            clientName: string
            paymentMethod: string
            itemsList: typeof pret
            isComplete: boolean
          }> = {}

          items.forEach(item => {
            const quote = item.quote as any
            
            if (!ordersMap[quote.id]) {
              ordersMap[quote.id] = {
                id: quote.id,
                reference: quote.reference,
                clientName: quote.client?.name || 'Client Inconnu',
                paymentMethod: quote.paymentMethod || 'Non renseigné',
                itemsList: [],
                isComplete: true
              }
            }

            if (item.statusProduction === 'PRET') {
              ordersMap[quote.id].itemsList.push(item)
            }

            if (item.statusProduction === 'A_COUPER' || item.statusProduction === 'EN_COUTURE') {
              ordersMap[quote.id].isComplete = false
            }
          })

          const activeOrders = Object.values(ordersMap).filter(o => o.itemsList.length > 0)

          return (
            <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100 w-full animate-in fade-in duration-200">
              <h2 className="font-black text-slate-700 flex items-center justify-between px-2 text-sm uppercase tracking-wider">
                <span className="flex items-center gap-2"><Package size={18} className="text-emerald-500" /> 3. À Expédier</span>
                <span className="text-xs bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-full font-mono">{pret.length} pcs</span>
              </h2>

              {activeOrders.length === 0 ? (
                <p className="text-xs text-slate-400 font-medium text-center py-6 bg-white rounded-2xl border border-slate-100/70">Rien en zone d'expédition.</p>
              ) : (
                activeOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className={`bg-white p-5 rounded-2xl border shadow-sm space-y-4 transition-all ${
                      order.isComplete ? 'border-emerald-300 ring-2 ring-emerald-500/5 bg-emerald-50/5' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-100">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider">
                          {order.reference}
                        </span>
                        <h3 className="font-bold text-slate-800 text-sm pt-1">{order.clientName}</h3>
                        <p className="text-[10px] text-slate-400">Paiement : {order.paymentMethod}</p>
                      </div>

                      <div className="shrink-0">
                        {order.isComplete ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-black shadow-sm">
                            Complet
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-xl text-[10px] font-bold shadow-sm">
                            Incomplet
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {order.itemsList.map((item) => (
                        <div key={item.id} className="relative group">
                          <form action={rollbackToCouture} className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input type="hidden" name="itemId" value={item.id} />
                            <button 
                              type="submit"
                              title="Renvoyer l'article en couture"
                              className="p-1.5 bg-slate-900 hover:bg-amber-500 text-white rounded-lg transition-all shadow-md flex items-center justify-center"
                            >
                              <ArrowLeft size={12} />
                            </button>
                          </form>
                          <ProductionCard item={item} currentTimedCount={0} auditQuota={0} />
                        </div>
                      ))}
                    </div>

                    {order.isComplete && (
                      <div className="pt-2 border-t border-slate-100 flex justify-end">
                        <form action={shipBulkOrder}>
                          <input type="hidden" name="quoteId" value={order.id} />
                          <button 
                            type="submit" 
                            className="w-full sm:w-auto py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-sm transition-colors whitespace-nowrap"
                          >
                            📦 Expédier le bon complet
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )
        })()}

      </div>
    </div>
  )
}