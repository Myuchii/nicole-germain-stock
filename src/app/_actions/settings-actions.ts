'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

// 1. Lire les paramètres financiers globaux
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

// 2. Mettre à jour les paramètres financiers
export async function updateAtelierSettings(formData: FormData) {
  const marginRate = parseFloat(formData.get('marginRate') as string)
  const laborCostPerMin = parseFloat(formData.get('laborCostPerMin') as string)

  if (isNaN(marginRate) || isNaN(laborCostPerMin) || marginRate <= 0 || laborCostPerMin <= 0) {
    return { success: false, error: "Valeurs invalides" }
  }

  try {
    await prisma.atelierSettings.update({
      where: { id: "global" },
      data: { marginRate, laborCostPerMin }
    })
    revalidatePath('/parametres')
    return { success: true }
  } catch (e: any) {
    console.error(e)
    return { success: false, error: "Erreur lors de la sauvegarde financière" }
  }
}

// 3. 🆕 Lire tous les types de produits (Temps de confection)
export async function getProductTypes() {
  return await prisma.productType.findMany({
    orderBy: { name: 'asc' }
  })
}

// 4. 🆕 Mettre à jour les temps de confection en masse
export async function updateProductTypeTimes(formData: FormData) {
  try {
    // On boucle sur toutes les entrées envoyées par le formulaire
    const entries = Array.from(formData.entries())
    
    for (const [key, value] of entries) {
      // Si la clé commence par type_ c'est un ID de ProductType
      if (key.startsWith('type_')) {
        const id = key.replace('type_', '')
        const baseLaborTime = parseInt(value as string, 10)

        if (!isNaN(baseLaborTime) && baseLaborTime >= 0) {
          await prisma.productType.update({
            where: { id },
            data: { baseLaborTime }
          })
        }
      }
    }

    revalidatePath('/parametres')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur updateProductTypeTimes:", e)
    return { success: false, error: "Impossible de mettre à jour les temps d'atelier" }
  }
}