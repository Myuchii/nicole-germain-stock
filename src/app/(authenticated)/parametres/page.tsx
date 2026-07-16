'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  getAtelierSettings, 
  updateAtelierSettings, 
  getProductTypes, 
  updateProductTypeTimes, 
  getChronoStats, 
  getRolePermissions // Doit renvoyer { CONFECTION: AppFeature[], BOUTIQUE: AppFeature[] }
} from '@/app/_actions/settings-actions'
import { updateRolePermission } from '@/app/_actions/permission-actions'
import { updateAccountPassword } from '@/app/_actions/settings-actions' // Ajout de l'action de mot de passe
import { UserRole, AppFeature } from '@prisma/client'
import { Settings, Wrench, Calculator, Percent, Clock, CheckCircle, Gauge, Activity, ArrowRight, ShieldAlert, KeyRound, EyeOff } from 'lucide-react'

const SYSTEM_ROUTES = [
  { feature: 'DASHBOARD' as AppFeature, label: 'Tableau de bord (Statistiques)', path: '/dashboard' },
  { feature: 'STOCK_BOUTIQUE' as AppFeature, label: 'Stock Boutique (Ventes)', path: '/stock-boutique' },
  { feature: 'STOCK_ATELIER' as AppFeature, label: 'Stock Atelier (Matières premières)', path: '/stock-atelier' },
  { feature: 'PRODUCTION' as AppFeature, label: 'Atelier de Production (Chronos & Coupe)', path: '/atelier' },
  { feature: 'DEVIS' as AppFeature, label: 'Calculateur de Devis (Chiffrage)', path: '/quotes' },
  { feature: 'COMMANDES' as AppFeature, label: 'Gestion des Commandes', path: '/commandes' },
  { feature: 'FOURNISSEURS' as AppFeature, label: 'Fournisseurs (Achats)', path: '/approvisionnement' },
  { feature: 'CLIENTS' as AppFeature, label: 'Fiches Clients (CRM)', path: '/clients' },
  { feature: 'PARAMETRES' as AppFeature, label: 'Paramètres de l\'Atelier', path: '/parametres' },
]

export default function ParametresPage() {
  const [data, setData] = useState<{ 
    settings: any, 
    productTypes: any[], 
    chronoStats: Record<string, { avg: number, count: number }>,
    permissions: Record<UserRole, AppFeature[]>
  }>({ 
    settings: null, 
    productTypes: [],
    chronoStats: {},
    permissions: { ADMIN: [], CONFECTION: [], BOUTIQUE: [] }
  })
  const [loading, setLoading] = useState(true)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [settingsData, typesData, statsData, permissionsData] = await Promise.all([
          getAtelierSettings(),
          getProductTypes(),
          getChronoStats(),
          getRolePermissions()
        ])
        setData({ 
          settings: settingsData, 
          productTypes: typesData, 
          chronoStats: statsData,
          permissions: {
            ADMIN: [],
            CONFECTION: (permissionsData.CONFECTION || []) as AppFeature[], // 🎯 FIX : Cast explicite en AppFeature[]
            BOUTIQUE: (permissionsData.BOUTIQUE || []) as AppFeature[]    // 🎯 FIX : Cast explicite en AppFeature[]
          }
        })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handlePermissionChange = async (role: UserRole, feature: AppFeature, checked: boolean) => {
    // 1. Mise à jour Optimiste de l'UI local
    const currentFeatures = data.permissions[role]
    const updatedFeatures = checked 
      ? [...currentFeatures, feature]
      : currentFeatures.filter(f => f !== feature)

    setData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [role]: updatedFeatures }
    }))

    // 2. Appel de ton action d'upsert à la clé unique
    const res = await updateRolePermission(role, feature, checked)
    if (!res.success) {
      alert("Erreur de synchronisation : " + res.error)
      // Rollback si échec
      setData(prev => ({
        ...prev,
        permissions: { ...prev.permissions, [role]: currentFeatures }
      }))
    }
  }

  const applyAverage = (id: string, avgValue: number) => {
    const input = document.getElementById(`input_time_${id}`) as HTMLInputElement
    if (input) {
      input.value = avgValue.toString()
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
          <p className="text-slate-400 text-sm mt-1">Variables de tarification, matrice des droits et sécurité des comptes.</p>
        </div>
      </div>

      {/* --- BLOC 1 : CONSTANTES FINANCIÈRES --- */}
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
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 relative overflow-hidden">
            <Clock className="absolute -right-4 -bottom-4 text-slate-200/50" size={100} />
            <label className="block text-slate-800 font-bold mb-2 text-sm uppercase tracking-wide">Coût Minute (€)</label>
            <div className="relative z-10">
              <input type="number" step="0.01" min="0.01" name="laborCostPerMin" defaultValue={data.settings?.laborCostPerMin} className="w-full p-3 pl-10 bg-white border border-slate-300 rounded-xl font-black text-lg text-slate-900 focus:outline-none" required />
              <span className="absolute left-3.5 top-3.5 font-black text-slate-400">€</span>
            </div>
          </div>
          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 relative overflow-hidden">
            <Percent className="absolute -right-4 -bottom-4 text-indigo-200/50" size={100} />
            <label className="block text-indigo-900 font-bold mb-2 text-sm uppercase tracking-wide">Marge Commerciale</label>
            <div className="relative z-10">
              <input type="number" step="0.1" min="1.0" name="marginRate" defaultValue={data.settings?.marginRate} className="w-full p-3 pl-10 bg-white border border-indigo-200 rounded-xl font-black text-lg text-indigo-900 focus:outline-none" required />
              <span className="absolute left-3.5 top-3.5 font-black text-indigo-400">x</span>
            </div>
          </div>
          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 relative overflow-hidden">
            <Gauge className="absolute -right-4 -bottom-4 text-amber-200/50" size={100} />
            <label className="block text-amber-900 font-bold mb-2 text-sm uppercase tracking-wide">Objectif d'Audits</label>
            <div className="relative z-10 flex items-center gap-2">
              <input type="number" step="1" min="0" name="auditQuota" defaultValue={data.settings?.auditQuota ?? 10} className="w-16 p-2 bg-white border border-amber-200 rounded-lg font-black text-center text-amber-900" required />
              <span className="text-xs font-bold text-amber-700">pièces par</span>
              <select name="auditPeriod" defaultValue={data.settings?.auditPeriod || 12} className="flex-1 p-2 bg-white border border-amber-200 rounded-lg font-black text-amber-900">
                <option value={1}>Mois</option>
                <option value={3}>Trimestre</option>
                <option value={6}>Semestre (6 mois)</option>
                <option value={12}>An (12 mois)</option>
              </select>
            </div>
          </div>
        </div>
      </form>

      {/* --- BLOC 2 : TEMPS DE CONFECTION --- */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-2 text-emerald-500 font-bold text-lg">
            <Activity size={22} /> Ajustement des Temps de Confection
          </div>
          <button onClick={() => formRef.current?.requestSubmit()} className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 shadow-md flex items-center gap-2">
            <CheckCircle size={16} /> Enregistrer les temps
          </button>
        </div>
        <form ref={formRef} action={async (formData) => {
          const res = await updateProductTypeTimes(formData)
          if (!res.success) alert(res.error)
          else alert("✅ Temps théoriques mis à jour !")
        }} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.productTypes.map((pt) => {
            const stats = data.chronoStats[pt.family]
            const hasData = stats && stats.count > 0
            return (
              <div key={pt.id} className="p-5 border border-slate-200 rounded-2xl flex justify-between items-center bg-slate-50/50 hover:bg-white transition-all shadow-sm gap-4">
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">{pt.name}</p>
                  <span className="text-[10px] uppercase font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md mt-1 inline-block">{pt.family}</span>
                </div>
                <div className="flex items-center gap-4">
                  {hasData && (
                    <button type="button" onClick={() => applyAverage(pt.id, stats.avg)} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                      Utiliser {stats.avg}m <ArrowRight size={12}/>
                    </button>
                  )}
                  <div className="relative w-28 shrink-0">
                    <input id={`input_time_${pt.id}`} type="number" name={`type_${pt.id}`} defaultValue={pt.baseLaborTime} min="0" className="w-full p-2.5 pr-8 text-right font-black text-slate-900 border-2 border-slate-200 rounded-xl focus:border-emerald-500" />
                    <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">min</span>
                  </div>
                </div>
              </div>
            )
          })}
        </form>
      </div>

      {/* 🔒 --- BLOC 3 : DROITS DYNAMIQUES (DÉJÀ COCHÉS D'AVANCE) --- */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-bold text-lg mb-1">
            <ShieldAlert size={22} className="text-amber-500" /> Matrice d'Autorisations Dynamique
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Les modifications se synchronisent instantanément avec l'Enum Prisma. L'accès <strong>ADMIN</strong> reste complet par défaut.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
          {/* GROUPE CONFECTION */}
          <div className="p-6 bg-slate-50 border border-slate-200/60 rounded-3xl space-y-4">
            <h3 className="font-serif font-bold text-slate-800 text-base border-b pb-2">🧵 Groupe CONFECTION (Atelier)</h3>
            <div className="space-y-3">
              {SYSTEM_ROUTES.map((route) => (
                <label key={`conf_${route.feature}`} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-100/50 rounded-xl cursor-pointer border border-slate-100 transition-colors">
                  <input 
                    type="checkbox"
                    // 🎯 LE DYNAMISME EST ICI : On vérifie l'existence de l'enum Prisma reçu dans le tableau
                    checked={data.permissions.CONFECTION.includes(route.feature)}
                    onChange={(e) => handlePermissionChange('CONFECTION', route.feature, e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">{route.label}</p>
                    <p className="font-mono text-[10px] text-slate-400">{route.path}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* GROUPE BOUTIQUE */}
          <div className="p-6 bg-slate-50 border border-slate-200/60 rounded-3xl space-y-4">
            <h3 className="font-serif font-bold text-slate-800 text-base border-b pb-2">🛍️ Groupe BOUTIQUE (Vente)</h3>
            <div className="space-y-3">
              {SYSTEM_ROUTES.map((route) => (
                <label key={`bout_${route.feature}`} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-100/50 rounded-xl cursor-pointer border border-slate-100 transition-colors">
                  <input 
                    type="checkbox"
                    checked={data.permissions.BOUTIQUE.includes(route.feature)}
                    onChange={(e) => handlePermissionChange('BOUTIQUE', route.feature, e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">{route.label}</p>
                    <p className="font-mono text-[10px] text-slate-400">{route.path}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 🔑 --- BLOC 4 : SÉCURITÉ - MODIFICATION DES MOTS DE PASSE --- */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-lg border-b border-slate-100 pb-4">
          <KeyRound size={22} className="text-indigo-500" /> Gestion de la Sécurité des Comptes
        </div>
        
        <form action={async (formData) => {
          const res = await updateAccountPassword(formData)
          if (!res.success) alert("❌ Erreur : " + res.error)
          else {
            alert("✅ Le mot de passe a été modifié avec succès !")
            const f = document.getElementById('password-form') as HTMLFormElement
            if(f) f.reset()
          }
        }} id="password-form" className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Email du compte à modifier</label>
              <input type="email" name="email" placeholder="exemple@nicole-germain.com" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Mot de passe actuel</label>
              <input type="password" name="currentPassword" placeholder="••••••••" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all" required />
            </div>
          </div>
          
          <div className="space-y-4 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Nouveau mot de passe</label>
                <input type="password" name="newPassword" placeholder="••••••••" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Confirmer le mot de passe</label>
                <input type="password" name="confirmPassword" placeholder="••••••••" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-500 transition-all" required />
              </div>
            </div>
            
            <button type="submit" className="w-full p-3 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 mt-2 md:mt-0">
              <EyeOff size={16} /> Mettre à jour les accès de sécurité
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}