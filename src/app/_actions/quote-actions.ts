'use server'
import { PrismaClient, QuoteStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateNGProduction } from "@/lib/engine"
import { getAtelierSettings, getProductTypes } from './settings-actions'

const prisma = new PrismaClient()

// 1. Créer un devis (SUPPORT MULTI-PRODUITS + ARTICLES MANUELS + DÉLAIS)
export async function createQuoteFromCalculator(data: any) {
  try {
    let productsData: any[] = []

    const isTTC = data.isTTC === true || data.isTTC === 'true'
    const discountPercent = parseFloat(data.discountPercent) || 0
    const clientId = data.clientId
    
    // 🆕 Nouveaux champs globaux
    const paymentMethod = data.paymentMethod || null
    const dueDate = data.dueDate ? new Date(data.dueDate) : null
    
    if (!clientId) {
      throw new Error("Un client doit obligatoirement être rattaché au devis.")
    }

    if (data.products && Array.isArray(data.products)) {
      productsData = data.products
    } else {
      throw new Error('Structure de données invalide')
    }

    // Récupérer les tissus
    const fabricIds = productsData.map(p => p.fabricId).filter(Boolean)
    const fabrics = await prisma.fabric.findMany({
      where: { id: { in: fabricIds } }
    })
    const fabricMap = new Map(fabrics.map(f => [f.id, f]))

    const fallbackFabric = await prisma.fabric.findFirst()
    const settings = await getAtelierSettings()
    const productTypes = await getProductTypes()
    const laborCostPerMin = settings?.laborCostPerMin || 0.35
    const marginRate = settings?.marginRate || 2.5

    const calculatedProducts = productsData.map(product => {
// 🛠️ GESTION DE L'ARTICLE LIBRE (CUSTOM)
      if (product.family === 'CUSTOM') {
        let finalPrice = Number(product.customPriceHT) || 0
        if (discountPercent > 0) finalPrice = finalPrice * (1 - discountPercent / 100)
        if (isTTC) finalPrice = finalPrice * 1.20

        return {
          ...product,
          dims: {}, // 👈 On TUE les dimensions fantômes dans la base de données !
          totalPriceFinal: finalPrice,
          mainFabricMeters: Number(product.customFabricMeters) || 0,
          laborMinutes: Number(product.customLaborMinutes) || 0,
          fabricPricePerMeter: 0,
          fabricId: product.fabricId || null 
        }
      }

      // 🧵 GESTION CLASSIQUE (MOTEUR NG)
      const fabric = fabricMap.get(product.fabricId)
      const currentProductType = productTypes?.find(pt => pt.family === product.family)
      const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 
   
      const result = calculateNGProduction(
        product.family,
        product.range || 'BASIQUE',
        { 
          L: Number(product.L) || 200, l: Number(product.l) || 160, 
          bonnet: Number(product.bonnet) || 30, diametre: Number(product.diametre) || 210 
        },
        { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
        baseLaborMinutes,           
        laborCostPerMin,   
        marginRate         
      )
      
      let finalProductPrice = result.totalPriceHT
      if (discountPercent > 0) finalProductPrice = finalProductPrice * (1 - discountPercent / 100)
      if (isTTC) finalProductPrice = finalProductPrice * 1.20
      
      return {
        ...product,
        totalPriceFinal: Number.isNaN(finalProductPrice) ? 0 : finalProductPrice,
        mainFabricMeters: product.isChute ? 0 : (Number.isNaN(result.mainFabricMeters) ? 0 : result.mainFabricMeters),
        laborMinutes: Number.isNaN(result.laborMinutes) ? 0 : result.laborMinutes,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0)
      }
    })

    const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceFinal, 0)
    const totalQuantity = calculatedProducts.reduce((sum, p) => sum + p.mainFabricMeters, 0)

    const firstValidFabricId = calculatedProducts.find(p => p.fabricId)?.fabricId || fallbackFabric?.id

    const quote = await prisma.quote.create({
      data: {
        reference: `DEV-${Date.now().toString().slice(-6)}`,
        totalPrice: totalPrice,
        quantity: totalQuantity,
        status: 'DRAFT',
        isTTC: isTTC,
        paymentMethod: paymentMethod, 
        dueDate: dueDate,             
        client: { connect: { id: clientId } },
        fabric: { connect: { id: firstValidFabricId } }
      }
    })

    // Créer les QuoteItem
    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => ({
        quoteId: quote.id,
        fabricId: p.fabricId || null,
        // 🆕 Injection des données manuelles
        customName: p.family === 'CUSTOM' ? p.customName : null,
        customPriceHT: p.family === 'CUSTOM' ? p.customPriceHT : null,
        quantityMeters: p.mainFabricMeters, 
        prodTimeMinutes: p.laborMinutes,
        costPerMinute: laborCostPerMin,
        sellingPrice: p.totalPriceFinal,
        quantityUnits: 1, 
        statusProduction: "A_COUPER",
        isChute: p.isChute || false,
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

// 2. Valider un devis avec DÉDUCTION FIFO
export async function validateQuote(id: string) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!quote) throw new Error("Devis introuvable")

    for (const item of quote.items) {
      if (!item.fabricId || !item.quantityMeters || item.isChute) continue

      let metersToDeduct = item.quantityMeters

      const entries = await prisma.stockMovement.findMany({
        where: {
          fabricId: item.fabricId,
          type: "ENTRY"
        },
        orderBy: { createdAt: "asc" } 
      })

      for (const entry of entries) {
        if (metersToDeduct <= 0) break

        const purchasePriceUsed = entry.purchasePriceHT || 0

        await prisma.stockMovement.create({
          data: {
            fabricId: item.fabricId,
            type: "EXIT",
            quantityMeters: metersToDeduct,
            reason: `Confection Ouvrage - Imputation Lot d'achat du ${entry.createdAt.toLocaleDateString('fr-FR')} (${purchasePriceUsed.toFixed(2)}€/m)`,
            purchasePriceHT: purchasePriceUsed 
          }
        })
        metersToDeduct = 0
      }

      await prisma.fabric.update({
        where: { id: item.fabricId },
        data: {
          stockMeters: { decrement: item.quantityMeters }
        }
      })
    }

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
    revalidatePath('/orders')
    revalidatePath('/atelier')
    
    return { success: true }
  } catch (error) {
    console.error('Erreur validation devis:', error)
    throw new Error(`Erreur lors de la validation du devis: ${error}`)
  }
}

// 3. Annuler / Supprimer une commande ou un devis
export async function deleteQuote(id: string, createPF: boolean = false) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: { include: { fabric: true } } }
    })

    if (!quote) return { success: false, error: "Commande introuvable." }

    if (quote.status === "VALIDATED" && !createPF) {
      for (const item of quote.items) {
        if (item.fabricId && item.quantityMeters && !item.isChute) {
          await prisma.fabric.update({
            where: { id: item.fabricId },
            data: { stockMeters: { increment: item.quantityMeters } }
          })
        }
      }
    }
    
    if (quote.status === "VALIDATED" && createPF) {
      for (const item of quote.items) {
        const referencePF = `REF-PF-${quote.reference}`
        const finalPrice = Number(item.sellingPrice) || Number(quote.totalPrice)
        
        const namePF = item.customName || `Sur-mesure rescapé (Réf: ${quote.reference})`

        const finishedProduct = await prisma.finishedProduct.upsert({
          where: { reference: referencePF },
          update: {
            stockQuantity: { increment: 1 }
          },
          create: {
            reference: referencePF,
            name: namePF,
            family: "SUR_MESURE",
            dimensions: "Sur-Mesure",
            stockQuantity: 1,
            alertThreshold: 0, 
            sellingPriceHT: quote.isTTC ? (finalPrice / 1.20) : finalPrice
          }
        })

        await prisma.finishedProductLot.create({
          data: {
            finishedProductId: finishedProduct.id,
            quantityManufactured: 1,
            quantityLeft: 1,
            sellingPriceHT: finishedProduct.sellingPriceHT
          }
        })
      }
    }

    await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
    await prisma.quote.delete({ where: { id } })
    
    revalidatePath('/quotes')
    revalidatePath('/orders') 
    revalidatePath('/stock')
    revalidatePath('/boutique') 
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de la gestion de l'annulation :", error)
    return { success: false, error: "Une erreur technique est survenue." }
  }
}
