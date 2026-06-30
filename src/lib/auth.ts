// src/lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma" 
import { UserRole } from "@prisma/client" // 🎯 Ajout de l'import de l'Enum
import bcrypt from "bcryptjs" // Préfère bcryptjs pour Next.js App Router

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt", 
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        if (!user || !user.password) return null

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        if (!isPasswordValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    // 🚀 1. Au moment de la création/mise à jour du Token (avec trigger dynamique)
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = user.role
        token.email = user.email
      }

      // 🎯 SÉCURITÉ DYNAMIQUE : Force la relecture en BDD si appel à update() ou si absent
      if (trigger === "update" || !token.permissions) {
        const dbUser = await prisma.user.findUnique({ 
          where: { email: token.email as string } 
        })
        
        if (dbUser) {
          token.role = dbUser.role
          
          // On va chercher ses droits réels enregistrés dans la table RolePermission
          const perms = await prisma.rolePermission.findMany({
            where: { 
              role: dbUser.role as UserRole, 
              canAccess: true 
            }
          })
          // On transforme les lignes en tableau d'Enums stricts : ['PRODUCTION', 'QUOTES', ...]
          token.permissions = perms.map(p => p.feature)
        }
      }
      return token
    },
    
    // 🚀 2. On transmet le rôle ET les permissions à la session client (Navbar + Toggles)
    async session({ session, token }) {
      if (session.user) {
        if (token.role) {
          session.user.role = token.role as UserRole
        }
        if (token.permissions) {
          // 🆕 On injecte le tableau pour que l'interface client puisse s'ajuster
          session.user.permissions = token.permissions as any[]
        }
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  }
}