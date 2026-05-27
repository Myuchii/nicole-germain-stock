"use server"

import { prisma } from "@/lib/prisma" // On utilise toujours celui-là
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createOrUpdateFabric(formData: FormData) {
  const reference = formData.get('reference') as string
  const name = formData.get('name') as string
  const color = formData.get('color') as string
  const unit = formData.get('unit') as 'METER' | 'UNIT'
  
  const width = parseFloat(formData.get('width') as string) || 0
  const addedQty = parseFloat(formData.get('stock') as string) || 0
  const newPrice = parseFloat(formData.get('price') as string) || 0
  
  // 🆕 On récupère le seuil d'alerte tapé par Nicole
  const alertThreshold = parseFloat(formData.get('alertThreshold') as string) || 5

  const existingFabric = await prisma.fabric.findUnique({
    where: { reference }
  })

  if (existingFabric) {
    const currentStock = unit === 'METER' ? (Number(existingFabric.stockMeters) || 0) : (Number(existingFabric.stockUnits) || 0)
    const oldPrice = unit === 'METER' ? (Number(existingFabric.pricePerMeter) || 0) : (Number(existingFabric.pricePerUnit) || 0)
    const totalStock = currentStock + addedQty

    const averagePrice = totalStock > 0 
      ? ((currentStock * oldPrice) + (addedQty * newPrice)) / totalStock
      : newPrice

    await prisma.fabric.update({
      where: { reference },
      data: {   
        name, color, width,
        stockMeters: unit === 'METER' ? totalStock : existingFabric.stockMeters,
        stockUnits: unit === 'UNIT' ? totalStock : existingFabric.stockUnits,
        pricePerMeter: unit === 'METER' ? averagePrice : existingFabric.pricePerMeter,
        pricePerUnit: unit === 'UNIT' ? averagePrice : existingFabric.pricePerUnit,
        alertThresholdMeters: unit === 'METER' ? alertThreshold : existingFabric.alertThresholdMeters,
        alertThresholdUnits: unit === 'UNIT' ? alertThreshold : existingFabric.alertThresholdUnits,
      }
    })
  } else {
    await prisma.fabric.create({
      data: {
        reference, name, width, color, unit,
        stockMeters: unit === 'METER' ? addedQty : 0,
        stockUnits: unit === 'UNIT' ? addedQty : 0,
        pricePerMeter: unit === 'METER' ? newPrice : 0,
        pricePerUnit: unit === 'UNIT' ? newPrice : 0,
        alertThresholdMeters: unit === 'METER' ? alertThreshold : null,
        alertThresholdUnits: unit === 'UNIT' ? alertThreshold : null,
      }
    })
  }

  revalidatePath('/stock')
  redirect('/stock')
}

// 🆕 Fonction pour lire les tissus depuis un Client Component
export async function getFabrics() {
  return await prisma.fabric.findMany({
    orderBy: { createdAt: 'desc' }
  })
}

export async function getAbsoluteStockValue() {
  try {
    // On récupère les tissus actifs avec leurs entrées classées de la plus récente à la plus ancienne
    const fabrics = await prisma.fabric.findMany({
      where: { isArchived: false },
      include: {
        stockMovements: {
          where: { type: "ENTRY" },
          orderBy: { createdAt: "desc" }
        }
      }
    })

    let totalAbsoluteValueHT = 0

    for (const fabric of fabrics) {
      const isMeter = fabric.unit === 'METER'
      let remainingStock = isMeter ? (fabric.stockMeters || 0) : (fabric.stockUnits || 0)
      const fallbackPrice = isMeter ? fabric.pricePerMeter : fabric.pricePerUnit

      // Si aucun mouvement d'entrée n'a de prix renseigné, on applique le prix par défaut de la fiche
      if (!fabric.stockMovements || fabric.stockMovements.length === 0) {
        totalAbsoluteValueHT += remainingStock * fallbackPrice
        continue
      }

      // On pioche dans les lots d'entrée successifs pour valoriser le stock restant
      for (const movement of fabric.stockMovements) {
        if (remainingStock <= 0) break

        const movementQty = isMeter ? (movement.quantityMeters || 0) : (movement.quantityUnits || 0)
        const movementPrice = movement.purchasePriceHT > 0 ? movement.purchasePriceHT : fallbackPrice

        if (remainingStock >= movementQty) {
          totalAbsoluteValueHT += movementQty * movementPrice
          remainingStock -= movementQty
        } else {
          totalAbsoluteValueHT += remainingStock * movementPrice
          remainingStock = 0
        }
      }

      // Si après avoir parcouru les lots il reste du vieux stock, on le valorise au prix de base
      if (remainingStock > 0) {
        totalAbsoluteValueHT += remainingStock * fallbackPrice
      }
    }

    return totalAbsoluteValueHT
  } catch (error) {
    console.error("Erreur calcul valorisation absolue stock :", error)
    return 0
  }
}

export async function deleteFabric(id: string) {
  try {
    // 1. On vérifie s'il y a des lignes de devis/commandes liées à ce tissu
    const isUsed = await prisma.quoteItem.findFirst({
      where: { fabricId: id }
    })

    if (isUsed) {
      // 🛡️ CAS A : Le tissu a un historique. On l'archive pour protéger les commandes.
      await prisma.fabric.update({
        where: { id },
        data: { isArchived: true }
      })
      
      revalidatePath('/stock')
      return { 
        success: true, 
        message: "Le tissu étant lié à des commandes a été archivé pour préserver l'historique." 
      }
    }

    // 🗑️ CAS B : Le tissu est tout neuf ou n'a jamais servi. Suppression définitive !
    await prisma.fabric.delete({
      where: { id }
    })
  
    revalidatePath('/stock')
    return { 
      success: true, 
      message: "Le tissu a été définitivement supprimé de la base de données." 
    }

  } catch (error) {
    console.error("Erreur suppression/archivage tissu:", error)
    return { success: false, error: "Une erreur technique est survenue." }
  }
}