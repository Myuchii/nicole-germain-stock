// src/components/PermissionsManager.tsx
"use client"

import { useState, useTransition } from 'react'
import { UserRole, AppFeature } from '@prisma/client'
import { updateRolePermission } from '@/app/_actions/permission-actions' // Assure-toi que cette action prend (role, feature, canAccess)
import { Shield, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'

interface PermissionState {
  role: UserRole
  feature: AppFeature
  canAccess: boolean
}

interface PermissionsManagerProps {
  initialPermissions: PermissionState[]
}

const FEATURE_LABELS: Record<AppFeature, string> = {
  DASHBOARD: "📊 Tableau de bord principal",
  STOCK_BOUTIQUE: "🏪 Gestion du Stock Boutique",
  STOCK_ATELIER: "📦 Réserve de Matières Premières Atelier",
  PRODUCTION: "🪡 Atelier de Production (Suivi des Chronos & Coupe)",
  QUOTES: "📜 Création & Chiffrage des Devis (Calculateur)", // 🆕 Elle est là !
  COMMANDES: "📝 Suivi des Commandes & Factures",
  FOURNISSEURS: "📦 Centrale d'Approvisionnement Grossistes",
  CLIENTS: "👥 Fiches Clients (CRM)",
  SETTINGS: "⚙️ Paramètres Généraux du Système",
}

export default function PermissionsManager({ initialPermissions }: PermissionsManagerProps) {
  const [permissions, setPermissions] = useState<PermissionState[]>(initialPermissions)
  const [isPending, startTransition] = useTransition()
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const { update } = useSession() // 🚀 2. On récupère la fonction de mise à jour de la session

  const handleToggle = (role: UserRole, feature: AppFeature, currentStatus: boolean) => {
    const newStatus = !currentStatus

    setPermissions(prev => {
      const exists = prev.some(p => p.role === role && p.feature === feature)
      if (exists) {
        return prev.map(p => (p.role === role && p.feature === feature) ? { ...p, canAccess: newStatus } : p)
      } else {
        return [...prev, { role, feature, canAccess: newStatus }]
      }
    })

    startTransition(async () => {
      const res = await updateRolePermission(role, feature, newStatus)
      if (res.success) {
        setStatusMessage({ type: 'success', text: `Droits mis à jour pour le rôle ${role}.` })
        
        // 🚀 3. LA LIGNE MAGIQUE : On force Next-Auth à recharger la session
        // Cela va instantanément recalculer les rôles et mettre à jour la Navbar !
        await update() 
        
      } else {
        setStatusMessage({ type: 'error', text: res.error || "Une erreur est survenue." })
        setPermissions(prev => prev.map(p => 
          (p.role === role && p.feature === feature) ? { ...p, canAccess: currentStatus } : p
        ))
      }
    })
  }

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider">
            <Shield size={16} /> Matrice de sécurité Nicole Germain
          </div>
          <h2 className="font-serif font-bold text-2xl text-slate-900">Droits d'accès de l'Atelier</h2>
          <p className="text-xs text-slate-400">Configurez les modules accessibles pour la Confection et la Boutique.</p>
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-bold bg-indigo-50 px-3 py-1.5 rounded-full animate-pulse">
            <RefreshCw size={12} className="animate-spin" /> Écriture en base...
          </div>
        )}
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
          statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          {statusMessage.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {statusMessage.text}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-100">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              <th className="p-4">Fonctionnalité / Page</th>
              <th className="p-4 text-center w-44 text-emerald-700 bg-emerald-50/30">🪡 CONFECTION</th>
              <th className="p-4 text-center w-44 text-blue-700 bg-blue-50/30">🏪 BOUTIQUE</th>
              <th className="p-4 text-center w-36 bg-slate-100/50">👑 ADMIN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-bold text-slate-700">
            {/* 🔄 REMPLACE LIGNE 81 PAR CELLE-CI : */}
{(Object.keys(FEATURE_LABELS) as AppFeature[]).map((feature) => {
  const confPerm = permissions.find(p => p.role === UserRole.CONFECTION && p.feature === feature) || { role: UserRole.CONFECTION, feature, canAccess: false }
  const boutPerm = permissions.find(p => p.role === UserRole.BOUTIQUE && p.feature === feature) || { role: UserRole.BOUTIQUE, feature, canAccess: false }
  
  return (
    <tr key={feature} className="hover:bg-slate-50/60 transition-colors">
      <td className="p-4 font-medium text-slate-800 text-sm">
        {FEATURE_LABELS[feature]}
      </td>
      
      {/* 🪡 Colonne CONFECTION */}
      <td className="p-4 text-center bg-emerald-50/10">
        <button
          onClick={() => handleToggle(UserRole.CONFECTION, feature, confPerm.canAccess)}
          disabled={isPending}
          className={`mx-auto h-6 w-11 rounded-full p-0.5 transition-colors cursor-pointer focus:outline-none flex ${
            confPerm.canAccess ? 'bg-emerald-600 justify-end' : 'bg-slate-200 justify-start'
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform" />
        </button>
      </td>

      {/* 🏪 Colonne BOUTIQUE */}
      <td className="p-4 text-center bg-blue-50/10">
        <button
          onClick={() => handleToggle(UserRole.BOUTIQUE, feature, boutPerm.canAccess)}
          disabled={isPending}
          className={`mx-auto h-6 w-11 rounded-full p-0.5 transition-colors cursor-pointer focus:outline-none flex ${
            boutPerm.canAccess ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'
          }`}
        >
          <span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform" />
        </button>
      </td>

      {/* 👑 Colonne ADMIN */}
      <td className="p-4 text-center bg-slate-50/30">
        <button disabled className="mx-auto h-6 w-11 rounded-full p-0.5 bg-indigo-600/30 flex justify-end cursor-not-allowed">
          <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </button>
      </td>
    </tr>
  )
})}
          </tbody>
        </table>
      </div>
    </div>
  )
}