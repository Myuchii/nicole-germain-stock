"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

// ==========================================
// 🧵 1. GESTION DES TISSUS
// ==========================================

export async function createOrUpdateFabric(formData: FormData) {
  const reference = formData.get('reference') as string
  const name = formData.get('name') as string
  const color = formData.get('color') as string
  const unit = formData.get('unit') as 'METER' | 'UNIT'
  
  const width = parseFloat(formData.get('width') as string) || 0
  const addedQty = parseFloat(formData.get('stock') as string) || 0
  const newPrice = parseFloat(formData.get('price') as string) || 0
  const alertThreshold = parseFloat(formData.get('alertThreshold') as string) || 5
  const location = (formData.get('location') as 'ATELIER' | 'BOUTIQUE') || 'ATELIER'

  let fabricId = ""

  const existingFabric = await prisma.fabric.findUnique({
    where: { reference }
  })

  if (existingFabric) {
    fabricId = existingFabric.id
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
    const newFabric = await prisma.fabric.create({
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
    fabricId = newFabric.id
  }

  // 🆕 MAGIE : On crée automatiquement un "Lot" pour l'inventaire absolu !
  if (addedQty > 0) {
    await prisma.fabricLot.create({
      data: {
        fabricId: fabricId,
        quantityBought: addedQty,
        quantityLeft: addedQty,
        purchasePriceHT: newPrice,
        location: location
      }
    })
  }

  revalidatePath('/stock-atelier')
  redirect('/stock-atelier')
}

export async function getFabrics() {
  return await prisma.fabric.findMany({
    where: { isArchived: false },
    include: {
      lots: { orderBy: { createdAt: 'asc' } } // 🆕 On charge les lots avec le tissu !
    },
    orderBy: { createdAt: 'desc' }
  })
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
      
      revalidatePath('/stock-atelier')
      return { success: true, message: "Le tissu étant lié à des commandes a été archivé pour préserver l'historique." }
    }

    // 🗑️ CAS B : Le tissu est tout neuf ou n'a jamais servi. Suppression définitive !
    await prisma.fabric.delete({
      where: { id }
    })
  
    revalidatePath('/stock-atelier')
    return { success: true, message: "Le tissu a été définitivement supprimé de la base de données." }
  } catch (error) {
    console.error("Erreur suppression/archivage tissu:", error)
    return { success: false, error: "Une erreur technique est survenue." }
  }
}

// ==========================================
// 💰 2. CALCUL VALEUR ABSOLUE DU STOCK ATELIER
// ==========================================

export async function getAbsoluteStockValue() {
  try {
    // 1. Valorisation des rouleaux de tissus restants
    const fabricLots = await prisma.fabricLot.findMany({
      where: { quantityLeft: { gt: 0 } }
    })
    const fabricValue = fabricLots.reduce((sum, lot) => sum + (lot.quantityLeft * lot.purchasePriceHT), 0)

    // 2. Valorisation des accessoires restants
    const accessoryLots = await prisma.accessoryLot.findMany({
      where: { quantityLeft: { gt: 0 } }
    })
    const accessoryValue = accessoryLots.reduce((sum, lot) => sum + (lot.quantityLeft * lot.purchasePriceHT), 0)

    return fabricValue + accessoryValue
  } catch (error) {
    console.error("Erreur getAbsoluteStockValue:", error)
    return 0
  }
}

// ==========================================
// 🧷 3. GESTION DES ACCESSOIRES (NOUVEAU)
// ==========================================

export async function getAccessories() {
  return await prisma.accessory.findMany({
    where: { isArchived: false },
    include: {
      lots: { orderBy: { createdAt: 'asc' } }
    },
    orderBy: { name: 'asc' }
  })
}

export async function deleteAccessory(id: string) {
  try {
    // On vérifie si l'accessoire est utilisé dans un devis
    const isUsed = await prisma.quoteItem.findFirst({
      where: { accessoryId: id }
    })

    if (isUsed) {
      await prisma.accessory.update({
        where: { id },
        data: { isArchived: true }
      })
      revalidatePath('/stock-atelier')
      return { success: true, message: "Accessoire archivé (lié à des commandes)." }
    }

    await prisma.accessory.delete({
      where: { id }
    })
    revalidatePath('/stock-atelier')
    return { success: true, message: "Accessoire supprimé avec succès." }
  } catch (error) {
    console.error("Erreur deleteAccessory:", error)
    return { success: false, error: "Erreur lors de la suppression de l'accessoire." }
  }
}

// ==========================================
// 🧷 4. ENREGISTREMENT ET ALIMENTATION DES ACCESSOIRES (NOUVEAU)
// ==========================================

export async function createOrUpdateAccessory(formData: FormData) {
  const reference = formData.get('reference') as string
  const name = formData.get('name') as string
  const category = formData.get('category') as string // ex: "Zips", "Fils"
  const addedQty = parseFloat(formData.get('stock') as string) || 0
  const newPrice = parseFloat(formData.get('price') as string) || 0
  const alertThreshold = parseFloat(formData.get('alertThreshold') as string) || 5
  // 🆕 Récupération de la localisation
  const location = (formData.get('location') as 'ATELIER' | 'BOUTIQUE') || 'ATELIER'

  let accessoryId = ""

  // 1. Recherche si l'accessoire existe déjà
  const existingAccessory = await prisma.accessory.findUnique({
    where: { reference }
  })

  if (existingAccessory) {
    accessoryId = existingAccessory.id
    const currentStock = Number(existingAccessory.stockQuantity || 0)
    const oldPrice = Number(existingAccessory.pricePerUnit || 0)
    const totalStock = currentStock + addedQty

    // Calcul du Prix Moyen Pondéré pour la fiche de base
    const averagePrice = totalStock > 0 
      ? ((currentStock * oldPrice) + (addedQty * newPrice)) / totalStock
      : newPrice

    await prisma.accessory.update({
      where: { reference },
      data: {
        name,
        category,
        stockQuantity: totalStock,
        pricePerUnit: averagePrice,
        alertThreshold: alertThreshold
      }
    })
  } else {
    // Création d'une nouvelle fiche
    const newAccessory = await prisma.accessory.create({
      data: {
        reference,
        name,
        category,
        stockQuantity: addedQty,
        pricePerUnit: newPrice,
        alertThreshold: alertThreshold,
        unit: "UNIT"
      }
    })
    accessoryId = newAccessory.id
  }

  // 2. Création automatique du lot d'achat absolu pour l'inventaire
  if (addedQty > 0) {
    await prisma.accessoryLot.create({
      data: {
        accessoryId: accessoryId,
        quantityBought: addedQty,
        quantityLeft: addedQty,
        purchasePriceHT: newPrice,
        location: location
      }
    })
  }

  revalidatePath('/stock-atelier')
  redirect('/stock-atelier')
}

// 🆕 ACTION UNIVERSELLE POUR LE FORMULAIRE D'AJOUT
export async function handleUniversalStockAdd(formData: FormData) {
  const itemType = formData.get('itemType') as string // 'TISSU' ou 'ACCESSOIRE'

  if (itemType === 'ACCESSOIRE') {
    return await createOrUpdateAccessory(formData)
  } else {
    return await createOrUpdateFabric(formData)
  }
}

export async function changeLotLocation(
  lotId: string, 
  itemType: 'FABRIC' | 'ACCESSORY' | 'FINISHED_PRODUCT' | 'MERCHANDISE', 
  newLocation: 'ATELIER' | 'BOUTIQUE'
) {
  try {
    switch (itemType) {
      case 'FABRIC':
        await prisma.fabricLot.update({ where: { id: lotId }, data: { location: newLocation } })
        break
      case 'ACCESSORY':
        await prisma.accessoryLot.update({ where: { id: lotId }, data: { location: newLocation } })
        break
      case 'FINISHED_PRODUCT':
        await prisma.finishedProductLot.update({ where: { id: lotId }, data: { location: newLocation } })
        break
      case 'MERCHANDISE':
        await prisma.merchandiseLot.update({ where: { id: lotId }, data: { location: newLocation } })
        break
    }

    // On rafraîchit les deux pages pour que l'affichage soit immédiat
    revalidatePath('/stock-atelier')
    revalidatePath('/stock-Boutique')
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors du transfert de stock :", error)
    return { success: false, error: "Impossible de changer la localisation." }
  }
}

// 🟢 AJUSTEMENT EXCEPTIONNEL DE STOCK
export async function adjustStockManually(formData: FormData) {
  const itemId = formData.get('itemId') as string
  const type = formData.get('itemType') as 'FABRIC' | 'ACCESSORY'
  const quantity = parseFloat(formData.get('quantity') as string)
  const reason = formData.get('reason') as string

  if (!itemId || isNaN(quantity) || quantity <= 0) {
    return { success: false, error: "Quantité invalide." }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (type === 'FABRIC') {
        // 1. On déduit du rouleau principal
        await tx.fabric.update({
          where: { id: itemId },
          data: { stockMeters: { decrement: quantity } }
        })
        
        // 2. On trace le mouvement !
        await tx.stockMovement.create({
          data: {
            fabricId: itemId,
            type: "EXIT",
            quantityMeters: quantity,
            reason: `Ajustement exceptionnel : ${reason}`
          }
        })
      } else {
        // Idem pour les accessoires (mercerie)
        await tx.accessory.update({
          where: { id: itemId },
          data: { stockQuantity: { decrement: quantity } }
        })
        
        // Si tu as une table de traçabilité pour les accessoires, on l'ajoute ici !
      }
    })

    revalidatePath('/stock-atelier')
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de l'ajustement du stock:", error)
    return { success: false, error: "Impossible de modifier le stock." }
  }
}