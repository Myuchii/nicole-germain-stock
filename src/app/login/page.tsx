// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, Mail, AlertCircle, RefreshCw } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
// 2. Dans ta fonction handleSubmit :
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setError(null)
  setLoading(true)

  try {
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false, 
    })

    if (res?.error) {
      setError("Identifiants incorrects.")
      setLoading(false)
    } else {
      // 🚀 On récupère la session fraîchement créée pour lire le rôle
      const session = await getSession()
      const role = session?.user?.role

      // 🔀 Aiguillage dynamique selon le profil métier
      if (role === "ADMIN") {
        router.push('/dashboard')
      } else if (role === "CONFECTION") {
        router.push('/stock-atelier') //atterrir directement à l'atelier
      } else if (role === "BOUTIQUE") {
        router.push('/stock-boutique') //atterrir directement à la boutique
      } else {
        router.push('/dashboard')
      }

      router.refresh()
    }
  } catch (err) {
    setError("Une erreur réseau est survenue.")
    setLoading(false)
  }
}

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      {/* Côté Gauche : Identité Visuelle Atelier */}
      <div className="hidden lg:flex bg-slate-900 relative p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-25 bg-[url('https://images.unsplash.com/photo-1558603668-6570496b66f8?q=80&w=1000')] bg-cover bg-center" />
        <div className="relative z-10">
          <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full font-mono font-bold tracking-wider uppercase">ERP Nicole Germain</span>
          <h1 className="text-4xl font-serif font-bold text-white mt-6 leading-tight">L'excellence <br/>du geste.</h1>
        </div>
        <div className="relative z-10 text-slate-500 text-xs font-mono">
          © {new Date().getFullYear()} Atelier de Confection Nicole Germain
        </div>
      </div>

      {/* Côté Droit : Formulaire de Connexion Sécurisé */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-serif font-bold text-slate-900">Bienvenue</h2>
            <p className="text-slate-400 text-xs uppercase tracking-wider mt-2 font-bold">Accédez à votre gestion d'atelier</p>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle size={16} className="text-rose-500 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
            <div className="space-y-1">
              <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Identifiant Connexion</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={16} />
                <input 
                  type="email" 
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@nicolegermain.com" 
                  className="w-full p-4 pl-11 bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:border-slate-900 transition-all font-bold" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Clé de sécurité</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={16} />
                <input 
                  type="password" 
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••" 
                  className="w-full p-4 pl-11 bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-2xl focus:outline-none focus:border-slate-900 transition-all font-bold" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed text-xs"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Vérification...
                </>
              ) : (
                "Se connecter au système"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}