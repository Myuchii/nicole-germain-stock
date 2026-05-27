import { prisma } from '@/lib/prisma'
import { advanceProductionStep } from '@/app/_actions/atelier-actions'
import { Clock, Scissors, Shirt, Package } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AtelierPage() {
  // On récupère les items dont le devis parent est validé (pas les brouillons)
  const items = await prisma.quoteItem.findMany({
    where: {
      quote: { status: 'VALIDATED' }, // Uniquement ce qui est payé/validé
      statusProduction: { in: ['A_COUPER', 'EN_COUTURE', 'PRET'] } // On cache ce qui est déjà expédié
    },
    include: {
      fabric: true,
      quote: true
    }
  })

  // Séparation par colonne pour l'UI
  const aCouper = items.filter(i => i.statusProduction === 'A_COUPER')
  const enCouture = items.filter(i => i.statusProduction === 'EN_COUTURE')
  const pret = items.filter(i => i.statusProduction === 'PRET')

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">Planning de l'Atelier</h1>
        <p className="text-slate-500">Suivi en temps réel de la confection Nicole Germain.</p>
      </div>

      {/* LES 3 COLONNES DE PRODUCTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLONNE 1 : COUPE */}
        <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2 px-2">
            <Scissors size={18} className="text-blue-500" /> À couper ({aCouper.length})
          </h2>
          {aCouper.map(item => <ProductionCard key={item.id} item={item} />)}
        </div>

        {/* COLONNE 2 : COUTURE */}
        <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2 px-2">
            <Shirt size={18} className="text-amber-500" /> En couture ({enCouture.length})
          </h2>
          {enCouture.map(item => <ProductionCard key={item.id} item={item} />)}
        </div>

        {/* COLONNE 3 : PRÊT / ENVOI */}
        <div className="bg-slate-50 p-4 rounded-3xl space-y-4 border border-slate-100">
          <h2 className="font-bold text-slate-700 flex items-center gap-2 px-2">
            <Package size={18} className="text-emerald-500" /> Prêt pour expédition ({pret.length})
          </h2>
          {pret.map(item => <ProductionCard key={item.id} item={item} />)}
        </div>

      </div>
    </div>
  )
}

// LE MINI COMPOSANT DE LA CARTE PRODUIT CORRIGÉ POUR LES CHRONOS RÉELS
function ProductionCard({ item }: { item: any }) {
  
  // Calcul du temps réel passé en Coupe
  // Dès qu'on passe en couture, startedCoutureAt est enregistré
  let tempsCoupe = 0
  if (item.startedCoutureAt) {
    const diffMs = new Date(item.startedCoutureAt).getTime() - new Date(item.createdAt).getTime()
    tempsCoupe = Math.round(diffMs / 1000 / 60) // Conversion en minutes
  }

  // Calcul du temps réel passé en Couture
  // Dès que c'est prêt, finishedAt est enregistré
  let tempsCouture = 0
  if (item.finishedAt && item.startedCoutureAt) {
    const diffMs = new Date(item.finishedAt).getTime() - new Date(item.startedCoutureAt).getTime()
    tempsCouture = Math.round(diffMs / 1000 / 60) // Conversion en minutes
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-mono text-indigo-600 font-bold">{item.quote.reference}</span>
          <h4 className="font-bold text-slate-900 text-sm mt-0.5">Tissu : {item.fabric?.name}</h4>
        </div>
        
        {/* LE CHRONO THÉORIQUE (Prévu au départ) */}
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs" title="Temps théorique prévu">
          <Clock size={12} />
          Prévu: {item.prodTimeMinutes} min
        </div>
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl">
        Coupe requise : <strong>{item.quantityMeters?.toFixed(2) || '0.00'} m</strong> <br />
        Laize rouleau : <strong>{item.fabric?.width || 300} cm</strong>
      </div>

      {/* 🆕 AFFICHAGE DES CHRONOS RÉELS EN FONCTION DE L'ÉTAPE */}
      <div className="text-xs space-y-1 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
        <p className="text-slate-600 flex justify-between">
          <span>⏱️ Temps Coupe :</span> 
          <span className="font-bold text-slate-900">
            {item.statusProduction === 'A_COUPER' ? 'En cours...' : `${tempsCoupe} min`}
          </span>
        </p>
        
        {item.statusProduction !== 'A_COUPER' && (
          <p className="text-slate-600 flex justify-between">
            <span>🪡 Temps Couture :</span> 
            <span className="font-bold text-slate-900">
              {item.statusProduction === 'EN_COUTURE' ? 'En cours...' : `${tempsCouture} min`}
            </span>
          </p>
        )}
      </div>

      {/* BOUTON D'ACTION POUR PASSER A L'ETAPE SUIVANTE */}
      <form action={async () => { 'use server'; await advanceProductionStep(item.id, item.statusProduction); }}>
        <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors">
          {item.statusProduction === 'A_COUPER' && '✓ Coupe terminée'}
          {item.statusProduction === 'EN_COUTURE' && '✓ Couture terminée'}
          {item.statusProduction === 'PRET' && '📦 Expédier (Sortir du stock)'}
        </button>
      </form>
    </div>
  )
}