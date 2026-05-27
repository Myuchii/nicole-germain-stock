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
    const clientId = data.clientId
    if (!clientId) {
      throw new Error("Un client doit obligatoirement être rattaché au devis.")
    }
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
        reference: `DEV-${Date.now().toString().slice(-6)}`,
        totalPrice,
        quantity: totalQuantity,
        status: 'DRAFT',
        fabricId: calculatedProducts[0]?.fabricId || '',
        clientId: clientId, // 🆕 Liaison obligatoire établie !
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

// 2. Valider un devis (tous les QuoteItem) avec DÉDUCTION FIFO SUR BUDGET DATÉ
export async function validateQuote(id: string) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!quote) throw new Error("Devis introuvable")

    // Parcourir chaque article du devis pour déduire le stock selon la méthode des lots (FIFO)
    for (const item of quote.items) {
      if (!item.fabricId || !item.quantityMeters || item.isChute) continue

      let metersToDeduct = item.quantityMeters

      // 1. On cherche toutes les entrées actives (mouvements d'achat) triées par la plus ANCIENNE d'abord
      const entries = await prisma.stockMovement.findMany({
        where: {
          fabricId: item.fabricId,
          type: "ENTRY"
        },
        orderBy: { createdAt: "asc" } // 'asc' = Du plus vieux au plus récent (FIFO)
      })

      // 2. On consomme par vagues successives le budget daté disponible
      for (const entry of entries) {
        if (metersToDeduct <= 0) break

        const purchasePriceUsed = entry.purchasePriceHT || 0

        // On crée un mouvement de sortie officiel ('EXIT') rattaché au prix d'achat d'origine de ce lot historique
        await prisma.stockMovement.create({
          data: {
            fabricId: item.fabricId,
            type: "EXIT",
            quantityMeters: metersToDeduct,
            reason: `Confection Ouvrage - Imputation Lot d'achat du ${entry.createdAt.toLocaleDateString('fr-FR')} (${purchasePriceUsed.toFixed(2)}€/m)`,
            purchasePriceHT: purchasePriceUsed // On fige l'historique de prix pour l'analyse des marges !
          }
        })

        // On considère le lot traité (dans un système sans colonne stock résiduel par lot, l'imputation se fait par cascade temporelle)
        metersToDeduct = 0
      }

      // 3. Mise à jour finale du compteur de stock instantané de la fiche tissu
      await prisma.fabric.update({
        where: { id: item.fabricId },
        data: {
          stockMeters: { decrement: item.quantityMeters }
        }
      })
    }

    // Valider définitivement le statut du devis global
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

    // 🔄 CAS 1 : L'ouvrage n'est pas encore cousu ↳ Remettre le tissu dispo dans le rouleau
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
    
    // 🏪 CAS 2 : L'ouvrage EST DÉJÀ COUSU ↳ On le bascule en Stock Boutique (PF)
    if (quote.status === "VALIDATED" && createPF) {
      for (const item of quote.items) {
        const referencePF = `REF-PF-${quote.reference}`
        const finalPrice = Number(item.sellingPrice) || Number(quote.totalPrice)
        
        // Formations des libellés propres pour la boutique
        const namePF = `Sur-mesure rescapé (Réf: ${quote.reference})`
        const descPF = `Pièce unique confectionnée en tissu ${item.fabric?.name || 'Atelier'} (${item.fabric?.color || 'Coloris unique'}).`

        // 1. Création ou récupération de la fiche mère (FinishedProduct)
        const finishedProduct = await prisma.finishedProduct.upsert({
          where: { reference: referencePF },
          update: {
            stockQuantity: { increment: 1 } // +1 au stock global de cette référence
          },
          create: {
            reference: referencePF,
            name: namePF,
            family: "SUR_MESURE",
            dimensions: "Sur-Mesure",
            stockQuantity: 1,
            alertThreshold: 0, // Pas d'alerte pour une pièce unique d'annulation
            sellingPriceHT: quote.isTTC ? (finalPrice / 1.20) : finalPrice
          }
        })

        // 2. Création obligatoire du Lot associé (FinishedProductLot) requis par ton schéma !
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

    // 3. Dans tous les cas, on nettoie la commande de l'Atelier
    await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
    await prisma.quote.delete({ where: { id } })
    
    revalidatePath('/quotes')
    revalidatePath('/orders') 
    revalidatePath('/stock')
    revalidatePath('/boutique') // Pour rafraîchir l'affichage boutique
    
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de la gestion de l'annulation :", error)
    return { success: false, error: "Une erreur technique est survenue lors du traitement du stock." }
  }
}