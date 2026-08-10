'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

// 1. Déclencher le chrono uniquement quand elle clique sur PLAY
export async function startCoutureChrono(itemId: string) {
  await prisma.quoteItem.update({
    where: { id: itemId },
    data: { 
      startedCoutureAt: new Date(), // Écrase et relance le chrono au moment du clic
      finishedAt: null             // Sécurité : on s'assure que la date de fin est bien nettoyée
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

// 🟢 1. MISE À JOUR DÉFINITIVE : Validation de la Coupe avec saisie manuelle séparée (Face A / Face B)
export async function validateCuttingStep(formData: FormData) {
  const itemId = formData.get('itemId') as string
  const realMetersRawA = formData.get('realMetersA') as string // 🎯 Champ pour Tissu A
  const realMetersRawB = formData.get('realMetersB') as string // 🎯 Champ pour Tissu B
  const isChuteString = formData.get('isChute') as string

  if (!itemId) return

  const realMetersA = realMetersRawA ? parseFloat(realMetersRawA.replace(',', '.')) : undefined
  const realMetersB = realMetersRawB ? parseFloat(realMetersRawB.replace(',', '.')) : undefined

  const useChute = isChuteString === 'true'

  try {
    const item = await prisma.quoteItem.findUnique({
      where: { id: itemId },
      include: { quote: true }
    })

    if (!item) throw new Error("Ligne d'ouvrage introuvable")
    if (item.statusProduction !== 'A_COUPER') throw new Error("Cet article a déjà été coupé.")

    await prisma.$transaction(async (tx) => {
      
      const finalMetersA = realMetersA !== undefined && !isNaN(realMetersA) ? realMetersA : (item.quantityMeters || 0)
      const finalMetersB = realMetersB !== undefined && !isNaN(realMetersB) ? realMetersB : (item.quantityMetersB || 0)
      
      // Mise à jour de l'article pour le passer en couture et enregistrer les VRAIS métrages
      let dataUpdate: any = {
        statusProduction: 'EN_COUTURE',
        isChute: useChute,
        quantityMeters: finalMetersA
      }

      if (item.fabricBId) {
        dataUpdate.quantityMetersB = finalMetersB 
      }

      await tx.quoteItem.update({
        where: { id: itemId },
        data: dataUpdate
      })

      // ✂️ GESTION DU STOCK POUR LES DEUX ROULEAUX SÉPARÉMENT
      if (!useChute) {
        
        // --- 🧵 TISSU A (Principal) ---
        if (item.fabricId && finalMetersA > 0) {
          await tx.fabric.update({
            where: { id: item.fabricId },
            data: { stockMeters: { decrement: finalMetersA } }
          })
          
          await tx.stockMovement.create({
            data: { 
              fabricId: item.fabricId, 
              type: "EXIT", 
              quantityMeters: finalMetersA, 
              reason: `Coupe Rouleau Face A - Cmd ${item.quote.reference}` 
            }
          })
        }

        // --- 🧵 TISSU B (Secondaire) ---
        if (item.fabricBId && finalMetersB > 0) {
          await tx.fabric.update({
            where: { id: item.fabricBId },
            data: { stockMeters: { decrement: finalMetersB } }
          })
          
          await tx.stockMovement.create({
            data: { 
              fabricId: item.fabricBId, 
              type: "EXIT", 
              quantityMeters: finalMetersB, 
              reason: `Coupe Rouleau Face B - Cmd ${item.quote.reference}` 
            }
          })
        }

      } else if (useChute) {
        // En cas de chute, on trace juste la conso mais on ne touche pas au stock principal
        if (item.fabricId && finalMetersA > 0) {
          await tx.stockMovement.create({
            data: { fabricId: item.fabricId, type: "EXIT", quantityMeters: finalMetersA, reason: `Coupe CHUTE Face A - Cmd ${item.quote.reference}` }
          })
        }
        if (item.fabricBId && finalMetersB > 0) {
          await tx.stockMovement.create({
            data: { fabricId: item.fabricBId, type: "EXIT", quantityMeters: finalMetersB, reason: `Coupe CHUTE Face B - Cmd ${item.quote.reference}` }
          })
        }
      }
    })

    revalidatePath('/atelier')
    revalidatePath('/dashboard')
    
  } catch (error) {
    console.error('Erreur lors du traitement de la coupe atelier :', error)
  }
}


// 2. 🆕 NOUVELLE ACTION : Déclenchement manuel du chrono de couture par l'artisan
export async function startSewingStep(formData: FormData) {
  const itemId = formData.get('itemId') as string

  if (!itemId) return

  await prisma.quoteItem.update({
    where: { id: itemId },
    data: {
      startedCoutureAt: new Date() // ⏱️ Le vrai chrono démarre UNIQUEMENT ici !
    }
  })

  revalidatePath('/atelier')
}

export async function rollbackToCutting(formData: FormData) {
  const itemId = formData.get('itemId') as string
  const mode = formData.get('rollbackMode') as 'ERROR' | 'REDO'

  if (!itemId) return

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.quoteItem.findUnique({ where: { id: itemId } })
      if (!item) return

      // 🎯 FIX : On extrait une valeur numérique stricte pour éviter le conflit null / undefined
      const metersToHandle = item.quantityMeters ? Number(item.quantityMeters) : 0

      if (mode === 'ERROR') {
        // 1️⃣ CAS : ERREUR DE CLIC (Le tissu n'a jamais été coupé)
        if (!item.isChute && item.fabricId && metersToHandle > 0) {
          await tx.fabric.update({
            where: { id: item.fabricId },
            data: { stockMeters: { increment: metersToHandle } }
          })
          
          await tx.stockMovement.create({
            data: {
              fabricId: item.fabricId,
              type: "ENTRY",
              quantityMeters: metersToHandle, // 🎯 Nombre strict inséré
              reason: `Annulation Erreur - Retour Coupe (ID: ${item.id})`
            }
          })
        }
      } 
      else if (mode === 'REDO') {
        // 2️⃣ CAS : DÉJÀ COUPÉ / À REFAIRE (Le premier tissu est gâché)
        if (item.fabricId && metersToHandle > 0) {
          await tx.stockMovement.create({
            data: {
              fabricId: item.fabricId,
              type: "EXIT",
              quantityMeters: metersToHandle, // 🎯 Nombre strict inséré
              reason: `Gâche / Re-coupe nécessaire pour l'article (ID: ${item.id})`
            }
          })
        }
      }

      // Dans tous les cas, on remet l'article à l'étape "A_COUPER"
      await tx.quoteItem.update({
        where: { id: itemId },
        data: { 
          statusProduction: 'A_COUPER',
          isChute: false 
        }
      })
    })

    revalidatePath('/atelier')
  } catch (error) {
    console.error("Erreur lors du rollback sélectif :", error)
  }
}

export async function rollbackToCouture(formData: FormData) {
  const itemId = formData.get('itemId') as string
  if (!itemId) return

  try {
    await prisma.quoteItem.update({
      where: { id: itemId },
      data: {
        statusProduction: 'EN_COUTURE',
        finishedAt: null
      }
    })
    revalidatePath('/atelier')
    // 🎯 FIX : On retire le "return { success: true }"
  } catch (error) {
    console.error("Erreur lors du retour en couture :", error)
  }
}

export async function validateBulkCuttingStep(formData: FormData) {
  const itemIds = formData.getAll('itemIds') as string[]

  try {
    const items = await prisma.quoteItem.findMany({
      where: { id: { in: itemIds } },
      include: { quote: true } // On inclut la quote pour avoir la référence dans l'historique
    })

    await prisma.$transaction(async (tx) => {
      // 1. On boucle sur chaque article pour déduire les BONS rouleaux
      for (const item of items) {
        const meters = Number(item.quantityMeters) || 0
        const metersB = Number((item as any).quantityMetersB) || 0

        // 🧵 Déduction Face A
        if (item.fabricId && meters > 0) {
          await tx.fabric.update({
            where: { id: item.fabricId },
            data: { stockMeters: { decrement: meters } }
          })
          await tx.stockMovement.create({
            data: {
              fabricId: item.fabricId,
              type: "EXIT",
              quantityMeters: meters,
              reason: `Multi-Coupe (Groupée) - Cmd ${item.quote?.reference || item.quoteId}`
            }
          })
        }

        // 🧵 Déduction Face B (si l'article est bicolore)
        if (item.fabricBId && metersB > 0) {
          await tx.fabric.update({
            where: { id: item.fabricBId },
            data: { stockMeters: { decrement: metersB } }
          })
          await tx.stockMovement.create({
            data: {
              fabricId: item.fabricBId,
              type: "EXIT",
              quantityMeters: metersB,
              reason: `Multi-Coupe Face B (Groupée) - Cmd ${item.quote?.reference || item.quoteId}`
            }
          })
        }
      }

      // 2. On bascule toutes les fiches d'un coup en couture
      await tx.quoteItem.updateMany({
        where: { id: { in: itemIds } },
        data: {
          statusProduction: 'EN_COUTURE'
        }
      })
    })

    revalidatePath('/atelier')
    return { success: true }
  } catch (error) {
    console.error("Erreur validation groupée :", error)
    return { success: false, error: "Impossible de valider le lot." }
  }
}

// 📦 Dans ton fichier d'actions :
export async function shipBulkOrder(formData: FormData) {
  const quoteId = formData.get('quoteId') as string

  if (!quoteId) return 

  try {
    await prisma.$transaction(async (tx) => {
      // 1. On passe toutes les pièces prêtes en "EXPEDIE"
      await tx.quoteItem.updateMany({
        where: { quoteId: quoteId, statusProduction: 'PRET' },
        data: { statusProduction: 'EXPEDIE' }
      })

      // 🟢 2. C'est ici ! On passe le bon de commande global en "ARCHIVED"
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'ARCHIVED' }
      })
    })

    // On rafraîchit toutes les vues concernées
    revalidatePath('/atelier')
    revalidatePath('/expedition')
    revalidatePath('/commandes')
    revalidatePath('/partner/dashboard') // 🟢 Ajouté pour mettre à jour l'écran du Camping-Car Man !
    
  } catch (error) {
    console.error("Erreur lors de l'expédition :", error)
  }
}

// 🟢 2. MISE À JOUR : Liaison des tissus (Accepte la Face B)
export async function linkFabricToItem(formData: FormData) {
  const itemId = formData.get('itemId') as string
  const fabricId = formData.get('fabricId') as string
  const fabricBId = formData.get('fabricBId') as string // 🔄 Captation du second tissu

  if (!itemId) return

  try {
    let dataToUpdate: any = {}
    if (fabricId) dataToUpdate.fabricId = fabricId
    if (fabricBId) dataToUpdate.fabricBId = fabricBId

    await prisma.quoteItem.update({
      where: { id: itemId },
      data: dataToUpdate
    })
    
    revalidatePath('/atelier') 
  } catch (error) {
    console.error("Erreur lors de la liaison du tissu :", error)
  }
}

export async function togglePaymentStatus(formData: FormData) {
  const quoteId = formData.get('quoteId') as string
  const isPaid = formData.get('isPaid') === 'true' // Vérifie l'état de la case

  if (!quoteId) return

  try {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { isPaid: isPaid }
    })
    
    // On met à jour les deux pages d'un coup
    revalidatePath('/commandes') 
    revalidatePath('/atelier')
  } catch (error) {
    console.error("Erreur lors de la validation du paiement :", error)
  }
}