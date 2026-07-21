export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { Scissors, Shirt, Package, Layers, AlertTriangle, Palette, ArrowLeft } from 'lucide-react'
import ProductionCard from '@/components/ProductionCard'
import { validateCuttingStep, rollbackToCouture, rollbackToCutting, linkFabricToItem } from '@/app/_actions/atelier-actions'
import { getAtelierSettings } from '@/app/_actions/settings-actions' 
import SyncWebButton from '@/components/SyncWebButton'
import BulkCutForm from '@/components/BulkCutForm'
import { shipBulkOrder } from '@/app/_actions/atelier-actions'
import Link from 'next/link'

// Récupération de tous les tissus disponibles pour le menu déroulant
const availableFabrics = await prisma.fabric.findMany({
  orderBy: { name: 'asc' }
})

// 🛠️ Le Traducteur Local : Extraction chirurgicale
function parsePrestashopProductLocal(productName: string) {
  let family = 'CUSTOM'
  let subFamilyLabel = ''
  const textLower = productName.toLowerCase()
  
  const isRoundStructure = textLower.includes('rond') || textLower.includes('ronde') || textLower.includes('bulle')
  const isProtegeMatelas = textLower.includes('protè') || textLower.includes('prote') || textLower.includes('alès') || textLower.includes('ales')
  const hasHousse = textLower.includes('housse')
  const hasCouette = textLower.includes('couette')

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
  }

  // 2️⃣ LIBELLÉ D'AFFICHAGE PRÉCIS (Priorité absolue aux protections pour éviter le piège du mot "Drap")
  if (isProtegeMatelas) {
    subFamilyLabel = isRoundStructure ? 'Protège matelas rond' : 'Protège matelas'
  }
  else if (hasCouette && !hasHousse) {
    subFamilyLabel = 'Couette'
  }
  else if (hasCouette && hasHousse) {
    subFamilyLabel = textLower.includes('bi couleur') || textLower.includes('bi-couleur') || textLower.includes('bicolore')
      ? 'Housse de couette bicolore'
      : 'Housse de couette'
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
  else if (isRoundStructure) {
    subFamilyLabel = 'Drap rond'
  }

  let L = 200, l = 160, bonnet = 0, diametre = 210, grammage = 0
  let dualColorsLabel = ''

  // EXTRACTION DES COULEURS BICOLORES
  if (textLower.includes('bi couleur') || textLower.includes('bi-couleur') || textLower.includes('bicolore') || textLower.includes('dessous')) {
    const dessousMatch = productName.match(/dessous\s*:\s*([A-Za-zÀ-ÿ]+)/i)
    const dessusMatch = productName.match(/dessus\s*:\s*([A-Za-zÀ-ÿ]+)/i)
    if (dessusMatch && dessousMatch) {
      dualColorsLabel = `${dessusMatch[1]} / ${dessousMatch[1]}`
    }
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
    const largeurMatch = cleanTextForDims.match(/largeur\s*:\s*(\d+)/)
    const longueurMatch = cleanTextForDims.match(/longueur\s*:\s*(\d+)/)
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

  
  // 4️⃣ EXTRACTION DU BONNET
  const bonnetSection = textLower.match(/(?:bonnet|epaisseur|épaisseur)\s*[:.]?\s*(?:[^\d]*?)\s*(\d{1,3})/)
  if (bonnetSection) {
    const parsedBonnet = parseInt(bonnetSection[1], 10)
    if (parsedBonnet < 60) bonnet = parsedBonnet
  }
  if (bonnet === 0) {
    const rangeMatch = textLower.match(/(?:de\s+)(\d{2})\s+à/)
    if (rangeMatch) bonnet = parseInt(rangeMatch[1], 10)
  }

  // Forçage à 0 uniquement pour les draps ronds simples (pas de bonnet requis)
  if (family === 'ROUND' && !isProtegeMatelas) {
    bonnet = 0
  }

  return { family, subFamilyLabel, isRoundStructure, dualColorsLabel, dims: { L, l, bonnet, diametre, grammage } }
}

interface AtelierPageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function AtelierPage({ searchParams }: AtelierPageProps) {
  const { view } = await searchParams
  
  const settings = await getAtelierSettings()

  const totalTimedItemsCount = await prisma.quoteItem.count({
    where: { finishedAt: { not: null }, startedCoutureAt: { not: null } }
  })

  const items = await prisma.quoteItem.findMany({
    where: {
      quote: { status: 'VALIDATED' }, 
      statusProduction: { in: ['A_COUPER', 'EN_COUTURE', 'PRET'] } 
    },
    include: { 
      fabric: true, 
      quote: {
        include: {
          client: true // 🟢 Récupère proprement la relation Client de manière typée
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  const boutiqueStock = await prisma.finishedProduct.findMany({
    where: { stockQuantity: { gt: 0 } }
  })

  const groupedCutting: { [key: string]: any } = {}
  const familyLabels: Record<string, string> = { FITTED: 'Drap housse', FLAT: 'Drap plat', ENVELOPE: 'Housse de couette', ROUND: 'Drap rond', BOLSTER: 'Traversin', CUSTOM: 'Sur-mesure' }

  items.filter(i => i.statusProduction === 'A_COUPER').forEach(item => {
    const nameToParse = item.customName || item.fabric?.name || ''
    const matchedProduct = parsePrestashopProductLocal(nameToParse)

    const colorModifier = matchedProduct.dualColorsLabel ? `-${matchedProduct.dualColorsLabel.replace(/\s+/g, '')}` : ''

    const dimKey = matchedProduct.isRoundStructure
      ? `DIAM-${matchedProduct.dims.diametre}${matchedProduct.dims.bonnet ? `-B${matchedProduct.dims.bonnet}` : ''}${matchedProduct.dims.grammage ? `-G${matchedProduct.dims.grammage}` : ''}${colorModifier}`
      : `${matchedProduct.dims.l}x${matchedProduct.dims.L}${matchedProduct.dims.bonnet ? `-B${matchedProduct.dims.bonnet}` : ''}${matchedProduct.dims.grammage ? `-G${matchedProduct.dims.grammage}` : ''}${colorModifier}`

    const fabricKey = item.fabricId || 'CUSTOM'
    const uniqueGroupKey = `${fabricKey}-${matchedProduct.family}-${dimKey}`

    const existsInBoutique = boutiqueStock.find(fp => 
      fp.family === matchedProduct.family && fp.dimensions.toLowerCase().includes(dimKey.toLowerCase())
    )

    const productTypeLabel = matchedProduct.subFamilyLabel || familyLabels[matchedProduct.family] || 'Article'
    const displayColor = matchedProduct.dualColorsLabel || item.fabric?.color || 'Standard'

    if (!groupedCutting[uniqueGroupKey]) {
      groupedCutting[uniqueGroupKey] = {
        fabricRef: item.fabric?.reference || 'SUR-MESURE',
        fabricName: item.fabric?.name || 'Article Libre',
        fabricColor: displayColor, 
        productType: productTypeLabel, 
        dimsStr: matchedProduct.isRoundStructure
          ? `Rond Diam.${matchedProduct.dims.diametre}cm${matchedProduct.dims.bonnet ? ` (B.${matchedProduct.dims.bonnet})` : ''}${matchedProduct.dims.grammage ? ` [${matchedProduct.dims.grammage}g]` : ''}`
          : `${matchedProduct.dims.l}×${matchedProduct.dims.L}${matchedProduct.dims.bonnet ? ` (B.${matchedProduct.dims.bonnet})` : ''}${matchedProduct.dims.grammage ? ` [${matchedProduct.dims.grammage}g]` : ''}`,
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

      {/* 🧭 NAVIGATEUR DE POSTES DE TRAVAIL PREMIUM */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-3 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex flex-wrap gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100 w-full md:w-auto">
          <Link 
            href="/atelier" 
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${
              !view 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/40 font-extrabold' 
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/30'
            }`}
          >
            Vue Globale
          </Link>
          
          <Link 
            href="/atelier?view=coupe" 
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
              view === 'coupe' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 font-extrabold' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
            }`}
          >
            <Scissors size={14} className={view === 'coupe' ? 'animate-bounce' : ''} /> 
            <span>Poste Coupe</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-md font-mono ${view === 'coupe' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {cuttingGroups.reduce((acc, g: any) => acc + g.itemsList.length, 0)}
            </span>
          </Link>

          <Link 
            href="/atelier?view=couture" 
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
              view === 'couture' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 font-extrabold' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
            }`}
          >
            <Shirt size={14} /> 
            <span>Poste Couture</span>
            <span className={`px-2 py-0.5 text-[10px] rounded-md font-mono ${view === 'couture' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {enCouture.length}
            </span>
          </Link>

          <Link 
            href="/atelier?view=expedition" 
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 ${
              view === 'expedition' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-extrabold' 
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
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

      {/* 📦 LE GRID DYNAMIQUE : S'adapte au poste sélectionné */}
      <div className={`grid gap-6 items-start ${!view ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 max-w-3xl mx-auto'}`}>
        
        {/* COLONNE 1 : COUPE (Affiche si vue globale ou vue coupe) */}
        {(!view || view === 'coupe') && (
          <div className="bg-slate-100 p-4 rounded-3xl space-y-4 border border-slate-200 w-full animate-in fade-in duration-200">
            <h2 className="font-black text-slate-800 flex items-center justify-between px-2 text-sm uppercase tracking-wider">
              <span className="flex items-center gap-2"><Scissors size={18} className="text-blue-600" /> 1. À couper</span>
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">{cuttingGroups.reduce((acc, g: any) => acc + g.itemsList.length, 0)} pcs</span>
            </h2>
            
            {cuttingGroups.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium text-center py-6 bg-white rounded-2xl border border-slate-100">Rien à couper aujourd'hui.</p>
            ) : (
              cuttingGroups.map((group: any, idx) => {
                const isMultiCut = group.itemsList.length > 1
                const totalMeters = group.itemsList.reduce((sum: number, i: any) => sum + (i.quantityMeters || 0), 0)

                return (
                  <div key={idx} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-4 ${isMultiCut ? 'border-indigo-300 ring-2 ring-indigo-500/5 bg-indigo-50/5' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1 items-center">
                          <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">{group.fabricRef}</span>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded flex items-center gap-0.5"><Palette size={10}/> {group.fabricColor.toUpperCase()}</span>
                          {isMultiCut && <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1"><Layers size={10}/> MULTI-COUPE ({group.itemsList.length})</span>}
                        </div>
                        <h3 className="font-black text-slate-800 text-base pt-1 leading-tight">{group.productType} — <span className="font-mono font-bold text-sm text-slate-600">{group.dimsStr}</span></h3>
                        <p className="text-[11px] text-slate-400 font-medium">Tissu : {group.fabricName}</p>
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
  {group.itemsList.map((item: any) => (
    /* 🟢 On englobe la pièce dans une DIV parente qui porte la clé unique */
    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 shadow-sm">
      
{/* 🟢 1. FORMULAIRE : SÉLECTION DU TISSU */}
      <form action={linkFabricToItem} className="flex flex-col gap-1 border-b border-slate-200/60 pb-3">
        <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Changer le rouleau assigné :</label>
        <div className="flex items-center gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          
          <select 
            name="fabricId" 
            defaultValue={item.fabricId || ""}
            className="flex-1 text-xs p-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
            // ❌ Le onChange a été supprimé ici car nous sommes côté serveur
          >
            <option value="" disabled>Associer un rouleau de tissu...</option>
            {availableFabrics.map((fabric: any) => (
              <option key={fabric.id} value={fabric.id}>
                {fabric.reference} - {fabric.name} ({fabric.color})
              </option>
            ))}
          </select>

          {/* 🟢 Le petit bouton magique pour valider le changement */}
          <button 
            type="submit" 
            className="px-3 py-1.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            Lier
          </button>
        </div>
      </form>

      {/* 🟢 2. FORMULAIRE : VALIDATION DE LA COUPE */}
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
                        <a 
                          href={`/api/documents?url=${files.doc}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/50 transition-colors shadow-sm"
                        >
                          📄 Voir le Bon
                        </a>
                      )}
                      {files.schema && (
                        <a 
                          href={`/api/documents?url=${files.schema}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200/50 transition-colors shadow-sm"
                        >
                          📐 Voir le Schéma
                        </a>
                      )}
                    </div>
                  )
                }
              } catch (e) {
                return (
                  <div className="mt-2">
                    <a 
                      href={`/api/documents?url=${item.blueprintUrl}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Consulter la fiche matelas
                    </a>
                  </div>
                )
              }
            })()}
          </div>
          <span className="text-[10px] text-slate-400 font-bold shrink-0">Prévu: {item.prodTimeMinutes} min</span>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100/60 mt-1">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[10px] uppercase font-bold">Métrage réel :</span>
            <input type="number" name="realMeters" step="0.1" defaultValue={Number(item.quantityMeters).toFixed(1)} className="w-14 p-1 text-center bg-white border border-slate-200 rounded-lg font-black text-indigo-600 outline-none" />
            <span className="text-slate-400 font-bold">m</span>
          </div>
          <div className="flex gap-1.5">
            <button type="submit" name="isChute" value="false" className="py-1 px-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap">✂️ Rouleau</button>
            <button type="submit" name="isChute" value="true" className="py-1 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap">♻️ Chute</button>
          </div>
        </div>
      </form>

    </div>
  ))}
</div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* COLONNE 2 : COUTURE (Affiche si vue globale ou vue couture) */}
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
                  {/* 🎯 FLÈCHE RETOUR COUTURE -> COUPE */}
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

        {/* COLONNE 3 : PRÊT / ENVOI (Affiche si vue globale ou vue expedition) */}
        {(!view || view === 'expedition') && (() => {
          // 🎯 1. Regroupement par bon de commande (Idée validée pour Nicole Germain)
          const ordersMap: Record<string, {
            id: string
            reference: string
            clientName: string
            paymentMethod: string
            itemsList: typeof pret
            isComplete: boolean
          }> = {}

          // On prend TOUTES les lignes de l'atelier qui appartiennent à une commande validée et non archivée
          items.forEach(item => {
            // 🎯 On force le cast ici pour éteindre l'alerte rouge de TypeScript
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

            // Si l'article est prêt, on l'ajoute à la liste d'affichage de la colonne 3
            if (item.statusProduction === 'PRET') {
              ordersMap[quote.id].itemsList.push(item)
            }

            // ⚠️ Le petit truc en plus : si un article de la commande est encore à la coupe ou en couture, le bon est incomplet
            if (item.statusProduction === 'A_COUPER' || item.statusProduction === 'EN_COUTURE') {
              ordersMap[quote.id].isComplete = false
            }
          })

          // On ne garde que les commandes qui ont au moins un article prêt à être expédié dans cette colonne
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
                    {/* EN-TÊTE DU BON DE COMMANDE */}
                    <div className="flex justify-between items-start gap-2 pb-2 border-b border-slate-100">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded uppercase tracking-wider">
                          {order.reference}
                        </span>
                        <h3 className="font-bold text-slate-800 text-sm pt-1">{order.clientName}</h3>
                        <p className="text-[10px] text-slate-400">Paiement : {order.paymentMethod}</p>
                      </div>

                      {/* Le petit truc COMPLET ou INCOMPLET */}
                      <div className="shrink-0">
                        {order.isComplete ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-black shadow-sm">
                            Complet
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-xl text-[10px] font-black shadow-sm">
                            Incomplet
                          </span>
                        )}
                      </div>
                    </div>

                    {/* PIÈCES PRÊTES DE CE BON DE COMMANDE */}
                    <div className="space-y-2">
                      {order.itemsList.map((item) => (
                        <div key={item.id} className="relative group">
                          {/* Bouton de retour en arrière vers la couture */}
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

                          {/* Utilisation de ton composant de carte standard pour l'affichage de la pièce */}
                          <ProductionCard item={item} currentTimedCount={0} auditQuota={0} />
                        </div>
                      ))}
                    </div>

                    {/* BOUTON D'ACTION EN DESSOUS DU REGROUPEMENT SI COMPLET */}
                    {order.isComplete && (
                      <div className="pt-2 border-t border-slate-100 flex justify-end">
{/* 🎯 Appels directs à une Server Action importée sans enveloppe anonyme */}
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