"use client"

import { useState } from 'react'
import { AlertOctagon, UserX, Scissors, Truck, PackagePlus, Trash2 } from 'lucide-react'
import { processCustomerReturn } from '@/app/_actions/quote-actions'

// 🆕 Dictionnaire pour traduire le code technique en texte lisible pour Nicole
const REASON_LABELS: Record<string, string> = {
  CLIENT_ERROR: "Erreur Client / Changement d'avis",
  NG_ERROR: "Défaut / Erreur Atelier (NG)",
  DELIVERY_FAIL: "Retour Colis (Transporteur)"
}

export default function ReturnSavModal({ quoteId, currentReason }: { quoteId: string, currentReason?: string | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // 🛠️ CORRECTION : On utilise la valeur stricte (Enum) attendue par Prisma
  const [reason, setReason] = useState('CLIENT_ERROR') 
  const [actionProduct, setActionProduct] = useState<'RESTOCK_BOUTIQUE' | 'LOSS'>('RESTOCK_BOUTIQUE')

  if (currentReason) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-black uppercase">
        <AlertOctagon size={12}/> Retour SAV : {REASON_LABELS[currentReason] || currentReason}
      </span>
    )
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // On envoie 'CLIENT_ERROR' au serveur, Prisma va adorer !
    const res = await processCustomerReturn(quoteId, reason, actionProduct)
    if (res.success) {
      setIsOpen(false)
    } else {
      alert(res.error)
    }
    setIsSubmitting(false)
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
      >
        <AlertOctagon size={14} /> Signaler Retour
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-6">
            
            <div>
              <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
                <AlertOctagon className="text-rose-500" /> Traitement SAV
              </h2>
              <p className="text-sm text-slate-500 mt-1">Enregistrez le motif de retour pour les statistiques de l'atelier.</p>
            </div>

            {/* CHOIX DU MOTIF AVEC LES BONS CODES ENUM PRISMA */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase">1. Motif du retour</p>
              
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${reason === 'CLIENT_ERROR' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="reason" value="CLIENT_ERROR" checked={reason === 'CLIENT_ERROR'} onChange={(e) => setReason(e.target.value)} className="hidden" />
                <UserX size={18} /> <span className="font-bold text-sm">Modifications / Erreur client</span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${reason === 'NG_ERROR' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="reason" value="NG_ERROR" checked={reason === 'NG_ERROR'} onChange={(e) => setReason(e.target.value)} className="hidden" />
                <Scissors size={18} /> <span className="font-bold text-sm">Défaut / Erreur Atelier (NG)</span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${reason === 'DELIVERY_FAIL' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="reason" value="DELIVERY_FAIL" checked={reason === 'DELIVERY_FAIL'} onChange={(e) => setReason(e.target.value)} className="hidden" />
                <Truck size={18} /> <span className="font-bold text-sm">Retour Colis (Transporteur)</span>
              </label>
            </div>

            {/* ACTION SUR LE PRODUIT */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-400 uppercase">2. Que faire du colis ?</p>
              
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${actionProduct === 'RESTOCK_BOUTIQUE' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="action" value="RESTOCK_BOUTIQUE" checked={actionProduct === 'RESTOCK_BOUTIQUE'} onChange={() => setActionProduct('RESTOCK_BOUTIQUE')} className="hidden" />
                <PackagePlus size={18} /> <span className="font-bold text-sm">Intact : Placer en stock Boutique</span>
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${actionProduct === 'LOSS' ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="radio" name="action" value="LOSS" checked={actionProduct === 'LOSS'} onChange={() => setActionProduct('LOSS')} className="hidden" />
                <Trash2 size={18} /> <span className="font-bold text-sm">Défectueux : Conserver en chute</span>
              </label>
            </div>

            {/* BOUTONS */}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Annuler</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/20">
                {isSubmitting ? 'Traitement...' : 'Valider le Retour'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}