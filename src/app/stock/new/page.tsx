// app/stock/new/page.tsx
export default function NewFabricPage() {
  return (
    <div className="max-w-2xl mx-auto my-12 bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
      <h2 className="text-2xl font-serif font-bold mb-8">Nouveau Tissu</h2>
      
      <form className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Référence</label>
            <input type="text" placeholder="ex: NG-SILK-01" className="w-full p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Nom du Tissu</label>
            <input type="text" placeholder="ex: Soie Sauvage" className="w-full p-3 bg-slate-50 border-none rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Couleur</label>
            <input type="text" className="w-full p-3 bg-slate-50 border-none rounded-xl" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Unité</label>
            <select className="w-full p-3 bg-slate-50 border-none rounded-xl">
              <option>Mètre</option>
              <option>Unité</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Seuil d'alerte</label>
            <input type="number" className="w-full p-3 bg-slate-50 border-none rounded-xl" />
          </div>
        </div>

        <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-colors shadow-lg">
          Enregistrer dans l'inventaire
        </button>
      </form>
    </div>
  )
}