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
    const activePermissions = await prisma.rolePermission.findMany({
      where: {
        role: token.role,
        canAccess: true
      }
    })

    // 🎯 FIX : .flatMap() fusionne les sous-tableaux en un seul tableau plat de chaînes !
    const allowedUrls = activePermissions.flatMap(p => FEATURE_URL_MAP[p.feature] || [])

    if (allowedUrls.length === 0) {
      allowedUrls.push(token.role === "CONFECTION" ? "/stock-atelier" : "/stock-boutique")
    }

    // 🚧 Vérification propre : allowedUrls est maintenant une simple string (ex: "/atelier")
    const estAutorise = allowedUrls.some(allowedUrl => url.startsWith(allowedUrl))
    
    if (!estAutorise) {
      const fallback = token.role === "CONFECTION" ? "/stock-atelier" : "/stock-boutique"
      return NextResponse.redirect(new URL(`${fallback}?error=AccessDenied`, req.url))
    }

  } catch (e) {
    console.error("Erreur Middleware Proxy:", e)
    return NextResponse.redirect(new URL("/dashboard", req.url))
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
    "/orders/:path",
    "/clients/:path*",
    "/parametres/:path*"
  ],
}