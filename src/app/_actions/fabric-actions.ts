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
  // Ces noms doivent correspondre aux "name" des inputs du formulaire
  const addedQty = parseFloat(formData.get('stock') as string) || 0
  const newPrice = parseFloat(formData.get('price') as string) || 0

  const existingFabric = await prisma.fabric.findUnique({
    where: { reference }
  })

  if (existingFabric) {
    // Logique PMP (Prix Moyen Pondéré)
    const currentStock = Number(existingFabric.stockMeters) || 0
    const oldPrice = Number(existingFabric.pricePerMeter) || 0
    const totalStock = currentStock + addedQty

    const averagePrice = totalStock > 0 
      ? ((currentStock * oldPrice) + (addedQty * newPrice)) / totalStock
      : newPrice

    await prisma.fabric.update({
      where: { reference },
      data: {   
        name,
        color,
        width,
        stockMeters: totalStock,
        pricePerMeter: averagePrice,
      }
    })
  } else {
    await prisma.fabric.create({
      data: {
        reference,
        name,
        width,
        color,
        unit,
        stockMeters: addedQty,
        pricePerMeter: newPrice,
      }
    })
  }

  revalidatePath('/stock')
  redirect('/stock') // On redirige Nicole vers la liste après l'ajout
}

export async function deleteFabric(id: string) {
  try {
    // 1. On vérifie s'il y a des commandes liées
    const isUsed = await prisma.quoteItem.findFirst({
      where: { fabricId: id }
    })

    if (isUsed) {
      return { 
        success: false, 
        error: "Impossible de supprimer ce tissu car il est utilisé dans des devis en cours ou passés." 
      }
    }

    // 2. Si libre, on supprime
    await prisma.fabric.delete({
      where: { id }
    })
  
    revalidatePath('/stock')
    return { success: true }

  } catch (error) {
    console.error("Erreur suppression tissu:", error)
    return { success: false, error: "Une erreur technique est survenue." }
  }
}