'use client'
import { useState, useEffect } from 'react'
import { getAtelierSettings, updateAtelierSettings, getProductTypes, updateProductTypeTimes } from '@/app/_actions/settings-actions'
import { Settings, Wrench, Calculator, Percent, Clock, Scissors, CheckCircle } from 'lucide-react'

export default function ParametresPage() {
  const [data, setData] = useState<{ settings: any, productTypes: any[] }>({ settings: null, productTypes: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        // Chargement parallèle pour plus de performance
        const [settingsData, typesData] = await Promise.all([
          getAtelierSettings(),
          getProductTypes()
        ])
        setData({ settings: settingsData, productTypes: typesData })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de la configuration...</div>

  return (
    <div className="p-8 space-y-10 max-w-5xl mx-auto">
      
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-md">
          <Settings size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Paramètres de l'Atelier</h1>
          <p className="text-slate-400 text-xs uppercase tracking-wider mt-1">Variables globales de tarification et de production</p>
        </div>
      </div>

      {/* --- BLOC 1 : CONSTANTES FINANCIÈRES --- */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-500 font-bold mb-6">
          <Wrench size={20} /> Configuration Financière
        </div>

        <form action={async (formData) => {
          const res = await updateAtelierSettings(formData)
          if (!res.success) alert(res.error)
          else alert("✅ Constantes financières mises à jour !")
        }} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative overflow-hidden">
              <Clock className="absolute -right-4 -bottom-4 text-slate-200/50" size={120} />
              <label className="block text-slate-800 font-bold mb-2 text-lg relative z-10">Coût de la minute (€)</label>
              <div className="relative z-10 max-w-[200px]">
                <input 
                  type="number" step="0.01" min="0.01" name="laborCostPerMin" 
                  defaultValue={data.settings?.laborCostPerMin} 
                  className="w-full p-4 pl-12 bg-white border border-slate-300 rounded-xl font-black text-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" 
                  required 
                />
                <span className="absolute left-4 top-4 font-black text-slate-400 text-xl">€</span>
              </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 relative overflow-hidden">
              <Percent className="absolute -right-4 -bottom-4 text-indigo-200/50" size={120} />
              <label className="block text-indigo-900 font-bold mb-2 text-lg relative z-10">Multiplicateur de Marge</label>
              <div className="relative z-10 max-w-[200px]">
                <input 
                  type="number" step="0.1" min="1.0" name="marginRate" 
                  defaultValue={data.settings?.marginRate} 
                  className="w-full p-4 pl-12 bg-white border border-indigo-200 rounded-xl font-black text-xl text-indigo-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" 
                  required 
                />
                <span className="absolute left-4 top-4 font-black text-indigo-300 text-xl">x</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center gap-4">
            <Calculator size={32} className="text-indigo-400 shrink-0" />
            <p className="text-sm">
              Exemple : 10 mins de travail + 15€ de matière = Coût de revient de <strong>{(15 + (10 * data.settings?.laborCostPerMin)).toFixed(2)}€</strong>. 
              Prix public conseillé : <strong className="text-emerald-400 font-black">{((15 + (10 * data.settings?.laborCostPerMin)) * data.settings?.marginRate).toFixed(2)}€</strong>.
            </p>
          </div>

          <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md">
            Sauvegarder les Finances
          </button>
        </form>
      </div>

      {/* --- BLOC 2 : TEMPS DE CONFECTION --- */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-500 font-bold mb-6">
          <Scissors size={20} /> Temps de Confection de Base (Minutes)
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Ces valeurs pré-rempliront le configurateur de devis par défaut. Vous pourrez toujours les ajuster manuellement sur un devis spécifique.
        </p>

        <form action={async (formData) => {
          const res = await updateProductTypeTimes(formData)
          if (!res.success) alert(res.error)
          else alert("✅ Temps d'atelier mis à jour avec succès !")
        }} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.productTypes.map((pt) => (
              <div key={pt.id} className="p-4 border border-slate-200 rounded-2xl flex justify-between items-center bg-slate-50">
                <div>
                  <p className="font-bold text-slate-800">{pt.name}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">{pt.family}</p>
                </div>
                <div className="relative w-24">
                  <input
                    type="number"
                    name={`type_${pt.id}`}
                    defaultValue={pt.baseLaborTime}
                    min="0"
                    className="w-full p-2 pr-8 text-right font-bold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">m</span>
                </div>
              </div>
            ))}
          </div>

          {data.productTypes.length === 0 && (
            <div className="text-center p-6 text-slate-400 italic">Aucun type de produit configuré.</div>
          )}

          <button type="submit" className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2">
            <CheckCircle size={18} /> Sauvegarder les Temps
          </button>
        </form>
      </div>

    </div>
  )
}