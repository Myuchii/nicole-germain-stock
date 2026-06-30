// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

// Export des méthodes HTTP nommées requis par l'App Router
export { handler as GET, handler as POST }