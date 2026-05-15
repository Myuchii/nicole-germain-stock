// app/dashboard/page.tsx
export default async function Dashboard() {
  return (
    <div className="space-y-10">
      {/* Header spécifique */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-slate-900">Vue d'ensemble</h1>
        <p className="text-slate-500">Statistiques de l'atelier au {new Date().toLocaleDateString()}</p>
      </div>

      {/* Chiffres Clés */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Valeur Stock" value="12 450 €" icon="💰" />
        <StatCard title="Mètres Tissu" value="420 m" icon="🧵" />
        <StatCard title="Devis en attente" value="8" icon="⏳" />
        <StatCard title="Alertes Stock" value="3" icon="⚠️" color="text-red-600" />
      </div>

      {/* Graphique ou Activité Récente (Plus tard) */}
      <div className="h-64 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400">
        Journal d'activité (en cours de développement)
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color = "text-slate-900" }: any) {
  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100">
      <div className="text-2xl mb-3">{icon}</div>
      <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}