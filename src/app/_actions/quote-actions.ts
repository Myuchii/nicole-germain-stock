'use server'

import { PrismaClient, QuoteStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateNGProduction } from "@/lib/engine"
import { getAtelierSettings, getProductTypes } from './settings-actions'

const prisma = new PrismaClient()

// 1. Créer un devis (SUPPORT MULTI-PRODUITS + QUANTITÉS MULTIPLIÉES + SÉCURITÉ HT PUR)
export async function createQuoteFromCalculator(data: any) {
  try {
    let productsData: any[] = []

    const isTTC = data.isTTC === true || data.isTTC === 'true'
    const discountPercent = parseFloat(data.discountPercent) || 0
    const clientId = data.clientId
    
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
      const qty = Math.max(1, parseInt(product.quantity) || 1)

      // GESTION DE L'ARTICLE LIBRE (CUSTOM)
      if (product.family === 'CUSTOM') {
        let finalUnitPrice = Number(product.customPriceHT) || 0
        if (discountPercent > 0) finalUnitPrice = finalUnitPrice * (1 - discountPercent / 100)
        // 🎯 FIX : On supprime la multiplication par 1.20 pour figer du HT propre en DB

        return {
          ...product,
          dims: {}, 
          totalPriceFinal: finalUnitPrice * qty, 
          mainFabricMeters: (Number(product.customFabricMeters) || 0) * qty,
          laborMinutes: (Number(product.customLaborMinutes) || 0) * qty,
          fabricPricePerMeter: 0,
          fabricId: product.fabricId || null,
          quantity: qty
        }
      }

      // 🧵 GESTION CLASSIQUE (MOTEUR NG MULTIPLIÉ)
      const fabric = fabricMap.get(product.fabricId)
      const currentProductType = productTypes?.find(pt => pt.family === product.family)
      const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 
   
      const L = Number(product.dims?.L ?? product.L) || 200
      const l = Number(product.dims?.l ?? product.l) || 160
      const bonnet = Number(product.dims?.bonnet ?? product.bonnet) || 30
      const diametre = Number(product.dims?.diametre ?? product.diametre) || 210

      const result = calculateNGProduction(
        product.family,
        product.range || 'BASIQUE',
        { L, l, bonnet, diametre },
        { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
        baseLaborMinutes,           
        laborCostPerMin,   
        marginRate         
      )
      
      let finalProductUnitPrice = result.totalPriceHT
      if (discountPercent > 0) finalProductUnitPrice = finalProductUnitPrice * (1 - discountPercent / 100)
      // 🎯 FIX : On supprime la multiplication par 1.20 pour figer du HT propre en DB
      
      return {
        ...product,
        totalPriceFinal: (Number.isNaN(finalProductUnitPrice) ? 0 : finalProductUnitPrice) * qty, 
        mainFabricMeters: product.isChute ? 0 : (Number.isNaN(result.mainFabricMeters) ? 0 : result.mainFabricMeters) * qty,
        laborMinutes: (Number.isNaN(result.laborMinutes) ? 0 : result.laborMinutes) * qty,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0),
        quantity: qty
      }
    })

    const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceFinal, 0)
    const totalQuantityUnits = calculatedProducts.reduce((sum, p) => sum + p.quantity, 0)

    const firstValidFabricId = calculatedProducts.find(p => p.fabricId)?.fabricId || fallbackFabric?.id

    const quote = await prisma.quote.create({
      data: {
        reference: `DEV-${Date.now().toString().slice(-6)}`,
        totalPrice: totalPrice, // Devient le total global HT propre
        quantity: totalQuantityUnits, 
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
        sellingPrice: p.totalPriceFinal, // Prix de la ligne en HT pur
        quantityUnits: p.quantity, 
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
      const qty = Math.max(1, parseInt(product.quantity) || 1) 

      if (product.family === 'CUSTOM') {
        let finalUnitPrice = Number(product.customPriceHT) || 0
        if (discountPercent > 0) finalUnitPrice = finalUnitPrice * (1 - discountPercent / 100)
        // 🎯 FIX : On supprime la multiplication par 1.20 pour figer du HT propre en DB
        return {
          ...product,
          dims: {},
          totalPriceFinal: finalUnitPrice * qty,
          mainFabricMeters: (Number(product.customFabricMeters) || 0) * qty,
          laborMinutes: (Number(product.customLaborMinutes) || 0) * qty,
          fabricPricePerMeter: 0,
          fabricId: product.fabricId || null,
          quantity: qty
        }
      }

      const fabric = fabricMap.get(product.fabricId)
      const currentProductType = productTypes?.find(pt => pt.family === product.family)
      const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 
   
      const L = Number(product.dims?.L ?? product.L) || 200
      const l = Number(product.dims?.l ?? product.l) || 160
      const bonnet = Number(product.dims?.bonnet ?? product.bonnet) || 30
      const diametre = Number(product.dims?.diametre ?? product.diametre) || 210

      const result = calculateNGProduction(
        product.family, product.range || 'BASIQUE',
        { L, l, bonnet, diametre },
        { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
        baseLaborMinutes, laborCostPerMin, marginRate         
      )
      
      let finalProductUnitPrice = result.totalPriceHT
      if (discountPercent > 0) finalProductUnitPrice = finalProductUnitPrice * (1 - discountPercent / 100)
      // 🎯 FIX : On supprime la multiplication par 1.20 pour figer du HT propre en DB
      
      return {
        ...product,
        totalPriceFinal: (Number.isNaN(finalProductUnitPrice) ? 0 : finalProductUnitPrice) * qty,
        mainFabricMeters: product.isChute ? 0 : (Number.isNaN(result.mainFabricMeters) ? 0 : result.mainFabricMeters) * qty,
        laborMinutes: (Number.isNaN(result.laborMinutes) ? 0 : result.laborMinutes) * qty,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0),
        quantity: qty
      }
    })

    const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceFinal, 0)
    const totalQuantityUnits = calculatedProducts.reduce((sum, p) => sum + p.quantity, 0)
    const firstValidFabricId = calculatedProducts.find(p => p.fabricId)?.fabricId || fallbackFabric?.id

    // ON EFFACE LES ANCIENNES LIGNES DU DEVIS
    await prisma.quoteItem.deleteMany({ where: { quoteId } })

    // ON MET À JOUR LE DEVIS PARENT
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        totalPrice: totalPrice,
        quantity: totalQuantityUnits,
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
        quantityUnits: p.quantity, 
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

// 1. VALIDER LE DEVIS (Simple passage en fabrication, sans toucher au tissu)
export async function validateQuote(id: string) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id }
    })

    if (!quote) throw new Error("Devis introuvable")
    if (quote.status === 'VALIDATED') return { success: false, error: "Ce devis est déjà validé." }

    // On valide l'en-tête, les lignes passent automatiquement à disposition de l'atelier
    await prisma.quote.update({
      where: { id },
      data: { 
        status: QuoteStatus.VALIDATED,
        validatedAt: new Date()
      }
    })

    revalidatePath('/quotes')
    revalidatePath('/commandes')
    revalidatePath('/atelier')
    
    return { success: true }
  } catch (error) {
    console.error('Erreur validation devis:', error)
    throw new Error(`Erreur lors de la validation du devis: ${error}`)
  }
}

// 2. 🆕 NOUVELLE ACTION : Validation de la coupe à la table d'atelier
export async function cutItemInAtelier(itemId: string, useChute: boolean) {
  try {
    const item = await prisma.quoteItem.findUnique({
      where: { id: itemId },
      include: { quote: true }
    })

    if (!item) throw new Error("Ligne d'ouvrage introuvable")
    if (item.statusProduction !== 'A_COUPER') throw new Error("Cet article a déjà été coupé.")

    await prisma.$transaction(async (tx) => {
      
      // ÉTAPE 1 : Mettre à jour le statut de fabrication de l'article
      await tx.quoteItem.update({
        where: { id: itemId },
        data: {
          statusProduction: 'EN_COUTURE', // Bascule à l'étape suivante (Couture)
          startedCoutureAt: new Date(),
          isChute: useChute // Enregistre si Nicole a utilisé une chute ou non
        }
      })

      // ÉTAPE 2 : Si Nicole utilise un rouleau normal (Pas une chute), on applique ton calcul unitaire
      if (!useChute && item.fabricId && item.quantityMeters && item.quantityUnits) {
        const totalUnitsToMake = item.quantityUnits
        const unitMeters = item.quantityMeters / totalUnitsToMake 

        let unitsRemaining = totalUnitsToMake
        let currentLotIndex = 0

        const activeLots = await tx.fabricLot.findMany({
          where: { fabricId: item.fabricId, location: 'ATELIER', quantityLeft: { gt: 0 } },
          orderBy: { createdAt: 'asc' }
        })

        while (unitsRemaining > 0 && currentLotIndex < activeLots.length) {
          const lot = activeLots[currentLotIndex]
          const possibleUnitsInThisLot = Math.floor(lot.quantityLeft / unitMeters)

          if (possibleUnitsInThisLot > 0) {
            const unitsToCut = Math.min(possibleUnitsInThisLot, unitsRemaining)
            const metersToDeduct = unitsToCut * unitMeters

            await tx.fabricLot.update({
              where: { id: lot.id },
              data: { quantityLeft: { decrement: metersToDeduct } }
            })

            lot.quantityLeft -= metersToDeduct
            unitsRemaining -= unitsToCut
          }

          if (unitsRemaining > 0) {
            currentLotIndex++
          }
        }

        // Sécurité si manque de tissu
        if (unitsRemaining > 0 && activeLots.length > 0) {
          const emergencyMeters = unitsRemaining * unitMeters
          await tx.fabricLot.update({
            where: { id: activeLots[0].id },
            data: { quantityLeft: { decrement: emergencyMeters } }
          })
        }

        // Mouvement comptable classique
        await tx.stockMovement.create({
          data: { 
            fabricId: item.fabricId, 
            type: "EXIT", 
            quantityMeters: item.quantityMeters, 
            reason: `Coupe Rouleau - Commande ${item.quote.reference}` 
          }
        })

        // Baisse du cache global
        await tx.fabric.update({
          where: { id: item.fabricId },
          data: { stockMeters: { decrement: item.quantityMeters } }
        })

      } else if (useChute && item.fabricId) {
        // 🎯 Si c'est une chute, on crée juste une notification de stock sans toucher aux rouleaux précieux !
        await tx.stockMovement.create({
          data: {
            fabricId: item.fabricId,
            type: "EXIT",
            quantityMeters: item.quantityMeters,
            reason: `Coupe CHUTE (Stock préservé) - Commande ${item.quote.reference}`
          }
        })
      }
    })

    revalidatePath('/atelier')
    revalidatePath('/stock')
    return { success: true }
  } catch (error) {
    console.error('Erreur technique lors de la coupe à l’atelier:', error)
    throw new Error("Impossible de valider la coupe de cet article")
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
          update: { stockQuantity: { increment: 1 } },
          create: { reference: referencePF, name: namePF, family: "SUR_MESURE", dimensions: "Sur-Mesure", stockQuantity: 1, alertThreshold: 0, sellingPriceHT: quote.isTTC ? (finalPrice / 1.20) : finalPrice }
        })

        await prisma.finishedProductLot.create({
          data: { finishedProductId: finishedProduct.id, quantityManufactured: 1, quantityLeft: 1, sellingPriceHT: finishedProduct.sellingPriceHT }
        })
      }
    }

    await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
    await prisma.quote.delete({ where: { id } })
    
    revalidatePath('/quotes')
    revalidatePath('/commandes') 
    revalidatePath('/stock')
    revalidatePath('/boutique') 
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de l'gestion de l'annulation :", error)
    return { success: false, error: "Une erreur technique est survenue." }
  }
}

// 4. Archiver une commande expédiée
export async function archiveQuote(id: string) {
  try {
    await prisma.quote.update({ where: { id }, data: { status: 'ARCHIVED' } })
    revalidatePath('/commandes'); revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    return { success: false, error: "Impossible d'archiver." }
  }
}

// 5. Désarchiver une commande
export async function unarchiveQuote(id: string) {
  try {
    await prisma.quote.update({ where: { id }, data: { status: 'VALIDATED' } })
    revalidatePath('/commandes'); revalidatePath('/commandes/archive')
    return { success: true }
  } catch (error) {
    return { success: false, error: "Erreur désarchivage." }
  }
}

// 6. Mettre à jour le motif de retour SAV
export async function updateReturnReason(id: string, reason: any) {
  try {
    await prisma.quote.update({ where: { id }, data: { returnReason: reason || null } })
    revalidatePath('/commandes/archive')
    return { success: true }
  } catch (error) {
    return { success: false, error: "Erreur SAV." }
  }
}

// 7. Traiter un Retour Client (SAV)
export async function processCustomerReturn(quoteId: string, reason: string, actionOnProduct: 'RESTOCK_BOUTIQUE' | 'LOSS') {
  try {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } })
    if (!quote) throw new Error("Commande introuvable.")

    await prisma.quote.update({ where: { id: quoteId }, data: { returnReason: reason as any } })

    if (actionOnProduct === 'RESTOCK_BOUTIQUE') {
      for (const item of quote.items) {
        if (item.isChute) continue
        const referencePF = `SAV-${quote.reference}-${item.id.slice(-4)}`
        const finalPrice = Number(item.sellingPrice) || Number(quote.totalPrice)
        const namePF = item.customName || `Retour SAV (Réf: ${quote.reference})`

        const finishedProduct = await prisma.finishedProduct.create({
          data: { reference: referencePF, name: namePF, family: "SUR_MESURE", dimensions: "Sur-Mesure", stockQuantity: 1, alertThreshold: 0, sellingPriceHT: quote.isTTC ? (finalPrice / 1.20) : finalPrice }
        })

        await prisma.finishedProductLot.create({
          data: { finishedProductId: finishedProduct.id, quantityManufactured: 1, quantityLeft: 1, sellingPriceHT: finishedProduct.sellingPriceHT }
        })
      }
    }

    revalidatePath('/commandes/archive'); revalidatePath('/dashboard'); revalidatePath('/boutique')
    return { success: true }
  } catch (error) {
    return { success: false, error: "Impossible de traiter." }
  }
}