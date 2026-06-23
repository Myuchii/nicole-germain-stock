'use client'

import { useState } from 'react'
import { handleUniversalStockAdd } from '@/app/_actions/fabric-actions'
import { Scissors, Paperclip } from 'lucide-react'
import LocationSwitch from '@/components/LocationSwitch'

export default function AddStockPage() {
  const [itemType, setItemType] = useState<'TISSU' | 'ACCESSOIRE'>('TISSU')

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">Nouveau Référencement</h1>
        <p className="text-slate-500">Ajoutez une matière ou un accessoire à l'inventaire de Nicole Germain.</p>
      </div>

      <form action={handleUniversalStockAdd} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        
        {/* 🔀 SÉLECTEUR DE TYPE */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-700">Que souhaitez-vous ajouter au stock ?</label>
          <div className="grid grid-cols-2 gap-4">
            <label className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${itemType === 'TISSU' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-600'}`}>
              <input type="radio" name="itemType" value="TISSU" checked={itemType === 'TISSU'} onChange={() => setItemType('TISSU')} className="sr-only" />
              <Scissors size={20}/> <span className="font-bold">Rouleau de Tissu</span>
            </label>
            <label className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${itemType === 'ACCESSOIRE' ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-600'}`}>
              <input type="radio" name="itemType" value="ACCESSOIRE" checked={itemType === 'ACCESSOIRE'} onChange={() => setItemType('ACCESSOIRE')} className="sr-only" />
              <Paperclip size={20}/> <span className="font-bold">Accessoire / Mercerie</span>
            </label>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* 📝 CHAMPS COMMUNS */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Référence</label>
            <input name="reference" placeholder={itemType === 'TISSU' ? "ex: SOIE-001" : "ex: ZIP-INV-40"} className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Désignation</label>
            <input name="name" placeholder={itemType === 'TISSU' ? "ex: Satin de Soie" : "ex: Fermeture Éclair Invisible"} className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
        </div>

        {/* 🎨 CHAMPS DYNAMIQUES */}
        {itemType === 'TISSU' ? (
          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Couleur</label>
              <input name="color" placeholder="ex: Bleu Nuit" className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Laize (cm)</label>
              <input name="width" type="number" placeholder="ex: 280" className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Unité</label>
              <select name="unit" defaultValue="METER" className="w-full p-3 bg-slate-50 text-slate-700 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-medium outline-none">
                <option value="METER">Mètre</option>
                <option value="UNIT">Unité (pièce)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Catégorie</label>
            <input name="category" placeholder="ex: Zips, Boutons, Élastiques, Fils..." className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
        )}

        {/* 📍 SÉLECTEUR DE LOCALISATION (NOUVEAU) */}
        <div className="space-y-3 pt-2">
          <label className="text-sm font-bold text-slate-700">Où est stockée cette marchandise ?</label>
          <div className="flex gap-4">
            <label className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-slate-800 has-[:checked]:bg-slate-800 has-[:checked]:text-white">
              <input type="radio" name="location" value="ATELIER" defaultChecked className="sr-only" />
              <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-current opacity-0 transition-opacity"></div>
              </div>
              <span className="font-bold text-sm">🧵 Atelier (Production)</span>
            </label>
            <label className="flex-1 flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-all has-[:checked]:border-slate-800 has-[:checked]:bg-slate-800 has-[:checked]:text-white">
              <input type="radio" name="location" value="BOUTIQUE" className="sr-only" />
              <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-current opacity-0 transition-opacity"></div>
              </div>
              <span className="font-bold text-sm">🛍️ Boutique (Magasin)</span>
            </label>
          </div>
          {/* Petite astuce CSS pour animer le bouton radio coché */}
          <style jsx>{`
            input:checked + div > div { opacity: 1; }
          `}</style>
        </div>

        <hr className="border-slate-100" />

        {/* 🔢 STOCK ET COMPTABILITÉ */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">{itemType === 'TISSU' ? "Quantité (Métrage ou Unités)" : "Quantité reçue"}</label>
            <input name="stock" type="number" step="0.01" placeholder={itemType === 'TISSU' ? "ex: 50.5" : "ex: 100"} className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Prix d'achat HT ({itemType === 'TISSU' ? "au mètre" : "à l'unité"})</label>
            <input name="price" type="number" step="0.01" placeholder="0.00" className="w-full p-3 bg-emerald-50 placeholder-emerald-300 text-emerald-800 rounded-xl border-none focus:ring-2 focus:ring-emerald-500 font-bold" required />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Seuil d'alerte (🚨)</label>
          <input name="alertThreshold" type="number" step="0.1" defaultValue={itemType === 'TISSU' ? "5" : "20"} className="w-full p-3 bg-red-50 placeholder-red-300 text-red-900 rounded-xl border-none focus:ring-2 focus:ring-red-500 font-bold" required />
        </div>

        {/* ✅ SOUMISSION */}
        <button type="submit" className={`w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-lg mt-2 ${itemType === 'TISSU' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`}>
          {itemType === 'TISSU' ? "Enregistrer le tissu" : "Enregistrer l'accessoire"}
        </button>
      </form>
    </div>
  )
}