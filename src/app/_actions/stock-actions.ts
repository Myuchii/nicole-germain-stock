'use server'
import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

export async function getInventoryData() {
  // 1. Récupération des Produits Finis
  const finishedProducts = await prisma.finishedProduct.findMany({ 
    orderBy: { reference: 'asc' },
    include: { lots: { orderBy: { createdAt: 'asc' } } } // ⬅️ Inclusion des lots
  })
  
  const finishedAlerts = finishedProducts.filter(p => p.stockQuantity <= p.alertThreshold).length
const finishedTotal = finishedProducts.reduce((sum, p) => sum + p.lots.reduce((s, l) => s + l.quantityLeft, 0), 0)
  const finishedValue = finishedProducts.reduce((sum, p) => sum + (p.stockQuantity * p.sellingPriceHT), 0)

  // 2. Récupération des Marchandises AVEC LEURS LOTS (Le secret est là 💡)
  const merchandise = await prisma.merchandise.findMany({ 
    orderBy: { reference: 'asc' },
    include: { lots: { orderBy: { createdAt: 'asc' } } } // ⬅️ On force Prisma à ramener l'historique des lots !
  })

  // Calculs dynamiques basés sur la somme des lots
  const merchAlerts = merchandise.filter(m => {
    const totalStock = m.lots.reduce((sum, lot) => sum + lot.quantityLeft, 0)
    return totalStock <= m.alertThreshold
  }).length

  const merchTotal = merchandise.reduce((sum, m) => {
    return sum + m.lots.reduce((s, lot) => s + lot.quantityLeft, 0)
  }, 0)

  const merchValueSale = merchandise.reduce((sum, m) => {
    const totalStock = m.lots.reduce((s, lot) => s + lot.quantityLeft, 0)
    return sum + (totalStock * m.sellingPriceHT)
  }, 0)

  return {
    finished: {
      items: finishedProducts,
      alertCount: finishedAlerts,
      totalQuantity: finishedTotal,
      totalValue: finishedValue
    },
    merchandise: {
      items: merchandise,
      alertCount: merchAlerts,
      totalQuantity: merchTotal,
      totalValueSale: merchValueSale
    }
  }
}

export async function createFinishedProduct(formData: FormData) {
  const reference = formData.get('reference') as string
  const name = formData.get('name') as string
  const family = formData.get('family') as string
  const dimensions = formData.get('dimensions') as string
  const stockQuantity = parseInt(formData.get('stockQuantity') as string, 10) || 0
  const alertThreshold = parseInt(formData.get('alertThreshold') as string, 10) || 5
  const sellingPriceHT = parseFloat(formData.get('sellingPriceHT') as string) || 0

  try {
    let product = await prisma.finishedProduct.findUnique({ where: { reference } })

    if (!product) {
      product = await prisma.finishedProduct.create({
        data: { reference, name, family, dimensions, alertThreshold, sellingPriceHT } // On ne met plus le stock direct ici
      })
    } else {
      await prisma.finishedProduct.update({
        where: { reference },
        data: { sellingPriceHT }
      })
    }

    // 📦 Génération du lot de production
    if (stockQuantity > 0) {
      await prisma.finishedProductLot.create({
        data: {
          finishedProductId: product.id,
          quantityManufactured: stockQuantity,
          quantityLeft: stockQuantity,
          sellingPriceHT: sellingPriceHT
        }
      })
    }

    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e: any) {
    console.error(e)
    return { success: false, error: "Erreur Confection : " + (e.message || "Erreur technique") }
  }
}

export async function createMerchandise(formData: FormData) {
  const reference = formData.get('reference') as string
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const stockQuantity = parseInt(formData.get('stockQuantity') as string, 10) || 0
  const alertThreshold = parseInt(formData.get('alertThreshold') as string, 10) || 3
  const purchasePriceHT = parseFloat(formData.get('purchasePriceHT') as string) || 0
  const sellingPriceHT = parseFloat(formData.get('sellingPriceHT') as string) || 0

  try {
    let merchandise = await prisma.merchandise.findUnique({ where: { reference } })

    if (!merchandise) {
      // ✨ Nouvel article : On crée l'identité du produit (sans le prix d'achat, il va dans le lot !)
      merchandise = await prisma.merchandise.create({
        data: { 
          reference, 
          name, 
          category, 
          alertThreshold, 
          sellingPriceHT
        }
      })
    } else {
      // 🔄 L'article existe : on met juste à jour son prix de revente public si besoin
      await prisma.merchandise.update({
        where: { reference },
        data: { sellingPriceHT }
      })
    }

    // 📦 Dans TOUS LES CAS, c'est UNIQUEMENT dans le lot qu'on enregistre le prix d'achat
    if (stockQuantity > 0) {
      await prisma.merchandiseLot.create({
        data: {
          merchandiseId: merchandise.id,
          quantityBought: stockQuantity,
          quantityLeft: stockQuantity,
          purchasePriceHT: purchasePriceHT,
          sellingPriceHT: sellingPriceHT
        }
      })
    }

    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e: any) {
    console.error(e)
    return { success: false, error: "Erreur Marchandise : " + (e.message || "Erreur technique") }
  }
}

export async function receiveMerchandiseStock(formData: FormData) {
  const reference = formData.get('reference') as string
  const quantity = parseInt(formData.get('stockQuantity') as string) || 0
  const purchasePriceHT = parseFloat(formData.get('purchasePriceHT') as string) || 0

  try {
    // 1. On trouve la marchandise maîtresse
    const merchandise = await prisma.merchandise.findUnique({ where: { reference } })
    if (!merchandise) return { success: false, error: "Crée d'abord l'article de base avant d'ajouter un lot" }

    // 2. On crée un nouveau lot d'achat lié
    await prisma.merchandiseLot.create({
      data: {
        merchandiseId: merchandise.id,
        quantityBought: quantity,
        quantityLeft: quantity,
        purchasePriceHT: purchasePriceHT
      }
    })

    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e) {
    return { success: false, error: "Erreur lors de la réception du lot" }
  }
}

// ==========================================
// 🗑️ SUPPRESSION DE PRODUIT DU CATALOGUE
// ==========================================
export async function deleteProduct(id: string, type: 'PF' | 'MA') {
  try {
    if (type === 'PF') {
      await prisma.finishedProduct.delete({ where: { id } })
    } else {
      await prisma.merchandise.delete({ where: { id } })
    }
    
    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur deleteProduct:", e)
    return { success: false, error: "Impossible de supprimer ce produit. " + (e.message || "") }
  }
}

// ==========================================
// ✏️ MODIFICATION DE PRODUIT (CATALOGUE)
// ==========================================
export async function updateProduct(formData: FormData) {
  const id = formData.get('id') as string
  const type = formData.get('type') as 'PF' | 'MA'
  const name = formData.get('name') as string
  const alertThreshold = parseInt(formData.get('alertThreshold') as string, 10) || 5
  const sellingPriceHT = parseFloat(formData.get('sellingPriceHT') as string) || 0
  const stockQuantity = parseInt(formData.get('stockQuantity') as string)
  
  try {
    if (type === 'PF') {
      const family = formData.get('family') as string
      const dimensions = formData.get('dimensions') as string
      
      await prisma.finishedProduct.update({
        where: { id },
        data: { name, family, dimensions, alertThreshold, sellingPriceHT }
      })
    } else {
      const category = formData.get('category') as string
      
      await prisma.merchandise.update({
        where: { id },
        data: { name, category, alertThreshold, sellingPriceHT }
      })
    }
    
    revalidatePath('/stock-Boutique')
    return { success: true }
  } catch (e: any) {
    console.error("Erreur updateProduct:", e)
    return { success: false, error: "Impossible de modifier ce produit. " + (e.message || "") }
  }
}

// 🆕 MODIFIER MANUELLEMENT LA QUANTITÉ D'UN LOT
export async function updateLotQuantity(lotId: string, type: 'PF' | 'MA', newQty: number) {
  try {
    if (type === 'PF') {
      await prisma.finishedProductLot.update({
        where: { id: lotId },
        data: { quantityLeft: newQty }
      })
    } else {
      await prisma.merchandiseLot.update({
        where: { id: lotId },
        data: { quantityLeft: newQty }
      })
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: "Erreur lors de la mise à jour du lot" }
  }
}