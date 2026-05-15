'use server'

import { PrismaClient, QuoteStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateNGProduction } from "@/lib/engine"

const prisma = new PrismaClient()

// 1. Créer un devis (SUPPORT MULTI-PRODUITS avec Quote/QuoteItem)
export async function createQuoteFromCalculator(data: any) {
  try {
    let productsData: any[] = []

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
      
      return {
        ...product,
        totalPriceHT: result.totalPriceHT,
        mainFabricMeters: result.mainFabricMeters,
        laborMinutes: result.laborMinutes,
        fabricPricePerMeter: Number(fabric?.pricePerMeter || 0)
      }
    })

    // Créer le devis PRINCIPAL (1 seul Quote)
    const totalPrice = calculatedProducts.reduce((sum, p) => sum + p.totalPriceHT, 0)
    const totalQuantity = calculatedProducts.reduce((sum, p) => sum + p.mainFabricMeters, 0)

    const quote = await prisma.quote.create({
      data: {
        reference: `DEV-${Date.now()}`,
        totalPrice,
        quantity: totalQuantity,
        status: 'DRAFT',
        fabricId: calculatedProducts[0]?.fabricId || '', // Premier tissu pour compatibilité
      }
    })

    // Créer les QuoteItem (UNIQUEMENT les champs existants !)
    await prisma.quoteItem.createMany({
      data: calculatedProducts.map(p => ({
        quoteId: quote.id,
        fabricId: p.fabricId,
        quantityMeters: p.mainFabricMeters,
        prodTimeMinutes: p.laborMinutes,
        costPerMinute: 0.5, // Votre logique de coût
        sellingPrice: p.totalPriceHT,
        // Infos produit stockées dans quantityUnits (hack pour votre schéma)
        quantityUnits: calculatedProducts.length // Nb produits
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
            decrement: item.quantityMeters || 0 
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
}

// 3. Supprimer un devis
export async function deleteQuote(id: string) {
  try {
    await prisma.quote.delete({
      where: { id }
    })
    revalidatePath('/quotes')
  } catch (error) {
    console.error("Erreur lors de la suppression:", error)
  }
}