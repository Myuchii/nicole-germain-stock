// proxy.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt" // 🎯 On récupère le décodeur de token officiel
import { AppFeature } from "@prisma/client"

const FEATURE_URL_MAP: Record<AppFeature, string[]> = {
  DASHBOARD: ["/dashboard"],
  STOCK_BOUTIQUE: ["/stock-boutique"],
  STOCK_ATELIER: ["/stock-atelier"],
  PRODUCTION: ["/atelier"],
  QUOTES: ["/quotes", "/devis"],         
  COMMANDES: ["/commandes", "/orders"], 
  FOURNISSEURS: ["/approvisionnement", "/fournisseurs"],
  CLIENTS: ["/clients"],
  SETTINGS: ["/settings", "/parametres"]
}

// 🎯 On repasse sur une signature de middleware Next.js standard
export async function proxy(req: NextRequest) {
  const url = req.nextUrl.pathname

  // 🎯 On extrait le token manuellement du cookie sécurisé
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // 1. Si pas de session, retour direct au login
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // 2. 👑 ADMIN garde un accès complet absolu
  if (token.role === "ADMIN") {
    return NextResponse.next()
  }

  // 3. 🚧 Barrière physique immédiate pour CONFECTION sur la racine admin
  if (token.role === "CONFECTION" && url.startsWith("/dashboard")) {
    console.log("🚨 BLOCAGE : Tentative d'accès de CONFECTION à /dashboard interceptée !");
    return NextResponse.redirect(new URL("/stock-atelier?error=AccessDenied", req.url))
  }

  // 4. 🎯 Lecture des permissions stockées dans le JWT (Étape de ton fichier auth.ts)
  const userPermissions = (token.permissions || []) as AppFeature[]
  const allowedUrls = userPermissions.flatMap(feature => FEATURE_URL_MAP[feature] || [])

  if (allowedUrls.length === 0) {
    allowedUrls.push(token.role === "CONFECTION" ? "/stock-atelier" : "/stock-boutique")
  }

  // 5. Validation de la route
  const estAutorise = allowedUrls.some(allowedUrl => url.startsWith(allowedUrl))
  
  if (!estAutorise) {
    const fallback = token.role === "CONFECTION" ? "/stock-atelier" : "/stock-boutique"
    return NextResponse.redirect(new URL(`${fallback}?error=AccessDenied`, req.url))
  }

  return NextResponse.next()
}

// ❌ ON SUPPRIME l'export default withAuth qui court-circuitait tout !

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/stock-boutique",
    "/stock-boutique/:path*",
    "/stock-atelier",
    "/stock-atelier/:path*",
    "/approvisionnement",
    "/approvisionnement/:path*",
    "/commandes",
    "/commandes/:path*",
    "/orders",
    "/orders/:path*",
    "/clients",
    "/clients/:path*",
    "/parametres",
    "/parametres/:path*"
  ],
}