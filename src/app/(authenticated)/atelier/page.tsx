export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { Scissors, Shirt, Package, Layers, AlertTriangle, Palette } from 'lucide-react'
import ProductionCard from '@/components/ProductionCard'
import { validateCuttingStep } from '@/app/_actions/atelier-actions'
import SyncWebButton from '@/components/SyncWebButton'

export default async function AtelierPage() {
  // 1. Récupération de tous les articles en production
  const items = await prisma.quoteItem.findMany({
    where: {
      quote: { status: 'VALIDATED' }, 
      statusProduction: { in: ['A_COUPER', 'EN_COUTURE', 'PRET'] } 
    },
    include: {
      fabric: true,
      quote: true
    }
  })

  // 2. Récupération du stock de produits finis pour l'alerte Boutique
  const boutiqueStock = await prisma.finishedProduct.findMany({
    where: { stockQuantity: { gt: 0 } }
  })

  // --- ALGORITHME DE REGROUPEMENT POUR LA COLONNE "À COUPER" ---
  const groupedCutting: { [key: string]: any } = {}

  items.filter(i => i.statusProduction === 'A_COUPER').forEach(item => {
    const savedProducts = (item.quote.products as any[]) || []
    const matchedProduct = savedProducts.find(p => p.fabricId === item.fabricId) || savedProducts[0]

    const dimKey = matchedProduct?.family === 'ROUND'
      ? `DIAM-${matchedProduct.dims?.diametre || 210}`
      : `${matchedProduct?.dims?.L || 200}x${matchedProduct?.dims?.l || 160}${matchedProduct?.dims?.bonnet ? `-B${matchedProduct.dims.bonnet}` : ''}`

    const fabricKey = item.fabricId || 'CUSTOM'
    const uniqueGroupKey = `${fabricKey}-${matchedProduct?.family || 'FITTED'}-${dimKey}`

    const existsInBoutique = boutiqueStock.find(fp => 
      fp.family === (matchedProduct?.family || 'FITTED') && 
      fp.dimensions.toLowerCase().includes(dimKey.toLowerCase())
    )

    if (!groupedCutting[uniqueGroupKey]) {
      groupedCutting[uniqueGroupKey] = {
        fabricRef: item.fabric?.reference || 'SUR-MESURE',
        fabricName: item.fabric?.name || 'Article Libre',
        fabricColor: item.fabric?.color || 'Standard',
        dimsStr: matchedProduct?.family === 'ROUND' ? `Rond Diam.${matchedProduct.dims?.diametre}cm` : `${matchedProduct?.dims?.L}×${matchedProduct?.dims?.l}${matchedProduct?.dims?.bonnet ? ` (B.${matchedProduct.dims.bonnet})` : ''}`,
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

      {/* LES 3 COLONNES DE PRODUCTION */}
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
                <div key={idx} className={`bg-white p-5 rounded-2xl border shadow-sm space-y-4 transition-all ${isMultiCut ? 'border-indigo-300 ring-2 ring-indigo-500/5 bg-indigo-50/5' : 'border-slate-100'}`}>
                  
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded uppercase">{group.fabricRef}</span>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded flex items-center gap-0.5"><Palette size={10}/> {group.fabricColor.toUpperCase()}</span>
                        {isMultiCut && <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1 animate-pulse"><Layers size={10}/> MULTI-COUPE ({group.itemsList.length})</span>}
                      </div>
                      <h3 className="font-mono font-black text-slate-800 text-base pt-1">{group.dimsStr}</h3>
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
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs"
                      >
                        <input type="hidden" name="itemId" value={item.id} />

                        <div>
                          <span className="font-mono text-indigo-600 font-bold">{item.quote.reference}</span>
                          <div className="flex items-center gap-1 mt-1">
                            <span className="text-slate-400 text-[10px] uppercase font-bold">Métrage utilisé :</span>
                            <input 
                              type="number" 
                              name="realMeters"
                              step="0.1"
                              defaultValue={Number(item.quantityMeters).toFixed(1)}
                              className="w-14 p-1 text-center bg-white border border-slate-200 rounded-lg font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-slate-400 font-bold">m</span>
                          </div>
                        </div>
                        
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="text-[10px] text-slate-400">Prévu: {item.prodTimeMinutes} min</span>
                          <button type="submit" className="py-1 px-2.5 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-bold transition-colors">
                            ✓ Coupé
                          </button>
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
            // 🎯 FIX : Ajout de currentTimedCount={0} pour valider le type-check
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
            // 🎯 FIX : Ajout de currentTimedCount={0} pour valider le type-check
            pret.map(item => <ProductionCard key={item.id} item={item} currentTimedCount={0} />)
          )}
        </div>

      </div>
    </div>
  )
}