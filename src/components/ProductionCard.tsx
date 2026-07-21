"use client"

import { useState, useEffect } from 'react'
import { Clock, Play, CheckCircle, Gauge, ArrowLeft, FileText, Image as ImageIcon } from 'lucide-react'
import { startCoutureChrono, advanceProductionStep, rollbackToCutting } from '@/app/_actions/atelier-actions'

export default function ProductionCard({ 
  item, 
  currentTimedCount, 
  auditQuota = 10 
}: { 
  item: any, 
  currentTimedCount: number, 
  auditQuota: number 
}) {
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [isPending, setIsPending] = useState(false)

  const isCooking = item.statusProduction === 'EN_COUTURE' && item.startedCoutureAt
  
  // Si le quota est à 0, l'alerte de manque d'audits est désactivée
  const isQuotaMissing = auditQuota > 0 && currentTimedCount < auditQuota

  // Effet de calcul en temps réel pour le tic-tac du chrono
  useEffect(() => {
    let interval: any = null

    if (isCooking) {
      const start = new Date(item.startedCoutureAt).getTime()
      setSecondsElapsed(Math.floor((Date.now() - start) / 1000))

      interval = setInterval(() => {
        setSecondsElapsed(Math.floor((Date.now() - start) / 1000))
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isCooking, item.startedCoutureAt])

  const formatTime = (totalSeconds: number) => {
    if (totalSeconds <= 0) return "00 min 00 s"
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')} min ${secs.toString().padStart(2, '0')} s`
  }

  let tempsCoutureStr = "Non mesuré"
  if (item.startedCoutureAt && item.finishedAt) {
    const diffMs = new Date(item.finishedAt).getTime() - new Date(item.startedCoutureAt).getTime()
    const totalSeconds = Math.floor(diffMs / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    tempsCoutureStr = `${mins} min ${secs} s`
  }

  const handleStart = async () => {
    setIsPending(true)
    await startCoutureChrono(item.id)
    setIsPending(false)
  }

  const handleStop = async () => {
    if (!confirm("Finir le travail sur cette pièce et arrêter définitivement le chronomètre ?")) return
    setIsPending(true)
    await advanceProductionStep(item.id, item.statusProduction)
    setIsPending(false)
  }

  const handleRollbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const confirmRollback = window.confirm(
      `⚠️ ALERTE RECOUPE ATELIER\n\n` +
      `Tu vas renvoyer la commande ${item.quote.reference} à l'étape "À couper".\n\n` +
      `⚠️ IMPORTANT : Le tissu ayant déjà été coupé, le rouleau physique a été entamé. ` +
      `Quand tu re-valideras la coupe, le stock sera déduit UNE NOUVELLE FOIS.\n\n` +
      `Confirmer le retour à la coupe ?`
    )

    if (confirmRollback) {
      setIsPending(true)
      const formData = new FormData()
      formData.append('itemId', item.id)
      await rollbackToCutting(formData)
      setIsPending(false)
    }
  }

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 relative group">
      
      {/* EN-TÊTE DE LA CARTE */}
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.statusProduction === 'EN_COUTURE' && (
              <form onSubmit={handleRollbackSubmit} className="inline shrink-0">
                <button 
                  type="submit"
                  disabled={isPending}
                  className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all disabled:opacity-40 flex items-center justify-center"
                  title="Erreur de coupe : renvoyer à l'étape précédente pour recouper"
                >
                  <ArrowLeft size={15} className="stroke-[2.5]" />
                </button>
              </form>
            )}
            <span className="text-xs font-mono text-indigo-600 font-bold bg-indigo-50/50 px-2 py-0.5 rounded-lg">
              {item.quote.reference}
            </span>
          </div>
          
          <h4 className="font-bold text-slate-900 text-sm mt-1.5 leading-tight break-words">
            Matière : {item.fabric?.name || item.customName || 'Saisie libre'}
          </h4>
        </div>
        
        <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs shrink-0">
          <Clock size={12} /> {item.prodTimeMinutes} min prévu
        </div>
      </div>

      {/* RAPPEL TECHNIQUE */}
      <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl">
        Métrage validé : <strong>{Number(item.quantityMeters).toFixed(1)} m</strong> | Couture effectuée en : <strong>{tempsCoutureStr}</strong>
      </div>

      {/* 📐 🟢 NOUVEAU : BLOC D'APERÇU MULTI-DOCUMENTS (CAMPING-CAR) */}
      {item.blueprintUrl && (() => {
        try {
          const files = JSON.parse(item.blueprintUrl)
          
          if (files.doc || files.schema) {
            return (
              <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  📄 Documents Camping-Car (CC)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {files.doc && (
                    <a 
                      href={files.doc} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[11px] font-black border border-indigo-200/60 transition-colors shadow-sm"
                    >
                      <FileText size={13} />
                      <span>Voir le Bon</span>
                    </a>
                  )}
                  {files.schema && (
                    <a 
                      href={files.schema} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[11px] font-black border border-emerald-200/60 transition-colors shadow-sm"
                    >
                      <ImageIcon size={13} />
                      <span>Voir le Schéma</span>
                    </a>
                  )}
                </div>
              </div>
            )
          }
        } catch (e) {
          // Secours : Si ce n'est pas du JSON stringifié (ancienne commande), on garde l'affichage unique classique
          return (
            <div className="p-2.5 bg-red-50/50 border border-red-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                Plan Technique
              </span>
              <a 
                href={item.blueprintUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm"
              >
                <FileText size={12} />
                Ouvrir le Plan PDF
              </a>
            </div>
          )
        }
      })()}

      {/* 🎯 ZONE INTERACTIVE DU CHRONOMÈTRE CONDITIONNELLE */}
      {(auditQuota > 0 || isCooking) && (
        <div className={`p-4 rounded-xl border text-center ${isCooking ? 'bg-rose-50 border-rose-200 animate-pulse' : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
            {isQuotaMissing && <Gauge size={12} className="text-rose-500"/>}
            {isCooking ? " Chrono en cours" : " Temps de couture réel"}
          </p>
          
          <p className={`text-xl font-mono font-black ${isCooking ? 'text-rose-600' : 'text-slate-700'}`}>
            {isCooking ? formatTime(secondsElapsed) : formatTime(item.finishedAt ? Math.floor((new Date(item.finishedAt).getTime() - new Date(item.startedCoutureAt).getTime()) / 1000) : 0)}
          </p>
        </div>
      )}

      {/* 🎯 BOUTONS D'ACTIONS DYNAMIQUES */}
      <div>
        {item.statusProduction === 'EN_COUTURE' && (
          !item.startedCoutureAt ? (
            /* Cas 1 : Le chrono n'a jamais démarré */
            auditQuota > 0 ? (
              <button 
                onClick={handleStart}
                disabled={isPending}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Play size={14} fill="white" /> Lancer le chrono
              </button>
            ) : (
              <button 
                onClick={async () => {
                  setIsPending(true)
                  await advanceProductionStep(item.id, item.statusProduction)
                  setIsPending(false)
                }}
                disabled={isPending}
                className="w-full py-3 bg-slate-900 hover:bg-indigo-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                ✅ Terminer la couture
              </button>
            )
          ) : (
            /* Cas 2 : Un chrono a déjà été initié ou est en cours */
            <div className="space-y-2">
              <button 
                onClick={handleStop}
                disabled={isPending}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-500/10 transition-all active:scale-95"
              >
                Stop & Couture terminée
              </button>

              {/* 🔄 LE BOUTON DE SECOURS : Pour écraser et relancer si besoin */}
              <button 
                onClick={async () => {
                  if (confirm("⚠️ Tu vas réinitialiser et relancer le chronomètre à zéro pour cet ouvrage. Confirmer ?")) {
                    await handleStart()
                  }
                }}
                disabled={isPending}
                className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all"
              >
                Relancer le chrono
              </button>
            </div>
          )
        )}

        {item.statusProduction === 'PRET' && (
          <button 
            onClick={async () => {
              setIsPending(true)
              await advanceProductionStep(item.id, item.statusProduction)
              setIsPending(false)
            }}
            disabled={isPending}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <CheckCircle size={14} /> Expédier (Sortir du stock)
          </button>
        )}
      </div>

    </div>
  )
}