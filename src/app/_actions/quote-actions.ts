'use server'
import { PrismaClient, QuoteStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateNGProduction } from "@/lib/engine"

const prisma = new PrismaClient()

// 1. Créer un devis (SUPPORT MULTI-PRODUITS + CHUTES, PROMOS, TVA)
export async function createQuoteFromCalculator(data: any) {
  try {
    let productsData: any[] = []

    // 🆕 RÉCUPÉRATION DES OPTIONS DE LA FEUILLE DE ROUTE DE NICOLE
    const isChute = data.isChute === true || data.isChute === 'true'
    const isTTC = data.isTTC === true || data.isTTC === 'true'
    const discountPercent = parseFloat(data.discountPercent) || 0

    // NOUVEAU : Support multi-produits
    if (data.products && Array.isArray(data.products)) {
      productsData = data.products
    } 
    // ANCIEN : Support structure simple (1 seul produit)
    else if (data.family && data.fabricId) {
      productsData = [{
        family: data.family,
        range: data.range,
        fabricId: data.fabricId,
        L: data.L,
        l: data.l,
        bonnet: data.bonnet,
        diametre: data.diametre,
        mainPrice: data.mainPrice
      }]
    } else {
      throw new Error('Structure de données invalide')
    }

    // Récupérer les tissus
    const fabricIds = productsData.map(p => p.fabricId).filter(Boolean)
    const fabrics = await prisma.fabric.findMany({
      where: { id: { in: fabricIds } }
    })
    const fabricMap = new Map(fabrics.map(f => [f.id, f]))

    // Calculer chaque produit
    const calculatedProducts = productsData.map(product => {
      const fabric = fabricMap.get(product.fabricId)
      
      const result = calculateNGProduction(
        product.family,
        product.range || 'BASIQUE',
        { 
          L: product.L || 200, 
          l: product.l || 160, 
          bonnet: product.bonnet || 30, 
          diametre: product.diametre || 210 
        },
        { 
          mainPrice: Number(fabric?.pricePerMeter || 0),
          laize: Number(fabric?.width || 300)
        }
      )
      
      // 🆕 LOGIQUE FINANCIÈRE DE FIN DE CALCUL (Promo et TVA)
      let finalProductPrice = result.totalPriceHT

      // 1. On applique la remise commerciale si existante
      if (discountPercent > 0) {
        finalProductPrice = finalProductPrice * (1 - discountPercent / 100)
      }

      // 2. On applique la TVA si le mode TTC est coché par Nicole
      if (isTTC) {
        finalProductPrice = finalProductPrice * 1.20
      }
      
      return {
        ...product,
        totalPriceFinal: finalProductPrice,
        // 💡 LOGIQUE DE LA CHUTE : si c'est une chute, on note 0m pour le stock, mais on garde le calcul pour Nicole
        mainFabricMeters: isChute ? 0 : result.mainFabricMeters,
        laborMinutes: result.laborMinutes,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0)
      }
    })

const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceFinal, 0)
const totalQuantity = calculatedProducts.reduce((sum, p) => sum + p.mainFabricMeters, 0)

const quote = await prisma.quote.create({
  data: {
    reference: `DEV-${Date.now()}`,
    totalPrice,
    quantity: totalQuantity,
    status: 'DRAFT',
    fabricId: calculatedProducts[0]?.fabricId || '',
    isTTC: isTTC 
  }
})

    // Créer les QuoteItem (Mappé sur notre schéma étendu !)
    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => ({
        quoteId: quote.id,
        fabricId: p.fabricId,
        quantityMeters: p.mainFabricMeters, // Vaudra 0 si c'est une chute !
        prodTimeMinutes: p.laborMinutes,
        costPerMinute: 0.5, 
        sellingPrice: p.totalPriceFinal,
        quantityUnits: calculatedProducts.length,
        
        // 🆕 ENREGISTREMENT DES OPTIONS SPRINT DANS LA BASE
        statusProduction: "A_COUPER",
        isChute: isChute,
        discountPercent: discountPercent
      }))
    })

    revalidatePath('/quotes')
    return { success: true, quoteId: quote.id, total: totalPrice }
    
  } catch (error) {
    console.error('Erreur création devis:', error)
    throw new Error(`Erreur lors de la création du devis: ${error}`)
  }
}

// 2. Valider un devis (tous les QuoteItem)
export async function validateQuote(id: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { items: true }
  })

  if (!quote) throw new Error("Devis introuvable")

  // Décrementer TOUS les tissus des QuoteItem
  const items = await prisma.quoteItem.findMany({
    where: { quoteId: id }
  })

  for (const item of items) {
    if (item.fabricId) {
      await prisma.fabric.update({
        where: { id: item.fabricId },
        data: {
          stockMeters: { 
            decrement: item.quantityMeters || 0 // Si c'est une chute, ça décrémente de 0 !
          }
        }
      })
    }
  }

  // Valider le devis
  await prisma.quote.update({
    where: { id },
    data: { 
      status: QuoteStatus.VALIDATED,
      validatedAt: new Date()
    }
  })

  revalidatePath('/quotes')
  revalidatePath('/dashboard')
  revalidatePath('/stock')
  revalidatePath('/atelier') // 🆕 On rafraîchit aussi l'atelier pour faire apparaître les cartes
}

// 3. Supprimer un devis
export async function deleteQuote(id: string) {
  try {
    // 1. On nettoie d'abord TOUS les sous-produits liés à ce devis
    await prisma.quoteItem.deleteMany({
      where: { quoteId: id }
    })

    // 2. Maintenant que le devis est libre, on le supprime
    await prisma.quote.delete({
      where: { id }
    })
    
    // 3. On rafraîchit la bonne page
    revalidatePath('/quotes')
    revalidatePath('/orders') 
    revalidatePath('/atelier') // 🆕 Nettoie aussi l'atelier si le devis saute
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de la suppression du devis :", error)
    return { success: false, error: "Impossible de supprimer le devis." }
  }
}