"use client"
import { createOrUpdateClient } from '@/app/_actions/client-actions'

export default function AddClientPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">Nouveau Client</h1>
        <p className="text-slate-500">Ajoutez une fiche client complète pour la facturation de l'atelier.</p>
      </div>

      <form 
  onSubmit={async (e) => {
    e.preventDefault() // 👈 On empêche le rechargement classique du navigateur
    
    // On extrait manuellement les données du formulaire
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await createOrUpdateClient(formData)
      if (res && !res.success) {
        alert(res.error)
      } else {
        alert("✅ Fiche client enregistrée avec succès !")
      }
    } catch (err) {
      alert("Une erreur est survenue lors de l'enregistrement.")
    }
  }} 
  className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6"
>
        {/* IDENTITÉ */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Nom complet / Contact principal *</label>
          <input name="name" placeholder="ex: Jean Dupont" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Nom de l'entreprise (Optionnel - B2B)</label>
          <input name="company" placeholder="ex: Hôtel Le Monaco" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Adresse Email</label>
            <input name="email" type="email" placeholder="ex: contact@hotelmonaco.com" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Téléphone</label>
            <input name="phone" placeholder="ex: 06 12 34 56 78" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        {/* 🆕 BLOC ADRESSE DE FACTURATION */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Adresse de facturation</h2>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Rue et numéro</label>
            <input name="address" placeholder="ex: 14 Rue de la Paix" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Code Postal</label>
              <input name="zipCode" placeholder="ex: 75002" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Ville</label>
              <input name="city" placeholder="ex: Paris" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Pays</label>
            <input name="country" defaultValue="France" placeholder="ex: France" className="w-full text-slate-500 p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg">
          Enregistrer le client
        </button>
      </form>
    </div>
  )
}