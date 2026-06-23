// src/types/next-auth.d.ts
import { UserRole } from "@prisma/client"
import NextAuth, { DefaultSession } from "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  // 🎯 On enrichit l'objet Session
  interface Session {
    user: {
      id: string
      role: UserRole // ✨ On ajoute le rôle Prisma ici !
    } & DefaultSession["user"]
  }

  // 🎯 On enrichit l'objet User retourné par authorize()
  interface User {
    id: string
    role: UserRole
  }
}

declare module "next-auth/jwt" {
  // 🎯 On enrichit le Token JWT pour qu'il accepte le rôle
  interface JWT {
    role: UserRole
  }
}