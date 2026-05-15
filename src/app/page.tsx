import Link from 'next/link'

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Côté Gauche : Image Atelier (on utilise un dégradé élégant pour l'instant) */}
      <div className="hidden lg:flex bg-slate-900 relative p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1558603668-6570496b66f8?q=80&w=1000')] bg-cover bg-center" />
        <div className="relative z-10">
          <h1 className="text-4xl font-serif font-bold text-white">L'excellence <br/>du geste.</h1>
        </div>
        <div className="relative z-10 text-slate-400 text-sm">© 2026 Atelier de Confection Nicole Germain</div>
      </div>

      {/* Côté Droit : Formulaire */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-serif font-bold text-slate-900">Bienvenue</h2>
            <p className="text-slate-500 mt-2">Accédez à votre gestion d'atelier</p>
          </div>
          
          <form className="space-y-4">
            <input type="email" placeholder="Email professionnel" className="w-full p-4 bg-mauve-400 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all" />
            <input type="password" placeholder="Mot de passe" className="w-full p-4 bg-mauve-400 border-none rounded-2xl focus:ring-2 focus:ring-slate-900 transition-all" />
            <Link href="/dashboard">
            <button className="w-full py-4 bg-mauve-900 text-white rounded-2xl font-bold hover:shadow-2xl hover:-translate-y-1 transition-all">
              Se connecter
            </button>
            </Link>
          </form>
        </div>
      </div>
    </main>
  )
}