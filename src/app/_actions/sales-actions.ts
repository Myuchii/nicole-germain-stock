'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

export async function recordSale(formData: FormData) {
  const reference = formData.get('reference') as string
  const quantity = parseInt(formData.get('quantity') as string) || 0
  const paymentMethod = formData.get('paymentMethod') as string
  const type = formData.get('type') as 'PRODUIT_FINI' | 'MARCHANDISE'

  try {
    let itemName = ""
    let totalCostOfVente = 0
    let finalTotalPriceHT = 0 // ⬅️ C'est cette variable qui va centraliser le prix final calculé

    // ==========================================
    // CAS 1 : FLUX ② PRODUITS FINIS (CONFECTION)
    // ==========================================
    if (type === 'PRODUIT_FINI') {
      const item = await prisma.finishedProduct.findUnique({ 
        where: { reference },
        include: { lots: { orderBy: { createdAt: 'asc' } } }
      })

      if (!item) return { success: false, error: "Article introuvable" }

      const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
      if (totalInStock < quantity) {
        return { success: false, error: `Stock insuffisant ! (Dispo total: ${totalInStock})` }
      }

      let quantityToDeduct = quantity
      let totalRevenueHT = 0

      for (const lot of item.lots) {
        if (quantityToDeduct <= 0) break

        if (lot.quantityLeft > 0) {
          const take = Math.min(quantityToDeduct, lot.quantityLeft)
          
          // Sécurité : Si le lot a un prix à 0 (anciens tests), on prend le prix par défaut de la fiche
          const priceToUse = lot.sellingPriceHT && lot.sellingPriceHT > 0 ? lot.sellingPriceHT : item.sellingPriceHT
          
          totalRevenueHT += take * priceToUse
          quantityToDeduct -= take

          await prisma.finishedProductLot.update({
            where: { id: lot.id },
            data: { quantityLeft: lot.quantityLeft - take }
          })
        }
      }

      itemName = item.name
      finalTotalPriceHT = totalRevenueHT // 💡 Affectation explicite du montant calculé
    } 
    // ==========================================
    // CAS 2 : FLUX ③ MARCHANDISES (NÉGOCE)
    // ==========================================
    else {
      const item = await prisma.merchandise.findUnique({ 
        where: { reference },
        include: { lots: { orderBy: { createdAt: 'asc' } } }
      })

      if (!item) return { success: false, error: "Article introuvable" }

      const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
      if (totalInStock < quantity) {
        return { success: false, error: `Stock total insuffisant ! (Dispo total: ${totalInStock})` }
      }

      let quantityToDeduct = quantity
      let totalRevenueHT = 0

      for (const lot of item.lots) {
        if (quantityToDeduct <= 0) break

        if (lot.quantityLeft > 0) {
          const take = Math.min(quantityToDeduct, lot.quantityLeft)
          
          totalCostOfVente += take * lot.purchasePriceHT
          
          // Sécurité : Si le lot a un prix à 0 (anciens tests), on prend le prix de la fiche produit
          const priceToUse = lot.sellingPriceHT && lot.sellingPriceHT > 0 ? lot.sellingPriceHT : item.sellingPriceHT
          
          totalRevenueHT += take * priceToUse 
          quantityToDeduct -= take

          await prisma.merchandiseLot.update({
            where: { id: lot.id },
            data: { quantityLeft: lot.quantityLeft - take }
          })
        }
      }

      itemName = item.name
      finalTotalPriceHT = totalRevenueHT // 💡 Affectation explicite du montant calculé
    }

    // ==========================================
    // ECRITURE COMMUNE DANS LE JOURNAL DES VENTES
    // ==========================================
    await prisma.saleLog.create({
      data: {
        referenceItem: reference,
        name: itemName,
        type: type,
        quantitySold: quantity,
        totalPriceHT: finalTotalPriceHT, // ⬅️ CORRECTION ICI : On passe la variable sécurisée
        paymentMethod: paymentMethod
      }
    })

    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur recordSale:", e)
    return { success: false, error: "Erreur technique lors de la vente" }
  }
}

export async function getSalesJournal(type: 'PRODUIT_FINI' | 'MARCHANDISE') {
  return await prisma.saleLog.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' }
  })
}