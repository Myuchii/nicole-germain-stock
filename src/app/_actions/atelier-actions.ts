'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// 1. Déclencher le chrono uniquement quand elle clique sur PLAY
export async function startCoutureChrono(itemId: string) {
  await prisma.quoteItem.update({
    where: { id: itemId },
    data: { 
      startedCoutureAt: new Date() // S'active ICI et pas avant !
    }
  })
  revalidatePath('/atelier')
}

// 2. Avancer les étapes générales
export async function advanceProductionStep(itemId: string, currentStep: string, realMeters?: number) {
  let nextStep = 'A_COUPER'
  let dataUpdate: any = {}
  
  if (currentStep === 'A_COUPER') {
    nextStep = 'EN_COUTURE'
    // 🪓 Nettoyage : On n'active plus le chrono couture automatiquement ici !
    if (realMeters !== undefined) {
      dataUpdate.quantityMeters = realMeters
    }
  } 
  else if (currentStep === 'EN_COUTURE') {
    nextStep = 'PRET'
    dataUpdate.finishedAt = new Date() // Le chrono s'arrête définitivement ici
  } 
  else if (currentStep === 'PRET') {
    nextStep = 'EXPEDIE'
  }

  await prisma.quoteItem.update({
    where: { id: itemId },
    data: { 
      statusProduction: nextStep,
      ...dataUpdate
    }
  })

  revalidatePath('/atelier')
  revalidatePath('/dashboard')
}

// 3. Valider la coupe avec ajustement du métrage réel (Gestion des virgules incluse)
export async function validateCuttingStep(formData: FormData) {
  const itemId = formData.get('itemId') as string
  const realMetersRaw = formData.get('realMeters') as string

  if (!itemId) return

  // Sécurité anti-virgule : on remplace la virgule par un point avant de transformer en nombre
  const realMeters = realMetersRaw 
    ? parseFloat(realMetersRaw.replace(',', '.')) 
    : undefined

  let dataUpdate: any = {
    statusProduction: 'EN_COUTURE',
    startedCoutureAt: new Date() // Déclenche l'étape suivante
  }

  // Si le nombre est valide, on l'écrase en base de données
  if (realMeters !== undefined && !isNaN(realMeters)) {
    dataUpdate.quantityMeters = realMeters
  }

  await prisma.quoteItem.update({
    where: { id: itemId },
    data: dataUpdate
  })

  // On rafraîchit les vues
  revalidatePath('/atelier')
  revalidatePath('/dashboard')
}