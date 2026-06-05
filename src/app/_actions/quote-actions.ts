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
    
    // Nouveaux champs globaux
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
      // GESTION DE L'ARTICLE LIBRE (CUSTOM)
      if (product.family === 'CUSTOM') {
        let finalPrice = Number(product.customPriceHT) || 0
        if (discountPercent > 0) finalPrice = finalPrice * (1 - discountPercent / 100)
        if (isTTC) finalPrice = finalPrice * 1.20

        return {
          ...product,
          dims: {}, 
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
        products: calculatedProducts,            
        client: { connect: { id: clientId } },
        fabric: { connect: { id: firstValidFabricId } }
      }
    })

    // Créer les QuoteItem
    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => ({
        quoteId: quote.id,
        fabricId: p.fabricId || null,
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

// 2. 🆕 CORRECTION MAJEURE : Valider un devis avec DÉDUCTION DYNAMIQUE SUR LES LOTS ATELIER (FIFO)
export async function validateQuote(id: string) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!quote) throw new Error("Devis introuvable")
    if (quote.status === 'VALIDATED') return { success: false, error: "Ce devis est déjà validé." }

    // 🔐 Utilisation d'une transaction pour lier la validation et la baisse des stocks de rouleaux
    await prisma.$transaction(async (tx) => {
      
      // ÉTAPE A : Marquer le devis comme VALIDÉ
      await tx.quote.update({
        where: { id },
        data: { 
          status: QuoteStatus.VALIDATED,
          validatedAt: new Date()
        }
      })

      // ÉTAPE B : Grignoter les mètres dans les rouleaux (lots) physiques de l'Atelier
      for (const item of quote.items) {
        if (!item.fabricId || !item.quantityMeters || item.isChute) continue

        let metersToDeduct = item.quantityMeters

        // On va chercher les rouleaux actifs à l'ATELIER pour ce tissu du plus vieux au plus récent (FIFO)
        const activeLots = await tx.fabricLot.findMany({
          where: {
            fabricId: item.fabricId,
            location: 'ATELIER',
            quantityLeft: { gt: 0 }
          },
          orderBy: { createdAt: 'asc' }
        })

        // On déduit des rouleaux
        for (const lot of activeLots) {
          if (metersToDeduct <= 0) break

          if (lot.quantityLeft >= metersToDeduct) {
            // Le rouleau en cours suffit amplement
            await tx.fabricLot.update({
              where: { id: lot.id },
              data: { quantityLeft: { decrement: metersToDeduct } }
            })
            metersToDeduct = 0
          } else {
            // Le rouleau ne suffit pas, on le vide à zéro et on passe au rouleau suivant
            metersToDeduct -= lot.quantityLeft
            await tx.fabricLot.update({
              where: { id: lot.id },
              data: { quantityLeft: 0 }
            })
          }
        }

        // On crée l'historique global de mouvement pour le suivi comptable
        await tx.stockMovement.create({
          data: {
            fabricId: item.fabricId,
            type: "EXIT",
            quantityMeters: item.quantityMeters,
            reason: `Confection Ouvrage - Commande validée ${quote.reference}`
          }
        })

        // On met à jour le cache de secours de la fiche tissu
        await tx.fabric.update({
          where: { id: item.fabricId },
          data: {
            stockMeters: { decrement: item.quantityMeters }
          }
        })
      }
    })

    // On rafraîchit tous les onglets du tableau de bord
    revalidatePath('/quotes')
    revalidatePath('/dashboard')
    revalidatePath('/stock')
    revalidatePath('/orders')
    revalidatePath('/atelier')
    
    return { success: true }
  } catch (error) {
    console.error('Erreur validation devis lots:', error)
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
    console.error("Erreur lors de l'gestion de l'annulation :", error)
    return { success: false, error: "Une erreur technique est survenue." }
  }
}

// 1.BIS Mettre à jour un devis existant (MODIFICATION POST-DEVIS)
export async function updateQuoteFromCalculator(quoteId: string, data: any) {
  try {
    let productsData: any[] = []

    const isTTC = data.isTTC === true || data.isTTC === 'true'
    const discountPercent = parseFloat(data.discountPercent) || 0
    const clientId = data.clientId
    const paymentMethod = data.paymentMethod || null
    const dueDate = data.dueDate ? new Date(data.dueDate) : null
    
    if (!clientId) throw new Error("Un client doit obligatoirement être rattaché au devis.")
    if (data.products && Array.isArray(data.products)) productsData = data.products
    else throw new Error('Structure de données invalide')

    const fabricIds = productsData.map(p => p.fabricId).filter(Boolean)
    const fabrics = await prisma.fabric.findMany({ where: { id: { in: fabricIds } } })
    const fabricMap = new Map(fabrics.map(f => [f.id, f]))

    const fallbackFabric = await prisma.fabric.findFirst()
    const settings = await getAtelierSettings()
    const productTypes = await getProductTypes()
    const laborCostPerMin = settings?.laborCostPerMin || 0.35
    const marginRate = settings?.marginRate || 2.5

    const calculatedProducts = productsData.map(product => {
      if (product.family === 'CUSTOM') {
        let finalPrice = Number(product.customPriceHT) || 0
        if (discountPercent > 0) finalPrice = finalPrice * (1 - discountPercent / 100)
        if (isTTC) finalPrice = finalPrice * 1.20
        return {
          ...product,
          dims: {},
          totalPriceFinal: finalPrice,
          mainFabricMeters: Number(product.customFabricMeters) || 0,
          laborMinutes: Number(product.customLaborMinutes) || 0,
          fabricPricePerMeter: 0,
          fabricId: product.fabricId || null 
        }
      }

      const fabric = fabricMap.get(product.fabricId)
      const currentProductType = productTypes?.find(pt => pt.family === product.family)
      const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 
   
      const result = calculateNGProduction(
        product.family, product.range || 'BASIQUE',
        { L: Number(product.L) || 200, l: Number(product.l) || 160, bonnet: Number(product.bonnet) || 30, diametre: Number(product.diametre) || 210 },
        { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
        baseLaborMinutes, laborCostPerMin, marginRate         
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

    // ON EFFACE LES ANCIENNES LIGNES DU DEVIS
    await prisma.quoteItem.deleteMany({ where: { quoteId } })

    // ON MET À JOUR LE DEVIS
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        totalPrice: totalPrice,
        quantity: totalQuantity,
        isTTC: isTTC,
        paymentMethod: paymentMethod, 
        dueDate: dueDate,             
        clientId: clientId,
        products: calculatedProducts,
        fabricId: firstValidFabricId
      }
    })

    // ON RECRÉE LES NOUVELLES LIGNES
    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => ({
        quoteId: quoteId,
        fabricId: p.fabricId || null,
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
    return { success: true, quoteId: quoteId, total: totalPrice }
    
  } catch (error) {
    console.error('Erreur MAJ devis:', error)
    throw new Error(`Erreur lors de la mise à jour : ${error}`)
  }
}

// 4. Archiver une commande expédiée
export async function archiveQuote(id: string) {
  try {
    await prisma.quote.update({
      where: { id },
      data: { status: 'ARCHIVED' }
    })
    
    revalidatePath('/orders')
    revalidatePath('/dashboard')
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de l'archivage :", error)
    return { success: false, error: "Impossible d'archiver la commande." }
  }
}

// 5. Désarchiver une commande (Retour aux commandes en cours)
export async function unarchiveQuote(id: string) {
  try {
    await prisma.quote.update({
      where: { id },
      data: { status: 'VALIDATED' }
    })
    revalidatePath('/orders')
    revalidatePath('/orders/archive')
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: "Erreur lors du désarchivage." }
  }
}

// 6. Mettre à jour le motif de retour SAV
export async function updateReturnReason(id: string, reason: any) {
  try {
    await prisma.quote.update({
      where: { id },
      data: { 
        returnReason: reason || null,
      }
    })
    revalidatePath('/orders/archive')
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: "Erreur lors de la mise à jour du retour." }
  }
}

// 7. Traiter un Retour Client (SAV)
export async function processCustomerReturn(
  quoteId: string, 
  reason: string, 
  actionOnProduct: 'RESTOCK_BOUTIQUE' | 'LOSS'
) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { items: true }
    })

    if (!quote) throw new Error("Commande introuvable.")

    // 1. On enregistre le motif du retour pour les statistiques
    await prisma.quote.update({
      where: { id: quoteId },
      data: { 
        returnReason: reason as any
        // On laisse le statut en ARCHIVED, mais on a le motif enregistré
      }
    })

    // 2. Si le produit est intact (Erreur client), on le bascule en Boutique !
    if (actionOnProduct === 'RESTOCK_BOUTIQUE') {
      for (const item of quote.items) {
        if (item.isChute) continue // On ne restocke pas les chutes

        const referencePF = `SAV-${quote.reference}-${item.id.slice(-4)}`
        const finalPrice = Number(item.sellingPrice) || Number(quote.totalPrice)
        const namePF = item.customName || `Retour SAV (Réf: ${quote.reference})`

        // On le crée dans les Produits Finis de la Boutique
        const finishedProduct = await prisma.finishedProduct.create({
          data: {
            reference: referencePF,
            name: namePF,
            family: "SUR_MESURE",
            dimensions: "Sur-Mesure",
            stockQuantity: 1,
            alertThreshold: 0, 
            sellingPriceHT: quote.isTTC ? (finalPrice / 1.20) : finalPrice
          }
        })

        // On lui crée son lot pour la compta
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

    revalidatePath('/orders/archive')
    revalidatePath('/dashboard')
    revalidatePath('/boutique') // Si on a restocké, la boutique doit se rafraîchir
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors du SAV :", error)
    return { success: false, error: "Impossible de traiter ce retour." }
  }
}