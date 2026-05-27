'use client'
import { useState, useEffect } from 'react'
import { getAtelierSettings, updateAtelierSettings } from '@/app/_actions/settings-actions'
import { Settings, Wrench, Calculator, Percent, Clock } from 'lucide-react'

export default function ParametresPage() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getAtelierSettings()
        setSettings(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement des paramètres...</div>

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      
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

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 text-indigo-500 font-bold mb-6">
          <Wrench size={20} /> Configuration Financière
        </div>

        <form action={async (formData) => {
          const res = await updateAtelierSettings(formData)
          if (!res.success) alert(res.error)
          else {
            alert("✅ Paramètres mis à jour avec succès !")
            window.location.reload()
          }
        }} className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* COÛT MINUTE */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative overflow-hidden">
              <Clock className="absolute -right-4 -bottom-4 text-slate-200/50" size={120} />
              <label className="block text-slate-800 font-bold mb-2 text-lg relative z-10">Coût de la minute (€)</label>
              <p className="text-xs text-slate-500 mb-4 relative z-10">Base de calcul pour la main-d'œuvre (Salaire + Charges / temps de travail).</p>
              
              <div className="relative z-10 max-w-[200px]">
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01"
                  name="laborCostPerMin" 
                  defaultValue={settings?.laborCostPerMin} 
                  className="w-full p-4 pl-12 bg-white border border-slate-300 rounded-xl font-black text-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" 
                  required 
                />
                <span className="absolute left-4 top-4 font-black text-slate-400 text-xl">€</span>
              </div>
            </div>

            {/* TAUX DE MARGE */}
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 relative overflow-hidden">
              <Percent className="absolute -right-4 -bottom-4 text-indigo-200/50" size={120} />
              <label className="block text-indigo-900 font-bold mb-2 text-lg relative z-10">Multiplicateur de Marge</label>
              <p className="text-xs text-indigo-600/70 mb-4 relative z-10">Coefficient appliqué sur le coût de revient total pour définir le prix de vente final.</p>
              
              <div className="relative z-10 max-w-[200px]">
                <input 
                  type="number" 
                  step="0.1" 
                  min="1.0"
                  name="marginRate" 
                  defaultValue={settings?.marginRate} 
                  className="w-full p-4 pl-12 bg-white border border-indigo-200 rounded-xl font-black text-xl text-indigo-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" 
                  required 
                />
                <span className="absolute left-4 top-4 font-black text-indigo-300 text-xl">x</span>
              </div>
            </div>
          </div>

          {/* RÉSUMÉ DYNAMIQUE */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-center gap-4">
            <Calculator size={32} className="text-indigo-400" />
            <div>
              <p className="text-sm font-bold">Exemple de simulation avec ces réglages :</p>
              <p className="text-xs text-slate-400 mt-1">
                Si un drap demande <strong className="text-white">10 mins</strong> de travail et <strong className="text-white">15€</strong> de matière, le coût de revient sera de <strong className="text-white">{(15 + (10 * settings?.laborCostPerMin)).toFixed(2)}€</strong>, et le prix public conseillé sera de <strong className="text-emerald-400 font-black">{((15 + (10 * settings?.laborCostPerMin)) * settings?.marginRate).toFixed(2)}€</strong>.
              </p>
            </div>
          </div>

          <button type="submit" className="px-8 py-4 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl text-sm uppercase tracking-wider flex mx-auto">
            Sauvegarder les Constantes
          </button>

        </form>
      </div>
    </div>
  )
}