'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Settings, Menu, X, LogOut } from 'lucide-react'
import { AppFeature } from '@prisma/client'

// 🗺️ 1. Le tableau complet de tes liens principaux
const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", feature: AppFeature.DASHBOARD },
  { href: "/stock-boutique", label: "Stock Boutique", feature: AppFeature.STOCK_BOUTIQUE },
  { href: "/stock-atelier", label: "Stock Atelier", feature: AppFeature.STOCK_ATELIER },
  { href: "/atelier", label: "Atelier", feature: AppFeature.PRODUCTION },
  { href: "/commandes", label: "Commandes", feature: AppFeature.COMMANDES },
  { href: "/clients", label: "Clients", feature: AppFeature.CLIENTS },
  { href: "/approvisionnement", label: "Fournisseurs", feature: AppFeature.FOURNISSEURS },
]

interface NavbarProps {
  userPermissions: string[]
}

export default function Navbar({ userPermissions }: NavbarProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)
  const closeMenu = () => setIsOpen(false)

  // 👑 On récupère le rôle de la session Next-Auth (sécurisé)
  const userRole = session?.user?.role || "CONFECTION"
  const isAdmin = userRole === "ADMIN"

  // 🔍 2. Filtrage des liens principaux
  const visibleItems = NAV_ITEMS.filter(item => 
    isAdmin || userPermissions.includes(item.feature)
  )

  // 🎯 3. Conditionnement dynamique des accès spécifiques
  const hasQuotesAccess = isAdmin || userPermissions.includes(AppFeature.QUOTES)
  const hasSettingsAccess = isAdmin || userPermissions.includes(AppFeature.SETTINGS)

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* LOGO */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-serif font-bold">NG</div>
          <span className="font-serif font-bold text-xl tracking-tight text-slate-900">Nicole Germain</span>
        </div>

        {/* 💻 LIENS CENTRAUX DYNAMIQUES (Ordinateur) */}
        <div className="hidden lg:flex items-center gap-1">
          {visibleItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href} 
              className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* ACTIONS DROITE */}
        <div className="hidden lg:flex items-center gap-3">
          {/* 📜 Bouton Devis masqué si l'utilisateur n'a pas le droit */}
          {hasQuotesAccess && (
            <Link href="/quotes" className="px-5 py-2.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-100">
              Nouveau Devis
            </Link>
          )}

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            {/* ⚙️ L'engrenage s'affiche pour l'ADMIN ou si autorisé en BDD */}
            {hasSettingsAccess && (
              <Link 
                href="/settings" // 🎯 Ajuste sur "/parametres" si ton dossier s'appelle comme ça
                className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all" 
                title="Paramètres de l'Atelier"
              >
                <Settings size={20} />
              </Link>
            )}

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
              title="Quitter la session"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* 📱 BOUTON BURGER (Mobile) */}
        <div className="flex lg:hidden items-center gap-2">
          <button 
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl"
          >
            <LogOut size={20} />
          </button>
          
          <button 
            onClick={toggleMenu}
            className="p-2 text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </div>

      {/* 🍔 MENU DÉROULANT MOBILE DYNAMIQUE */}
      {isOpen && (
        <div className="lg:hidden bg-white border-b border-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-6 pt-2 pb-6 space-y-1 flex flex-col">
            {visibleItems.map((item) => (
              <Link 
                key={item.href} 
                href={item.href} 
                onClick={closeMenu} 
                className="px-4 py-3 rounded-xl text-base font-medium text-slate-600 hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}

            {hasSettingsAccess && (
              <Link 
                href="/settings" 
                onClick={closeMenu} 
                className="px-4 py-3 rounded-xl text-base font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2"
              >
                <Settings size={18}/>Paramètres
              </Link>
            )}
            
            {hasQuotesAccess && (
              <div className="pt-4 border-t border-slate-100 mt-2">
                <Link 
                  href="/quotes" 
                  onClick={closeMenu} 
                  className="w-full block py-3.5 rounded-xl text-center text-sm font-semibold bg-slate-900 text-white hover:bg-indigo-600 transition-all shadow-md"
                >
                  Nouveau Devis
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}