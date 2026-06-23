// src/lib/auth.ts
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma" 
import bcrypt from "bcrypt"

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

        // 1. Recherche de l'utilisateur
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })
        if (!user || !user.password) return null

        // 2. Vérification du mot de passe haché
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) return null

        // 3. Retour de l'objet utilisateur
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
    // 🚀 1. Au moment de la création/mise à jour du Token
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role // Ici, user.role est déjà du bon type UserRole
      }
      return token
    },
    
    // 🚀 2. On transmet le rôle typé à la session client
    async session({ session, token }) {
      if (session.user && token.role) {
        // On cast explicitement vers le type UserRole importé de Prisma
        session.user.role = token.role as import('@prisma/client').UserRole
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  }
}