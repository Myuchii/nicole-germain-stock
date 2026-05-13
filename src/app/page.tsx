// app/page.tsx
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 font-sans">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
        <h1 className="text-6xl font-serif font-bold mb-6 bg-gradient-to-r from-slate-900 to-indigo-800 bg-clip-text text-transparent">
          Nicole Germain
        </h1>
        <p className="text-xl text-slate-500 mb-12 max-w-2xl mx-auto">
          Système de gestion d'inventaire textile et outil de chiffrage sur-mesure pour l'atelier.
        </p>

        <div className="grid md:grid-cols-2 gap-8 mt-16">
          {/* Carte Dashboard */}
          <Link href="/dashboard" className="group p-10 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-indigo-600 hover:scale-[1.02] transition-all duration-300 shadow-sm">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📊</div>
            <h2 className="text-2xl font-bold mb-2 group-hover:text-white">Tableau de Bord</h2>
            <p className="text-slate-500 group-hover:text-indigo-100">
              Consulter l'état des stocks en temps réel et les alertes de réapprovisionnement.
            </p>
          </Link>

          {/* Carte Calculateur (on pointe vers le dashboard pour l'instant) */}
          <Link href="/dashboard" className="group p-10 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-slate-900 hover:scale-[1.02] transition-all duration-300 shadow-sm">
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🧮</div>
            <h2 className="text-2xl font-bold mb-2 group-hover:text-white">Calculateur Devis</h2>
            <p className="text-slate-500 group-hover:text-slate-300">
              Estimer le prix de vente d'une création selon les matières et le temps de production.
            </p>
          </Link>
        </div>
      </div>

      {/* Footer Discret */}
      <footer className="fixed bottom-8 w-full text-center text-slate-400 text-sm">
        © 2026 Atelier Nicole Germain — Outil Interne
      </footer>
    </main>
  )
}