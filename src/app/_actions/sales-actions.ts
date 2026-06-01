'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

export async function recordSale(formData: FormData) {
  const cartJson = formData.get('cart') as string
  const paymentMethod = formData.get('paymentMethod') as string
  const applyVAT = formData.get('applyVAT') === 'true' 
  const discountPercent = parseFloat(formData.get('discountPercent') as string) || 0 // 🆕 Récupère la remise

  if (!cartJson || !paymentMethod) return { success: false, error: "Données de vente manquantes" }

  try {
    const cartItems: { reference: string; quantity: number; type: 'PRODUIT_FINI' | 'MARCHANDISE' }[] = JSON.parse(cartJson)
    if (cartItems.length === 0) return { success: false, error: "Le panier est vide" }

    const ticketId = `TICK-${Date.now().toString().slice(-6)}`
    const taxRate = applyVAT ? 20.0 : 0
    const multiplier = 1 + (taxRate / 100)

    for (const cartItem of cartItems) {
      const { reference, quantity, type } = cartItem
      let itemName = ""
      let totalRevenueBaseHT = 0 // Le prix AVANT remise

      // ==========================================
      // CAS 1 : FLUX ② PRODUITS FINIS
      // ==========================================
      if (type === 'PRODUIT_FINI') {
        const item = await prisma.finishedProduct.findUnique({ where: { reference }, include: { lots: { orderBy: { createdAt: 'asc' } } }})
        if (!item) throw new Error(`Article ${reference} introuvable`)

        const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
        if (totalInStock < quantity) throw new Error(`Stock insuffisant pour ${reference}`)

        let quantityToDeduct = quantity

        for (const lot of item.lots) {
          if (quantityToDeduct <= 0) break
          if (lot.quantityLeft > 0) {
            const take = Math.min(quantityToDeduct, lot.quantityLeft)
            const priceToUse = lot.sellingPriceHT && lot.sellingPriceHT > 0 ? lot.sellingPriceHT : item.sellingPriceHT
            totalRevenueBaseHT += take * priceToUse
            quantityToDeduct -= take
            await prisma.finishedProductLot.update({ where: { id: lot.id }, data: { quantityLeft: lot.quantityLeft - take } })
          }
        }
        itemName = item.name
      } 
      // ==========================================
      // CAS 2 : FLUX ③ MARCHANDISES
      // ==========================================
      else {
        const item = await prisma.merchandise.findUnique({ where: { reference }, include: { lots: { orderBy: { createdAt: 'asc' } } }})
        if (!item) throw new Error(`Article ${reference} introuvable`)

        const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
        if (totalInStock < quantity) throw new Error(`Stock insuffisant pour ${reference}`)

        let quantityToDeduct = quantity

        for (const lot of item.lots) {
          if (quantityToDeduct <= 0) break
          if (lot.quantityLeft > 0) {
            const take = Math.min(quantityToDeduct, lot.quantityLeft)
            const priceToUse = lot.sellingPriceHT && lot.sellingPriceHT > 0 ? lot.sellingPriceHT : item.sellingPriceHT
            totalRevenueBaseHT += take * priceToUse 
            quantityToDeduct -= take
            await prisma.merchandiseLot.update({ where: { id: lot.id }, data: { quantityLeft: lot.quantityLeft - take } })
          }
        }
        itemName = item.name
      }

      // 🆕 CALCULS COMPTABLES POUR BETTY
      const unitPriceHT = quantity > 0 ? totalRevenueBaseHT / quantity : 0
      const finalTotalPriceHT = totalRevenueBaseHT * (1 - discountPercent / 100) // HT Remisé
      const finalTotalPriceTTC = finalTotalPriceHT * multiplier                  // TTC Remisé

      await prisma.saleLog.create({
        data: {
          referenceItem: reference,
          name: itemName,
          type: type,
          quantitySold: quantity,
          
          unitPriceHT: unitPriceHT,             // 🆕 Prix unitaire de base sauvegardé
          discountPercent: discountPercent,     // 🆕 Remise sauvegardée
          
          totalPriceHT: finalTotalPriceHT,
          totalPriceTTC: finalTotalPriceTTC, 
          taxRate: taxRate,
          isTaxExempt: !applyVAT,
          isTTC: applyVAT,
          paymentMethod: paymentMethod,
          ticketId: ticketId
        }
      })
    }

    revalidatePath('/', 'layout') 
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || "Erreur technique lors de la vente" }
  }
}

// ==========================================
// LECTURE DU JOURNAL (INCHANGÉ)
// ==========================================
export async function getSalesJournal(type: 'PRODUIT_FINI' | 'MARCHANDISE') {
  return await prisma.saleLog.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' }
  })
}