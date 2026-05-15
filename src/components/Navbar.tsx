import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-serif font-bold">NG</div>
          <span className="font-serif font-bold text-xl tracking-tight text-slate-900">Nicole Germain</span>
        </div>

        {/* Menu */}
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Tableau de bord</Link>
          <Link href="/stock" className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Stock tissus</Link>
          <Link href="/orders" className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Commandes</Link>
          <Link href="/quotes" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100">Nouveau Devis</Link>
        </div>
      </div>
    </nav>
  )
}