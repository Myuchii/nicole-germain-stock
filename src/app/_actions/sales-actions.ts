'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

export async function recordSale(formData: FormData) {
  // On récupère le panier sous forme de chaîne JSON et la méthode de paiement
  const cartJson = formData.get('cart') as string
  const paymentMethod = formData.get('paymentMethod') as string

  if (!cartJson || !paymentMethod) return { success: false, error: "Données de vente manquantes" }

  try {
    // On décode le panier (qui sera envoyé par notre composant React)
    const cartItems: { reference: string; quantity: number; type: 'PRODUIT_FINI' | 'MARCHANDISE' }[] = JSON.parse(cartJson)

    if (cartItems.length === 0) return { success: false, error: "Le panier est vide" }

    const ticketId = `TICK-${Date.now().toString().slice(-6)}`
    // On boucle sur chaque article du panier pour appliquer la logique FIFO
    for (const cartItem of cartItems) {
      const { reference, quantity, type } = cartItem
      let itemName = ""
      let finalTotalPriceHT = 0

      // ==========================================
      // CAS 1 : FLUX ② PRODUITS FINIS
      // ==========================================
      if (type === 'PRODUIT_FINI') {
        const item = await prisma.finishedProduct.findUnique({ 
          where: { reference },
          include: { lots: { orderBy: { createdAt: 'asc' } } }
        })

        if (!item) throw new Error(`Article ${reference} introuvable`)

        const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
        if (totalInStock < quantity) throw new Error(`Stock insuffisant pour ${reference}`)

        let quantityToDeduct = quantity
        let totalRevenueHT = 0

        for (const lot of item.lots) {
          if (quantityToDeduct <= 0) break

          if (lot.quantityLeft > 0) {
            const take = Math.min(quantityToDeduct, lot.quantityLeft)
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
        finalTotalPriceHT = totalRevenueHT
      } 
      // ==========================================
      // CAS 2 : FLUX ③ MARCHANDISES
      // ==========================================
      else {
        const item = await prisma.merchandise.findUnique({ 
          where: { reference },
          include: { lots: { orderBy: { createdAt: 'asc' } } }
        })

        if (!item) throw new Error(`Article ${reference} introuvable`)

        const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
        if (totalInStock < quantity) throw new Error(`Stock insuffisant pour ${reference}`)

        let quantityToDeduct = quantity
        let totalRevenueHT = 0

        for (const lot of item.lots) {
          if (quantityToDeduct <= 0) break

          if (lot.quantityLeft > 0) {
            const take = Math.min(quantityToDeduct, lot.quantityLeft)
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
        finalTotalPriceHT = totalRevenueHT
      }

      // ==========================================
      // ECRITURE DANS LE JOURNAL DES VENTES (Par article)
      // ==========================================
      await prisma.saleLog.create({
        data: {
          referenceItem: reference,
          name: itemName,
          type: type,
          quantitySold: quantity,
          totalPriceHT: finalTotalPriceHT,
          paymentMethod: paymentMethod,
          ticketId: ticketId
        }
      })
    } // Fin de la boucle du panier

    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur recordSale (Panier):", e)
    return { success: false, error: e.message || "Erreur technique lors de la vente" }
  }
}

// (Ta fonction getSalesJournal reste identique en dessous)
export async function getSalesJournal(type: 'PRODUIT_FINI' | 'MARCHANDISE') {
  return await prisma.saleLog.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' }
  })
}