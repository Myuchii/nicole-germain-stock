"use server"

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// 1. Ajuster la quantité globale en stock d'un produit fini
export async function adjustProductStock(id: string, newQuantity: number) {
  try {
    if (newQuantity < 0) {
      return { success: false, error: "Le stock ne peut pas être négatif." }
    }

    await prisma.finishedProduct.update({
      where: { id },
      data: { stockQuantity: newQuantity }
    })

    revalidatePath('/boutique')
    return { success: true }
  } catch (error) {
    console.error("Erreur ajustement stock :", error)
    return { success: false, error: "Impossible de modifier la quantité." }
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