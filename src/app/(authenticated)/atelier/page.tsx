export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { Scissors, Shirt, Package, Layers, AlertTriangle, Palette } from 'lucide-react'
import ProductionCard from '@/components/ProductionCard'
import { validateCuttingStep } from '@/app/_actions/atelier-actions'
import SyncWebButton from '@/components/SyncWebButton'

// 🛠️ Le Traducteur Local : Évite les collisions de fiches quand deux articles partagent le même tissu
function parsePrestashopProductLocal(productName: string) {
  let family = 'CUSTOM'
  const textLower = productName.toLowerCase()
  
  if (textLower.includes('housse') && textLower.includes('drap')) family = 'FITTED' 
  else if (textLower.includes('drap') && textLower.includes('plat')) family = 'FLAT' 
  else if (textLower.includes('couette')) family = 'ENVELOPE' 
  else if (textLower.includes('rond') || textLower.includes('bulle')) family = 'ROUND'
  else if (textLower.includes('traversin')) family = 'BOLSTER'

  let L = 200, l = 160, bonnet = 0, diametre = 210
  const cleanTextForDims = textLower.replace(/\b2\s*x\s*(?=\d{2,3}\s*x)/g, '')
  const widthLengthMatch = cleanTextForDims.match(/largeur\s*:\s*(\d+).*?longueur\s*:\s*(\d+)/)
  const crossMatch = cleanTextForDims.match(/(\d{2,4})\s*x\s*(\d{2,4})/)

  if (widthLengthMatch) {
    let val1 = parseInt(widthLengthMatch[1])
    let val2 = parseInt(widthLengthMatch[2])
    L = Math.max(val1, val2); l = Math.min(val1, val2)
  } else if (crossMatch) {
    let val1 = parseInt(crossMatch[1]); let val2 = parseInt(crossMatch[2])
    L = Math.max(val1, val2); l = Math.min(val1, val2)
  }

  const bonnetMatch = textLower.match(/(?:bonnet|epaisseur|épaisseur).*?(\d{2})/)
  if (bonnetMatch) bonnet = parseInt(bonnetMatch[1])

  return { family, dims: { L, l, bonnet, diametre } }
}

export default async function AtelierPage() {
  const items = await prisma.quoteItem.findMany({
    where: {
      quote: { status: 'VALIDATED' }, 
      statusProduction: { in: ['A_COUPER', 'EN_COUTURE', 'PRET'] } 
    },
    include: { fabric: true, quote: true }
  })

  const boutiqueStock = await prisma.finishedProduct.findMany({
    where: { stockQuantity: { gt: 0 } }
  })

  const groupedCutting: { [key: string]: any } = {}
  const familyLabels: Record<string, string> = { FITTED: 'Drap housse', FLAT: 'Drap plat', ENVELOPE: 'Housse de couette', ROUND: 'Drap rond', BOLSTER: 'Traversin', CUSTOM: 'Sur-mesure' }

  items.filter(i => i.statusProduction === 'A_COUPER').forEach(item => {
    // 🎯 Sécurité anti-collision ré-injectée
    const nameToParse = item.customName || item.fabric?.name || ''
    const matchedProduct = parsePrestashopProductLocal(nameToParse)

    const dimKey = matchedProduct.family === 'ROUND'
      ? `DIAM-${matchedProduct.dims?.diametre || 210}`
      : `${matchedProduct.dims?.L || 200}x${matchedProduct.dims?.l || 160}${matchedProduct.dims?.bonnet ? `-B${matchedProduct.dims.bonnet}` : ''}`

    const fabricKey = item.fabricId || 'CUSTOM'
    const uniqueGroupKey = `${fabricKey}-${matchedProduct.family}-${dimKey}`

    const existsInBoutique = boutiqueStock.find(fp => 
      fp.family === matchedProduct.family && fp.dimensions.toLowerCase().includes(dimKey.toLowerCase())
    )

    const productTypeLabel = familyLabels[matchedProduct.family] || 'Article'

    if (!groupedCutting[uniqueGroupKey]) {
      groupedCutting[uniqueGroupKey] = {
        fabricRef: item.fabric?.reference || 'SUR-MESURE',
        fabricName: item.fabric?.name || 'Article Libre',
        fabricColor: item.fabric?.color || 'Standard',
        productType: productTypeLabel, 
        dimsStr: matchedProduct.family === 'ROUND' ? `Rond Diam.${matchedProduct.dims?.diametre}cm` : `${matchedProduct.dims?.L}×${matchedProduct.dims?.l}${matchedProduct.dims?.bonnet ? ` (B.${matchedProduct.dims.bonnet})` : ''}`,
        boutiqueAlert: existsInBoutique ? { name: existsInBoutique.name, qty: existsInBoutique.stockQuantity } : null,
        itemsList: []
      }
    }
    groupedCutting[uniqueGroupKey].itemsList.push(item)
  })

  const cuttingGroups = Object.values(groupedCutting)
  const enCouture = items.filter(i => i.statusProduction === 'EN_COUTURE')
  const pret = items.filter(i => i.statusProduction === 'PRET')

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Planning de l'Atelier</h1>
          <p className="text-slate-500">Suivi en temps réel de la coupe groupée et de la confection Nicole Germain.</p>
        </div>
        <SyncWebButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLONNE 1 : COUPE */}
        <div className="bg-slate-100 p-4 rounded-3xl space-y-4 border border-slate-200">
          <h2 className="font-black text-slate-800 flex items-center gap-2 px-2 text-sm uppercase tracking-wider">
            <Scissors size={18} className="text-blue-600" /> 1. À couper ({cuttingGroups.reduce((acc, g: any) => acc + g.itemsList.length, 0)} pièces)
          </h2>
          
          {cuttingGroups.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium text-center py-6">Rien à couper aujourd'hui.</p>
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
                      
                      <h3 className="font-black text-slate-800 text-base pt-1 leading-tight">
                        {group.productType} — <span className="font-mono font-bold text-sm text-slate-600">{group.dimsStr}</span>
                      </h3>
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

                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    {group.itemsList.map((item: any) => (
                      <form 
                        key={item.id} 
                        action={validateCuttingStep}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3 text-xs"
                      >
                        <input type="hidden" name="itemId" value={item.id} />

                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-indigo-600 font-bold">{item.quote.reference}</span>
                            {item.customName && <p className="text-[11px] text-slate-600 font-medium mt-0.5 leading-tight break-words">{item.customName}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">Prévu: {item.prodTimeMinutes} min</span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100/60">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[10px] uppercase font-bold">Métrage réel :</span>
                            <input 
                              type="number" 
                              name="realMeters"
                              step="0.1"
                              defaultValue={Number(item.quantityMeters).toFixed(1)}
                              className="w-14 p-1 text-center bg-white border border-slate-200 rounded-lg font-black text-indigo-600 outline-none"
                            />
                            <span className="text-slate-400 font-bold">m</span>
                          </div>

                          {/* 🎯 FIX NATIVE ACTION BUTTONS : Deux boutons submit, deux valeurs distinctes reçues par le serveur */}
                          <div className="flex gap-1.5">
                            <button 
                              type="submit" 
                              name="isChute" 
                              value="false" 
                              className="py-1 px-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap"
                            >
                              ✂️ Rouleau
                            </button>
                            <button 
                              type="submit" 
                              name="isChute" 
                              value="true" 
                              className="py-1 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap"
                            >
                              ♻️ Chute
                            </button>
                          </div>
                        </div>
                      </form>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* COLONNE 2 : COUTURE */}
        <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100">
          <h2 className="font-black text-slate-700 flex items-center gap-2 px-2 text-sm uppercase tracking-wider">
            <Shirt size={18} className="text-amber-500" /> 2. En couture ({enCouture.length})
          </h2>
          {enCouture.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium text-center py-6">Aucun ouvrage à la machine.</p>
          ) : (
            enCouture.map(item => <ProductionCard key={item.id} item={item} currentTimedCount={0} />)
          )}
        </div>

        {/* COLONNE 3 : PRÊT / ENVOI */}
        <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100">
          <h2 className="font-black text-slate-700 flex items-center gap-2 px-2 text-sm uppercase tracking-wider">
            <Package size={18} className="text-emerald-500" /> 3. À Expédier ({pret.length})
          </h2>
          {pret.length === 0 ? (
            <p className="text-xs text-slate-400 font-medium text-center py-6">Rien en zone d'expédition.</p>
          ) : (
            pret.map(item => <ProductionCard key={item.id} item={item} currentTimedCount={0} />)
          )}
        </div>

      </div>
    </div>
  )
}