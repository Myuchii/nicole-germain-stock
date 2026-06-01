"use server"

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. Ajuster la quantité globale en stock d'un produit fini
export async function adjustProductStock(id: string, newTotalQuantity: number, type: 'PF' | 'MA') {
  try {
    if (newTotalQuantity < 0) return { success: false, error: "Le stock ne peut pas être négatif." }

    if (type === 'PF') {
      // 1. On récupère le produit et tous ses lots (du plus ancien au plus récent)
      const product = await prisma.finishedProduct.findUnique({
        where: { id },
        include: { lots: { orderBy: { createdAt: 'asc' } } }
      })
      if (!product) throw new Error("Produit introuvable")

      const currentTotal = product.lots.reduce((sum, lot) => sum + lot.quantityLeft, 0)
      const diff = newTotalQuantity - currentTotal

      if (diff > 0) {
        // 📈 AJOUT : Nicole a trouvé du stock en plus, on crée un lot de régularisation
        await prisma.finishedProductLot.create({
          data: {
            finishedProductId: id,
            quantityManufactured: diff,
            quantityLeft: diff,
            sellingPriceHT: product.sellingPriceHT // On prend le prix de vente par défaut
          }
        })
      } else if (diff < 0) {
        // 📉 PERTE : Casse, vol ou erreur, on vide les lots les plus anciens (FIFO)
        let toRemove = Math.abs(diff)
        for (const lot of product.lots) {
          if (toRemove <= 0) break
          if (lot.quantityLeft > 0) {
            const deduct = Math.min(lot.quantityLeft, toRemove)
            await prisma.finishedProductLot.update({
              where: { id: lot.id },
              data: { quantityLeft: lot.quantityLeft - deduct }
            })
            toRemove -= deduct
          }
        }
      }
      
      // On met à jour le chiffre global pour la forme
      await prisma.finishedProduct.update({ where: { id }, data: { stockQuantity: newTotalQuantity } })

    } else if (type === 'MA') {
      // EXACTEMENT LA MÊME LOGIQUE POUR LA MARCHANDISE (MA)
      const merchandise = await prisma.merchandise.findUnique({
        where: { id },
        include: { lots: { orderBy: { createdAt: 'asc' } } }
      })
      if (!merchandise) throw new Error("Marchandise introuvable")

      const currentTotal = merchandise.lots.reduce((sum, lot) => sum + lot.quantityLeft, 0)
      const diff = newTotalQuantity - currentTotal

      if (diff > 0) {
        await prisma.merchandiseLot.create({
          data: {
            merchandiseId: id,
            quantityBought: diff,
            quantityLeft: diff,
            purchasePriceHT: 0, // Régularisation = pas de coût d'achat connu
            sellingPriceHT: merchandise.sellingPriceHT
          }
        })
      } else if (diff < 0) {
        let toRemove = Math.abs(diff)
        for (const lot of merchandise.lots) {
          if (toRemove <= 0) break
          if (lot.quantityLeft > 0) {
            const deduct = Math.min(lot.quantityLeft, toRemove)
            await prisma.merchandiseLot.update({
              where: { id: lot.id },
              data: { quantityLeft: lot.quantityLeft - deduct }
            })
            toRemove -= deduct
          }
        }
      }
    }

    revalidatePath('/boutique')
    return { success: true }
  } catch (error: any) {
    console.error("Erreur ajustement stock lots :", error)
    return { success: false, error: "Impossible de régulariser l'inventaire." }
  }
}

// 2. Ajuster le prix de vente HT à la volée
export async function adjustProductPrice(id: string, newPriceHT: number) {
  try {
    if (newPriceHT <= 0) {
      return { success: false, error: "Le prix doit être supérieur à 0€." }
    }

    await prisma.finishedProduct.update({
      where: { id },
      data: { sellingPriceHT: newPriceHT }
    })

    revalidatePath('/boutique')
    return { success: true }
  } catch (error) {
    console.error("Erreur ajustement prix :", error)
    return { success: false, error: "Impossible de modifier le prix." }
  }
}