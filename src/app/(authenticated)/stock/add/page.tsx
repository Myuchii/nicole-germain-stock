import { createOrUpdateFabric } from '@/app/_actions/fabric-actions'

export default function AddFabricPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">Nouveau Tissu</h1>
        <p className="text-slate-500">Ajoutez une référence à l'inventaire de Nicole Germain.</p>
      </div>

      <form action={createOrUpdateFabric} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Référence</label>
            <input name="reference" placeholder="ex: SOIE-001" className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Nom du tissu</label>
            <input name="name" placeholder="ex: Satin de Soie" className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Couleur</label>
            <input name="color" placeholder="ex: Bleu Nuit" className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" required />
          </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Unité</label>
          <select 
            name="unit" 
            defaultValue=""
            className="w-full p-3 bg-slate-50 text-slate-700 rounded-xl border-none focus:ring-2 focus:ring-indigo-500 font-medium outline-none invalid:text-slate-400"
            required
          >
            <option value="" disabled className="text-slate-400">-- Choisir une unité --</option>
            <option value="METER" className="text-slate-900">Mètre</option>
            <option value="UNIT" className="text-slate-900">Unité (pièce)</option>
          </select>
        </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Quantité (Métrage ou Unités)</label>
            <input 
              name="stock" 
              type="number" 
              step="0.01" 
              placeholder="ex: 50.5" 
              className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" 
              required 
            />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Laize (Largeur du rouleau en cm)</label>
          <input 
            name="width" 
            type="number" 
            placeholder="ex: 280" 
            className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" 
          />
        </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Prix d'achat HT (au mètre/unité)</label>
            <input 
              name="price" 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              className="w-full p-3 bg-slate-50 placeholder-slate-400 rounded-xl border-none focus:ring-2 focus:ring-indigo-500" 
              required 
            />
          </div>
        </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Seuil d'alerte (🚨)</label>
            <input 
              name="alertThreshold" 
              type="number" 
              step="0.1" 
              defaultValue="5" 
              className="w-full p-3 bg-amber-50 placeholder-amber-400 text-amber-900 rounded-xl border border-amber-100 focus:ring-2 focus:ring-amber-500 font-bold" 
              required 
            />
          </div>

        <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg">
          Enregistrer le tissu
        </button>
      </form>
    </div>
  )
}