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

// 1. VALIDER LA COUPE (Sans lancer le chrono de couture automatiquement)
export async function validateCuttingStep(formData: FormData) {
  const itemId = formData.get('itemId') as string
  const realMetersRaw = formData.get('realMeters') as string
  const isChuteString = formData.get('isChute') as string

  if (!itemId) return

  const realMeters = realMetersRaw 
    ? parseFloat(realMetersRaw.replace(',', '.')) 
    : undefined

  const useChute = isChuteString === 'true'

  try {
    const item = await prisma.quoteItem.findUnique({
      where: { id: itemId },
      include: { quote: true }
    })

    if (!item) throw new Error("Ligne d'ouvrage introuvable")
    if (item.statusProduction !== 'A_COUPER') throw new Error("Cet article a déjà été coupé.")

    await prisma.$transaction(async (tx) => {
      
      let dataUpdate: any = {
        statusProduction: 'EN_COUTURE',
        // 🎯 RETIRÉ : startedCoutureAt n'est plus mis à jour ici ! Le chrono reste à null.
        isChute: useChute
      }

      const finalMetersCut = realMeters !== undefined && !isNaN(realMeters) ? realMeters : (item.quantityMeters || 0)
      dataUpdate.quantityMeters = finalMetersCut

      await tx.quoteItem.update({
        where: { id: itemId },
        data: dataUpdate
      })

      if (!useChute && item.fabricId && finalMetersCut > 0 && item.quantityUnits) {
        const totalUnitsToMake = item.quantityUnits
        const unitMeters = finalMetersCut / totalUnitsToMake 

        let unitsRemaining = totalUnitsToMake
        let currentLotIndex = 0

        const activeLots = await tx.fabricLot.findMany({
          where: { fabricId: item.fabricId, location: 'ATELIER', quantityLeft: { gt: 0 } },
          orderBy: { createdAt: 'asc' }
        })

        while (unitsRemaining > 0 && currentLotIndex < activeLots.length) {
          const lot = activeLots[currentLotIndex]
          const possibleUnitsInThisLot = Math.floor(lot.quantityLeft / unitMeters)

          if (possibleUnitsInThisLot > 0) {
            const unitsToCut = Math.min(possibleUnitsInThisLot, unitsRemaining)
            const metersToDeduct = unitsToCut * unitMeters

            await tx.fabricLot.update({
              where: { id: lot.id },
              data: { quantityLeft: { decrement: metersToDeduct } }
            })

            lot.quantityLeft -= metersToDeduct
            unitsRemaining -= unitsToCut
          }

          if (unitsRemaining > 0) {
            currentLotIndex++
          }
        }

        if (unitsRemaining > 0 && activeLots.length > 0) {
          const emergencyMeters = unitsRemaining * unitMeters
          await tx.fabricLot.update({
            where: { id: activeLots[0].id },
            data: { quantityLeft: { decrement: emergencyMeters } }
          })
        }

        await tx.stockMovement.create({
          data: { fabricId: item.fabricId, type: "EXIT", quantityMeters: finalMetersCut, reason: `Coupe Rouleau - Commande ${item.quote.reference}` }
        })

        await tx.fabric.update({
          where: { id: item.fabricId },
          data: { stockMeters: { decrement: finalMetersCut } }
        })

      } else if (useChute && item.fabricId) {
        await tx.stockMovement.create({
          data: { fabricId: item.fabricId, type: "EXIT", quantityMeters: finalMetersCut, reason: `Coupe CHUTE (Stock préservé) - Commande ${item.quote.reference}` }
        })
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
    // 1. On récupère toutes les pièces sélectionnées
    const items = await prisma.quoteItem.findMany({
      where: { id: { in: itemIds } }
    })

    // 2. On calcule le métrage global consommé et on identifie le tissu
    const fabricId = items[0]?.fabricId
    const totalMeters = items.reduce((sum, item) => sum + (Number(item.quantityMeters) || 0), 0)

    // 3. Bim Bam Boum : On déduit tout le lot d'un seul coup du rouleau
    if (fabricId && totalMeters > 0) {
      await prisma.fabric.update({
        where: { id: fabricId },
        data: {
          stockMeters: { decrement: totalMeters }
        }
      })
    }

    // 4. On bascule toutes les fiches d'un coup en couture
    await prisma.quoteItem.updateMany({
      where: { id: { in: itemIds } },
      data: {
        statusProduction: 'EN_COUTURE'
      }
    })

    revalidatePath('/atelier')
    return { success: true }
  } catch (error) {
    console.error("Erreur validation groupée :", error)
    return { success: false, error: "Impossible de valider le lot." }
  }
}

export async function shipBulkOrder(formData: FormData) {
  const quoteId = formData.get('quoteId') as string

  if (!quoteId) return { success: false, error: "ID de commande manquant." }

  try {
    await prisma.$transaction(async (tx) => {
      // 1️⃣ On passe tous les articles restants au statut EXPEDIE
      await tx.quoteItem.updateMany({
        where: { 
          quoteId: quoteId,
          statusProduction: 'PRET' 
        },
        data: {
          statusProduction: 'EXPEDIE'
        }
      })

      // 2️⃣ On archive la commande globale pour qu'elle disparaisse des flux actifs
      await tx.quote.update({
        where: { id: quoteId },
        data: { 
          status: 'ARCHIVED' // 💡 Remplace 'ARCHIVED' par 'EXPEDIE' ou 'COMPLETED' selon ton enum QuoteStatus
        }
      })
    })

    revalidatePath('/atelier')
    revalidatePath('/expedition')
    revalidatePath('/commandes')
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de l'expédition et de l'archivage du bon :", error)
    return { success: false, error: "Impossible de valider l'expédition." }
  }
}
