// À remplacer au début de ton fichier src/app/_actions/settings-actions.ts
'use server'

import { PrismaClient, UserRole, AppFeature } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
export async function getRolePermissions() {
  try {
    const permissions = await prisma.rolePermission.findMany({
      where: { canAccess: true }
    })
    
    const matrix: Record<string, string[]> = {
      CONFECTION: [],
      BOUTIQUE: []
    }

    // 🎯 FIX : On pousse directement la feature (l'Enum Prisma brut, ex: "PRODUCTION")
    // au lieu de pousser le chemin d'URL !
    permissions.forEach(p => {
      if (matrix[p.role]) {
        matrix[p.role].push(p.feature) // Transmet directement "PRODUCTION", "QUOTES", etc.
      }
    })

    return matrix
  } catch (error) {
    console.error("Erreur getRolePermissions:", error)
    return { CONFECTION: [], BOUTIQUE: [] }
  }
}

// 💾 2. Sauvegarder ou inverser le droit d'accès
export async function updateRolePermissions(role: UserRole, routes: string[]) {
  try {
    // Liste des correspondances inverses (de l'URL vers l'Enum de ton schéma)
    const urlToFeatureMap: Record<string, AppFeature> = {
      '/dashboard': AppFeature.DASHBOARD,
      '/stock-boutique': AppFeature.STOCK_BOUTIQUE,
      '/stock-atelier': AppFeature.STOCK_ATELIER,
      '/commandes': AppFeature.COMMANDES,
      '/approvisionnement': AppFeature.FOURNISSEURS,
      '/clients': AppFeature.CLIENTS,
      '/settings': AppFeature.SETTINGS
    }

    // Pour chaque fonctionnalité disponible dans le système
    const promises = Object.entries(urlToFeatureMap).map(([path, feature]) => {
      const hasAccess = routes.includes(path)

      return prisma.rolePermission.upsert({
        where: {
          role_feature: { role, feature } // 🎯 Utilise ton index @@unique composite
        },
        update: { canAccess: hasAccess },
        create: { role, feature, canAccess: hasAccess }
      })
    })

    await prisma.$transaction(promises)
    
    revalidatePath('/parametres')
    return { success: true }
  } catch (error: any) {
    console.error("Erreur updateRolePermissions:", error)
    return { success: false, error: error.message }
  }
}

// --- 1. GESTION FINANCIÈRE GLOBALE ---

export async function getAtelierSettings() {
  let settings = await prisma.atelierSettings.findUnique({ where: { id: "global" } })
  
  if (!settings) {
    settings = await prisma.atelierSettings.create({
      data: { 
        id: "global", 
        marginRate: 2.5,
        laborCostPerMin: 0.35,
        auditQuota: 10,   // 10 pièces
        auditPeriod: 12   // Par an
      }
    })
  }
  return settings
}

export async function updateAtelierSettings(formData: FormData) {
  const marginRate = parseFloat(formData.get('marginRate') as string)
  const laborCostPerMin = parseFloat(formData.get('laborCostPerMin') as string)
  const auditQuota = parseInt(formData.get('auditQuota') as string)
  const auditPeriod = parseInt(formData.get('auditPeriod') as string)

  if (isNaN(marginRate) || isNaN(laborCostPerMin) || isNaN(auditQuota) || isNaN(auditPeriod)) {
    return { success: false, error: "Valeurs invalides." }
  }

  try {
    await prisma.atelierSettings.upsert({
      where: { id: "global" },
      update: { marginRate, laborCostPerMin, auditQuota, auditPeriod },
      create: { id: "global", marginRate, laborCostPerMin, auditQuota, auditPeriod }
    })
    revalidatePath('/parametres')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur updateAtelierSettings:", e)
    return { success: false, error: "Erreur lors de la sauvegarde" }
  }
}

// --- 2. GESTION DES TYPES DE PRODUITS ---

export async function getProductTypes() {
  try {
    let types = await prisma.productType.findMany({
      orderBy: { name: 'asc' }
    })

    if (types.length === 0) {
      const defaultTypes = [
        { name: 'Drap Housse / Protège Matelas', family: 'FITTED', baseLaborTime: 30 },
        { name: 'Housse de Couette / Taie', family: 'ENVELOPE', baseLaborTime: 45 },
        { name: 'Drap Plat / Nappe', family: 'FLAT', baseLaborTime: 20 },
        { name: 'Traversin', family: 'BOLSTER', baseLaborTime: 15 },
        { name: 'Ouvrage Rond', family: 'ROUND', baseLaborTime: 60 },
      ]

      for (const t of defaultTypes) {
        await prisma.productType.create({ data: t })
      }
      types = await prisma.productType.findMany({ orderBy: { name: 'asc' } })
    }

    return types
  } catch (error) {
    console.error("Erreur getProductTypes:", error)
    return [] 
  }
}

export async function updateProductTypeTimes(formData: FormData) {
  try {
    const entries = Array.from(formData.entries())
    
    const updatePromises = entries
      .filter(([key]) => key.startsWith('type_'))
      .map(([key, value]) => {
        const id = key.replace('type_', '')
        const baseLaborTime = parseInt(value as string, 10)

        if (!isNaN(baseLaborTime) && baseLaborTime >= 0) {
          return prisma.productType.update({
            where: { id },
            data: { baseLaborTime }
          })
        }
      })
      .filter(Boolean)

    await prisma.$transaction(updatePromises as any)

    revalidatePath('/parametres')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur updateProductTypeTimes:", e)
    return { success: false, error: "Impossible de mettre à jour les temps d'atelier" }
  }
}

// --- 3. ANALYSE DES AUDITS CHRONOS (La fonction qui te manquait !) ---

export async function getChronoStats() {
  try {
    const allTimedItems = await prisma.quoteItem.findMany({
      where: { finishedAt: { not: null }, startedCoutureAt: { not: null } },
      include: { quote: true }
    })

    const statsMap = new Map<string, { totalMin: number, count: number }>()

    allTimedItems.forEach(item => {
      const jsonProducts = (item.quote.products as any[]) || []
      const matched = jsonProducts.find(p => p.fabricId === item.fabricId) || jsonProducts[0]
      const family = matched?.family || 'CUSTOM'

      if (item.finishedAt && item.startedCoutureAt) {
        const realMin = Math.round((new Date(item.finishedAt).getTime() - new Date(item.startedCoutureAt).getTime()) / 1000 / 60)
        
        const current = statsMap.get(family) || { totalMin: 0, count: 0 }
        statsMap.set(family, { totalMin: current.totalMin + realMin, count: current.count + 1 })
      }
    })

    // Transformation en dictionnaire : { 'FITTED': { avg: 28, count: 12 }, ... }
    const result: Record<string, { avg: number, count: number }> = {}
    statsMap.forEach((data, family) => {
      result[family] = {
        avg: Math.round(data.totalMin / data.count),
        count: data.count
      }
    })

    return result
  } catch (error) {
    console.error("Erreur getChronoStats:", error)
    return {}
  }
}

export async function updateAccountPassword(formData: FormData) {
  try {
    const email = formData.get('email') as string
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!email || !currentPassword || !newPassword) {
      return { success: false, error: "Tous les champs sont obligatoires." }
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: "Les nouveaux mots de passe ne correspondent pas." }
    }

    // 1. Trouver l'utilisateur
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) {
      return { success: false, error: "Utilisateur introuvable." }
    }

    // 2. Vérifier l'ancien mot de passe
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return { success: false, error: "L'ancien mot de passe est incorrect." }
    }

    // 3. Hasher et sauvegarder le nouveau
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors du changement." }
  }
}