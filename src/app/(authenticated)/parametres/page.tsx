'use client'

import { useState, useEffect, useRef } from 'react'
import { getAtelierSettings, updateAtelierSettings, getProductTypes, updateProductTypeTimes, getChronoStats } from '@/app/_actions/settings-actions'
import { Settings, Wrench, Calculator, Percent, Clock, Scissors, CheckCircle, Gauge, Activity, ArrowRight } from 'lucide-react'

export default function ParametresPage() {
  const [data, setData] = useState<{ settings: any, productTypes: any[], chronoStats: Record<string, { avg: number, count: number }> }>({ 
    settings: null, 
    productTypes: [],
    chronoStats: {}
  })
  const [loading, setLoading] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [settingsData, typesData, statsData] = await Promise.all([
          getAtelierSettings(),
          getProductTypes(),
          getChronoStats()
        ])
        setData({ settings: settingsData, productTypes: typesData, chronoStats: statsData })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Fonction pour copier la moyenne réelle directement dans l'input manuel
  const applyAverage = (id: string, avgValue: number) => {
    const input = document.getElementById(`input_time_${id}`) as HTMLInputElement
    if (input) {
      input.value = avgValue.toString()
      // Animation visuelle pour confirmer l'action
      input.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50')
      setTimeout(() => input.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50'), 500)
    }
  }

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de la configuration...</div>

  return (
    <div className="p-8 space-y-10 max-w-6xl mx-auto pb-24">
      
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-md">
          <Settings size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Paramètres de l'Atelier</h1>
          <p className="text-slate-400 text-sm mt-1">Variables globales de tarification, audits et temps de production.</p>
        </div>
      </div>

      {/* --- BLOC 1 : CONSTANTES FINANCIÈRES & AUDITS --- */}
      <form action={async (formData) => {
        const res = await updateAtelierSettings(formData)
        if (!res.success) alert(res.error)
        else alert("✅ Configuration globale mise à jour !")
      }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 text-indigo-500 font-bold text-lg">
            <Wrench size={22} /> Configuration Globale
          </div>
          <button type="submit" className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md">
            Sauvegarder
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* COÛT MINUTE */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative overflow-hidden">
            <Clock className="absolute -right-4 -bottom-4 text-slate-200/50" size={100} />
            <label className="block text-slate-800 font-bold mb-2 text-sm relative z-10 uppercase tracking-wide">Coût Minute (€)</label>
            <div className="relative z-10">
              <input 
                type="number" step="0.01" min="0.01" name="laborCostPerMin" 
                defaultValue={data.settings?.laborCostPerMin} 
                className="w-full p-3 pl-10 bg-white border border-slate-300 rounded-xl font-black text-lg text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" 
                required 
              />
              <span className="absolute left-3.5 top-3.5 font-black text-slate-400">€</span>
            </div>
          </div>

          {/* MARGE */}
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 relative overflow-hidden">
            <Percent className="absolute -right-4 -bottom-4 text-indigo-200/50" size={100} />
            <label className="block text-indigo-900 font-bold mb-2 text-sm relative z-10 uppercase tracking-wide">Marge Commerciale</label>
            <div className="relative z-10">
              <input 
                type="number" step="0.1" min="1.0" name="marginRate" 
                defaultValue={data.settings?.marginRate} 
                className="w-full p-3 pl-10 bg-white border border-indigo-200 rounded-xl font-black text-lg text-indigo-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" 
                required 
              />
              <span className="absolute left-3.5 top-3.5 font-black text-indigo-400">x</span>
            </div>
          </div>

          {/* 🆕 QUOTA D'AUDIT CORRIGÉ */}
          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 relative overflow-hidden">
            <Gauge className="absolute -right-4 -bottom-4 text-amber-200/50" size={100} />
            <label className="block text-amber-900 font-bold mb-2 text-sm relative z-10 uppercase tracking-wide">Objectif d'Audits</label>
            <div className="relative z-10 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input 
                  type="number" step="1" min="1" name="auditQuota" 
                  defaultValue={data.settings?.auditQuota || 10} 
                  className="w-16 p-2 bg-white border border-amber-200 rounded-lg font-black text-center text-amber-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100" 
                  required 
                />
                <span className="text-xs font-bold text-amber-700">pièces par</span>
                <select 
                  name="auditPeriod" 
                  defaultValue={data.settings?.auditPeriod || 12}
                  className="flex-1 p-2 bg-white border border-amber-200 rounded-lg font-black text-amber-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                >
                  <option value={1}>Mois</option>
                  <option value={3}>Trimestre</option>
                  <option value={6}>Semestre (6 mois)</option>
                  <option value={12}>An (12 mois)</option>
                </select>
              </div>
            </div>
          </div>

        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center gap-4">
          <Calculator size={28} className="text-indigo-400 shrink-0" />
          <p className="text-xs font-medium">
            <strong>Règle de calcul :</strong> [Coût Matière + (Temps × Coût Minute)] × Marge. <br/>
            Le système demandera à l'atelier de chronométrer <strong>{data.settings?.auditQuota || 10} pièces par {data.settings?.auditPeriod === 12 ? 'an' : data.settings?.auditPeriod === 6 ? 'semestre' : 'période'}</strong> (par famille de produit) pour affiner vos moyennes.
          </p>
        </div>
      </form>

      {/* --- BLOC 2 : TEMPS DE CONFECTION HYBRIDES --- */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-lg mb-1">
              <Activity size={22} /> Ajustement des Temps de Confection
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Ajustez le temps théorique utilisé pour deviser vos clients en fonction des moyennes réelles remontées par l'Atelier.
            </p>
          </div>
          <button 
            onClick={() => formRef.current?.requestSubmit()} 
            className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2"
          >
            <CheckCircle size={16} /> Enregistrer les temps
          </button>
        </div>

        <form ref={formRef} action={async (formData) => {
          const res = await updateProductTypeTimes(formData)
          if (!res.success) alert(res.error)
          else alert("✅ Temps théoriques mis à jour avec succès !")
        }} className="space-y-4">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.productTypes.map((pt) => {
              const stats = data.chronoStats[pt.family]
              const hasData = stats && stats.count > 0
              const gap = hasData ? stats.avg - pt.baseLaborTime : 0
              const isOvertime = gap > 0

              return (
                <div key={pt.id} className="p-5 border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 hover:bg-white transition-colors shadow-sm gap-4">
                  
                  <div className="flex-1 w-full">
                    <p className="font-bold text-slate-900 text-sm">{pt.name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] uppercase font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">{pt.family}</span>
                      {hasData ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                          Moyenne sur {stats.count} audits : 
                          <strong className={isOvertime ? 'text-rose-500' : 'text-emerald-500'}>
                            {stats.avg} min
                          </strong>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 italic">Aucun audit récent</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {/* Bouton d'application rapide de la moyenne */}
                    {hasData && gap !== 0 && (
                      <button 
                        type="button"
                        onClick={() => applyAverage(pt.id, stats.avg)}
                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap"
                        title="Aligner le temps théorique sur la moyenne réelle"
                      >
                        Utiliser {stats.avg}m <ArrowRight size={12}/>
                      </button>
                    )}

                    {/* Input Manuel Final */}
                    <div className="relative w-28 shrink-0">
                      <input
                        id={`input_time_${pt.id}`}
                        type="number"
                        name={`type_${pt.id}`}
                        defaultValue={pt.baseLaborTime}
                        min="0"
                        className="w-full p-2.5 pr-8 text-right font-black text-slate-900 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-0 focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">min</span>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>

          {data.productTypes.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold">
              Aucun type de produit configuré.
            </div>
          )}
        </form>
      </div>

    </div>
  )
}