'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

// --- 1. GESTION FINANCIÈRE GLOBALE ---

export async function getAtelierSettings() {
  let settings = await prisma.atelierSettings.findUnique({ where: { id: "global" } })
  
  if (!settings) {
    settings = await prisma.atelierSettings.create({
      data: { 
        id: "global", 
        marginRate: 2.5,
        laborCostPerMin: 0.35
      }
    })
  }
  return settings
}

export async function updateAtelierSettings(formData: FormData) {
  const marginRate = parseFloat(formData.get('marginRate') as string)
  const laborCostPerMin = parseFloat(formData.get('laborCostPerMin') as string)

  if (isNaN(marginRate) || isNaN(laborCostPerMin) || marginRate <= 0 || laborCostPerMin <= 0) {
    return { success: false, error: "Valeurs invalides. Veuillez entrer des nombres positifs." }
  }

  try {
    // Utilisation de upsert pour éviter tout crash si la ligne venait à disparaître
    await prisma.atelierSettings.upsert({
      where: { id: "global" },
      update: { marginRate, laborCostPerMin },
      create: { id: "global", marginRate, laborCostPerMin }
    })
    revalidatePath('/parametres') // Ajustez le chemin selon votre route réelle
    return { success: true }
  } catch (e: any) {
    console.error("Erreur updateAtelierSettings:", e)
    return { success: false, error: "Erreur lors de la sauvegarde financière" }
  }
}

export async function getProductTypes() {
  try {
    let types = await prisma.productType.findMany({
      orderBy: { name: 'asc' }
    })

    // Si c'est vide, on insère un par un de manière très sécurisée
    if (types.length === 0) {
      console.log("🛠️ Base vide : Initialisation des types de produits...")
      
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

      // On recharge la liste une fois l'insertion terminée
      types = await prisma.productType.findMany({
        orderBy: { name: 'asc' }
      })
      console.log("✅ Création des types réussie !")
    }

    return types

  } catch (error) {
    // S'il y a un crash, on l'attrape et on l'affiche EN ROUGE dans votre terminal VSCode/Terminal
    console.error("❌ ERREUR FATALE LORS DE LA CRÉATION DES TYPES :", error)
    return [] 
  }
}

export async function updateProductTypeTimes(formData: FormData) {
  try {
    const entries = Array.from(formData.entries())
    
    // On utilise une transaction Prisma pour tout mettre à jour d'un coup de manière sécurisée
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
      .filter(Boolean) // Retire les undefined si une valeur était invalide

    await prisma.$transaction(updatePromises as any)

    revalidatePath('/parametres')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur updateProductTypeTimes:", e)
    return { success: false, error: "Impossible de mettre à jour les temps d'atelier" }
  }
}