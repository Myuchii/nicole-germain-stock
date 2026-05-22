'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function advanceProductionStep(itemId: string, currentStep: string) {
  let nextStep = 'A_COUPER'
  let dataUpdate: any = {}
  
  if (currentStep === 'A_COUPER') {
    nextStep = 'EN_COUTURE'
    // 🕐 La coupe est finie, la couture commence maintenant :
    dataUpdate.startedCoutureAt = new Date() 
  } 
  else if (currentStep === 'EN_COUTURE') {
    nextStep = 'PRET'
    // 🕐 La couture est finie, le produit est prêt :
    dataUpdate.finishedAt = new Date()
  } 
  else if (currentStep === 'PRET') {
    nextStep = 'EXPEDIE'
  }

  // On enregistre le changement de statut ET l'heure
  await prisma.quoteItem.update({
    where: { id: itemId },
    data: { 
      statusProduction: nextStep,
      ...dataUpdate
    }
  })

  revalidatePath('/atelier')
  revalidatePath('/dashboard') // Pour mettre à jour les stats en direct
}