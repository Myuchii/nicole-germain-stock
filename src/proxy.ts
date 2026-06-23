// proxy.ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { PrismaClient, AppFeature } from "@prisma/client"

const prisma = new PrismaClient()

const FEATURE_URL_MAP: Record<AppFeature, string[]> = {
  DASHBOARD: ["/dashboard"],
  STOCK_BOUTIQUE: ["/stock-boutique"],
  STOCK_ATELIER: ["/stock-atelier"],
  PRODUCTION: ["/atelier"],
  QUOTES: ["/quotes", "/devis"],         // 🆕 Protection stricte du dossier Devis
  COMMANDES: ["/commandes", "/orders"], // 📝 Uniquement les commandes et paniers validés
  FOURNISSEURS: ["/approvisionnement", "/fournisseurs"],
  CLIENTS: ["/clients"],
  SETTINGS: ["/settings", "/parametres"]
}

export async function middleware(req: any) {
  const token = req.nextauth?.token
  const url = req.nextUrl.pathname

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // 👑 ADMIN garde un accès complet absolu
  if (token.role === "ADMIN") {
    return NextResponse.next()
  }

  try {
    // 🔍 On récupère toutes les fonctionnalités activées pour ce rôle spécifique
    const activePermissions = await prisma.rolePermission.findMany({
      where: {
        role: token.role,
        canAccess: true
      }
    })

    // 🗺️ On transforme la liste des énumérations trouvées en URLs réelles
    const pagesAutorisees = activePermissions.map(p => FEATURE_URL_MAP[p.feature]).filter(Boolean)

    // Si aucune permission n'est configurée, on autorise quand même le dashboard ou l'espace par défaut pour éviter un crash
    // 🛡️ Si aucune permission n'est configurée, on autorise quand même l'espace par défaut dans un sous-tableau
    if (pagesAutorisees.length === 0) {
      pagesAutorisees.push(token.role === "CONFECTION" ? ["/stock-atelier"] : ["/stock-boutique"])
    }

    // 🚧 Vérification de l'URL demandée
    const estAutorise = pagesAutorisees.some(page => url.startsWith(page))
    
    if (!estAutorise) {
      // Redirection personnalisée vers sa page d'accueil par défaut en cas de refus
      const fallback = token.role === "CONFECTION" ? "/stock-atelier" : "/stock-boutique"
      return NextResponse.redirect(new URL(`${fallback}?error=AccessDenied`, req.url))
    }

  } catch (e) {
    console.error("Erreur Middleware Proxy:", e)
    // En cas de problème de connexion temporaire à Neon, on laisse passer vers la racine par sécurité
    if (url !== "/dashboard") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }

  return NextResponse.next()
}

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/stock-boutique/:path*",
    "/stock-atelier/:path*",
    "/approvisionnement/:path*",
    "/commandes/:path*",
    "/clients/:path*",
    "/parametres/:path*"
  ],
}