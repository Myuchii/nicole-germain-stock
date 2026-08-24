'use server'

import { PrismaClient, QuoteStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateNGProduction } from "@/lib/engine"
import { getAtelierSettings, getProductTypes } from './settings-actions'

const prisma = new PrismaClient()

// 1. Créer un devis
export async function createQuoteFromCalculator(data: any) {
  try {
    let productsData: any[] = []

    const isTTC = data.isTTC === true || data.isTTC === 'true'
    const discountPercent = parseFloat(data.discountPercent) || 0
    const clientId = data.clientId
    const brand = data.brand || 'NG' 
    const paymentMethod = data.paymentMethod || null
    const dueDate = data.dueDate ? new Date(data.dueDate) : null
    
    if (data.products && Array.isArray(data.products)) {
      productsData = data.products
    } else {
      throw new Error('Structure de données invalide')
    }

    const fabricIds = productsData.map(p => p.fabricId).filter(Boolean)
    const fabrics = await prisma.fabric.findMany({
      where: { id: { in: fabricIds } } 
    })
    const fabricMap = new Map(fabrics.map(f => [f.id, f]))

    // 🟢 Récupération de toute la mercerie pour les prix dynamiques
    const accessories = await prisma.accessory.findMany({
      where: { isArchived: false }
    })
    const accMap = new Map(accessories.map(a => [a.id, a]))

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

        return {
          ...product,
          dims: {}, 
          totalPriceFinal: finalUnitPrice * qty, 
          mainFabricMeters: (Number(product.customFabricMeters) || 0) * qty,
          laborMinutes: (Number(product.customLaborMinutes) || 0) * qty,
          fabricPricePerMeter: 0,
          fabricId: product.fabricId || null,
          quantity: qty,
          debugSupplies: {} // Pas de fournitures auto pour le sur-mesure
        }
      }

      const fabric = fabricMap.get(product.fabricId)
      const currentProductType = productTypes?.find(pt => pt.family === product.family)
      const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 
   
      const L = Number(product.dims?.L ?? product.L) || 200
      const l = Number(product.dims?.l ?? product.l) || 160
      const epaisseur = Number(product.dims?.epaisseur ?? product.epaisseur) || 20
      const diametre = Number(product.dims?.diametre ?? product.diametre) || 210

      // 🟢 Récupération des prix exacts selon les choix de l'utilisateur
      const thread = product.threadId ? accMap.get(product.threadId) : null
      const bias = product.biasId ? accMap.get(product.biasId) : null
      const elastic = product.elasticId ? accMap.get(product.elasticId) : null
      const zipper = product.zipperId ? accMap.get(product.zipperId) : null

      const dynamicSupplyPrices = {
        threadPerMeter: thread ? thread.pricePerUnit : 0.005,
        biasPerMeter: bias ? bias.pricePerUnit : 0.10,
        elasticPerMeter: elastic ? elastic.pricePerUnit : 0.20,
        zipperPerMeter: zipper ? zipper.pricePerUnit : 6.00
      }

      const result = calculateNGProduction(
        product.family,
        product.range || 'BASIQUE',
        { L, l, epaisseur, diametre }, 
        { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
        baseLaborMinutes,           
        laborCostPerMin,   
        marginRate,
        dynamicSupplyPrices // 🟢 On injecte les vrais prix
      )
      
      let finalProductUnitPrice = result.totalPriceHT
      if (discountPercent > 0) finalProductUnitPrice = finalProductUnitPrice * (1 - discountPercent / 100)
      
      return {
        ...product,
        totalPriceFinal: (Number.isNaN(finalProductUnitPrice) ? 0 : finalProductUnitPrice) * qty, 
        mainFabricMeters: product.isChute ? 0 : (Number.isNaN(result.mainFabricMeters) ? 0 : result.mainFabricMeters) * qty,
        laborMinutes: (Number.isNaN(result.laborMinutes) ? 0 : result.laborMinutes) * qty,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0),
        quantity: qty,
        debugSupplies: result.debug?.supplies || {} // 🟢 FIX 1 : On garde les métrages en mémoire ici
      }
    })

    const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceFinal, 0)
    const totalQuantityUnits = calculatedProducts.reduce((sum, p) => sum + p.quantity, 0)
    const firstValidFabricId = calculatedProducts.find(p => p.fabricId)?.fabricId || fallbackFabric?.id

    const quote = await prisma.quote.create({
      data: {
        reference: `DEV-${Date.now().toString().slice(-6)}`,
        totalPrice: totalPrice, 
        quantity: totalQuantityUnits, 
        status: 'DRAFT',
        isTTC: isTTC,
        brand: brand, 
        paymentMethod: paymentMethod, 
        dueDate: dueDate,
        products: calculatedProducts,            
        client: clientId ? { connect: { id: clientId } } : undefined, 
        fabric: { connect: { id: firstValidFabricId } }
      }
    })

    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => {
        // 🟢 FIX 2 : On construit les fournitures avec les données mémorisées
        const itemSupplies = {
          thread: p.threadId ? { id: p.threadId, meters: p.debugSupplies.threadMeters || 0 } : null,
          bias: p.biasId ? { id: p.biasId, meters: p.debugSupplies.biasMeters || 0 } : null,
          elastic: p.elasticId ? { id: p.elasticId, meters: p.debugSupplies.elasticMeters || 0 } : null,
          zipper: p.zipperId ? { id: p.zipperId, meters: p.debugSupplies.zipperMeters || 0 } : null,
        }

        return {
          quoteId: quote.id,
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
          discountPercent: discountPercent,
          supplies: itemSupplies // 🟢 ENREGISTREMENT DES FOURNITURES
        }
      })
    })

    revalidatePath('/quotes')
    return { success: true, quoteId: quote.id, total: totalPrice }
    
  } catch (error) {
    console.error('Erreur création devis:', error)
    throw new Error(`Erreur lors de la création du devis: ${error}`)
  }
}

// 1.BIS Mettre à jour un devis existant
export async function updateQuoteFromCalculator(quoteId: string, data: any) {
  try {
    let productsData: any[] = []

    const isTTC = data.isTTC === true || data.isTTC === 'true'
    const discountPercent = parseFloat(data.discountPercent) || 0
    const clientId = data.clientId
    const brand = data.brand || 'NG' 
    const paymentMethod = data.paymentMethod || null
    const dueDate = data.dueDate ? new Date(data.dueDate) : null
    
    if (data.products && Array.isArray(data.products)) productsData = data.products
    else throw new Error('Structure de données invalide')

    const fabricIds = productsData.map(p => p.fabricId).filter(Boolean)
    const fabrics = await prisma.fabric.findMany({ where: { id: { in: fabricIds } } })
    const fabricMap = new Map(fabrics.map(f => [f.id, f]))

    // 🟢 Récupération de toute la mercerie pour les prix dynamiques
    const accessories = await prisma.accessory.findMany({ where: { isArchived: false } })
    const accMap = new Map(accessories.map(a => [a.id, a]))

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
        return {
          ...product,
          dims: {},
          totalPriceFinal: finalUnitPrice * qty,
          mainFabricMeters: (Number(product.customFabricMeters) || 0) * qty,
          laborMinutes: (Number(product.customLaborMinutes) || 0) * qty,
          fabricPricePerMeter: 0,
          fabricId: product.fabricId || null,
          quantity: qty,
          debugSupplies: {} 
        }
      }

      const fabric = fabricMap.get(product.fabricId)
      const currentProductType = productTypes?.find(pt => pt.family === product.family)
      const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 
   
      const L = Number(product.dims?.L ?? product.L) || 200
      const l = Number(product.dims?.l ?? product.l) || 160
      const epaisseur = Number(product.dims?.epaisseur ?? product.epaisseur) || 20
      const diametre = Number(product.dims?.diametre ?? product.diametre) || 210

      const thread = product.threadId ? accMap.get(product.threadId) : null
      const bias = product.biasId ? accMap.get(product.biasId) : null
      const elastic = product.elasticId ? accMap.get(product.elasticId) : null
      const zipper = product.zipperId ? accMap.get(product.zipperId) : null

      const dynamicSupplyPrices = {
        threadPerMeter: thread ? thread.pricePerUnit : 0.005,
        biasPerMeter: bias ? bias.pricePerUnit : 0.10,
        elasticPerMeter: elastic ? elastic.pricePerUnit : 0.20,
        zipperPerMeter: zipper ? zipper.pricePerUnit : 6.00
      }

      const result = calculateNGProduction(
        product.family, product.range || 'BASIQUE',
        { L, l, epaisseur, diametre }, 
        { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
        baseLaborMinutes, laborCostPerMin, marginRate, dynamicSupplyPrices         
      )
      
      let finalProductUnitPrice = result.totalPriceHT
      if (discountPercent > 0) finalProductUnitPrice = finalProductUnitPrice * (1 - discountPercent / 100)
      
      return {
        ...product,
        totalPriceFinal: (Number.isNaN(finalProductUnitPrice) ? 0 : finalProductUnitPrice) * qty,
        mainFabricMeters: product.isChute ? 0 : (Number.isNaN(result.mainFabricMeters) ? 0 : result.mainFabricMeters) * qty,
        laborMinutes: (Number.isNaN(result.laborMinutes) ? 0 : result.laborMinutes) * qty,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0),
        quantity: qty,
        debugSupplies: result.debug?.supplies || {} // 🟢 FIX 1 
      }
    })

    const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceFinal, 0)
    const totalQuantityUnits = calculatedProducts.reduce((sum, p) => sum + p.quantity, 0)
    const firstValidFabricId = calculatedProducts.find(p => p.fabricId)?.fabricId || fallbackFabric?.id

    await prisma.quoteItem.deleteMany({ where: { quoteId } })

    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        totalPrice: totalPrice,
        quantity: totalQuantityUnits,
        isTTC: isTTC,
        brand: brand, 
        paymentMethod: paymentMethod, 
        dueDate: dueDate,             
        clientId: clientId || null, 
        products: calculatedProducts,
        fabricId: firstValidFabricId
      }
    })

    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => {
        const itemSupplies = {
          thread: p.threadId ? { id: p.threadId, meters: p.debugSupplies.threadMeters || 0 } : null,
          bias: p.biasId ? { id: p.biasId, meters: p.debugSupplies.biasMeters || 0 } : null,
          elastic: p.elasticId ? { id: p.elasticId, meters: p.debugSupplies.elasticMeters || 0 } : null,
          zipper: p.zipperId ? { id: p.zipperId, meters: p.debugSupplies.zipperMeters || 0 } : null,
        }

        return {
          quoteId: quoteId, // 🟢 FIX 3 : C'est bien quoteId ici, et pas quote.id !
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
          discountPercent: discountPercent,
          supplies: itemSupplies
        }
      })
    })

    revalidatePath('/quotes')
    return { success: true, quoteId: quoteId, total: totalPrice }
    
  } catch (error) {
    console.error('Erreur MAJ devis:', error)
    throw new Error(`Erreur lors de la mise à jour : ${error}`)
  }
}

// 1. VALIDER LE DEVIS
export async function validateQuote(id: string) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id }
    })

    if (!quote) throw new Error("Devis introuvable")
    if (quote.status === 'VALIDATED') return { success: false, error: "Ce devis est déjà validé." }

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

// 2. Validation de la coupe à la table d'atelier (AVEC DÉDUCTION DE MERCERIE)
export async function cutItemInAtelier(itemId: string, useChute: boolean) {
  try {
    const item = await prisma.quoteItem.findUnique({
      where: { id: itemId },
      include: { quote: true }
    })

    if (!item) throw new Error("Ligne d'ouvrage introuvable")
    if (item.statusProduction !== 'A_COUPER') throw new Error("Cet article a déjà été coupé.")

    await prisma.$transaction(async (tx) => {
      
      await tx.quoteItem.update({
        where: { id: itemId },
        data: {
          statusProduction: 'EN_COUTURE',
          startedCoutureAt: new Date(),
          isChute: useChute 
        }
      })

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

        if (unitsRemaining > 0 && activeLots.length > 0) {
          const emergencyMeters = unitsRemaining * unitMeters
          await tx.fabricLot.update({
            where: { id: activeLots[0].id },
            data: { quantityLeft: { decrement: emergencyMeters } }
          })
        }

        await tx.stockMovement.create({
          data: { 
            fabricId: item.fabricId, 
            type: "EXIT", 
            quantityMeters: item.quantityMeters, 
            reason: `Coupe Rouleau - Commande ${item.quote.reference}` 
          }
        })

        await tx.fabric.update({
          where: { id: item.fabricId },
          data: { stockMeters: { decrement: item.quantityMeters } }
        })

      } else if (useChute && item.fabricId) {
        await tx.stockMovement.create({
          data: {
            fabricId: item.fabricId,
            type: "EXIT",
            quantityMeters: item.quantityMeters,
            reason: `Coupe CHUTE (Stock préservé) - Commande ${item.quote.reference}`
          }
        })
      }

      // 🟢 DÉDUCTION DE LA MERCERIE (Fil, Zip, Biais, Élastique)
      if (item.supplies && typeof item.supplies === 'object') {
        const suppliesObj = item.supplies as any
        const suppliesList = [suppliesObj.thread, suppliesObj.bias, suppliesObj.elastic, suppliesObj.zipper].filter(s => s && s.id && s.meters > 0)

        for (const supply of suppliesList) {
          const totalMetersToDeduct = supply.meters * (item.quantityUnits || 1)

          await tx.accessory.update({
            where: { id: supply.id },
            data: { stockQuantity: { decrement: totalMetersToDeduct } }
          })

          let supplyUnitsRemaining = totalMetersToDeduct
          const activeAccLots = await tx.accessoryLot.findMany({
            where: { accessoryId: supply.id, location: 'ATELIER', quantityLeft: { gt: 0 } },
            orderBy: { createdAt: 'asc' }
          })

          for (const lot of activeAccLots) {
            if (supplyUnitsRemaining <= 0) break
            const deduct = Math.min(lot.quantityLeft, supplyUnitsRemaining)
            await tx.accessoryLot.update({
              where: { id: lot.id },
              data: { quantityLeft: { decrement: deduct } }
            })
            supplyUnitsRemaining -= deduct
          }
        }
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

// 3. Annuler / Supprimer une commande
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

export async function updateOrderPrice(quoteId: string, newPriceHT: number) {
  try {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { totalPrice: newPriceHT }
    })

    await prisma.quoteItem.updateMany({
      where: { quoteId: quoteId },
      data: { sellingPrice: newPriceHT }
    })

    revalidatePath('/commandes') 
    return { success: true }
  } catch (error) {
    console.error("Erreur lors du chiffrage :", error)
    return { success: false, error: "Impossible de mettre à jour le prix." }
  }
}