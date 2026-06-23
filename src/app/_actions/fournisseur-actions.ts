'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getProcurementDashboard() {
  try {
    const fabrics = await prisma.fabric.findMany({
      where: { isArchived: false },
      orderBy: { reference: 'asc' }
    })

    const accessories = await prisma.accessory.findMany({
      where: { isArchived: false },
      orderBy: { reference: 'asc' }
    })

    const fabricAlerts = fabrics.filter(f => (f.stockMeters || 0) <= (f.alertThresholdMeters || 0))
    const accessoryAlerts = accessories.filter(a => (a.stockQuantity || 0) <= (a.alertThreshold || 3))

    return {
      alerts: { fabrics: fabricAlerts, accessories: accessoryAlerts }
    }
  } catch (error) {
    console.error("Erreur dashboard approvisionnement :", error)
    return { alerts: { fabrics: [], accessories: [] } }
  }
}

export async function getSupplierCatalog() {
  const items = await prisma.supplierCatalogItem.findMany({
    orderBy: [{ supplierName: 'asc' }, { reference: 'asc' }]
  })
  const suppliers = Array.from(new Set(items.map(i => i.supplierName)))
  return { suppliers, items }
}

// Interface pour recevoir les choix précis de Jade depuis l'interface graphique
interface SelectedItemInput {
  reference: string
  name: string
  color: string
  quantityWanted: number // Le métrage ou l'unité sur mesure saisi par Jade
  source: string // "ALERTE ATELIER" ou le nom du Fournisseur
}

// 2. GENERER LE DOCUMENT (Prise en compte des modifications et croisement des prix)
export async function generateProcurementDocument(selectedItems: SelectedItemInput[]) {
  try {
    // 1. On récupère tout le catalogue d'achat pour faire un croisement de prix (mapping) ultra-rapide
    const catalogItems = await prisma.supplierCatalogItem.findMany()
    
    // On crée un dictionnaire de prix indexé par [nomFournisseur_reference] ou juste [reference]
    const priceMap = new Map<string, number>()
    catalogItems.forEach(item => {
      priceMap.set(`${item.supplierName}_${item.reference}`.toUpperCase(), item.purchasePriceHT)
      // Fallback uniquement sur la référence si le fournisseur est "ALERTE ATELIER"
      priceMap.set(item.reference.toUpperCase(), item.purchasePriceHT)
    })

    // 2. On traite la liste des articles validés et ajustés par Jade
    const finalLines = selectedItems.map(item => {
      // On cherche si on a le prix de cette référence dans le dictionnaire
      const lookupKeyWithSupplier = `${item.source}_${item.reference}`.toUpperCase()
      const lookupKeyRefOnly = item.reference.toUpperCase()
      
      const matchedPrice = priceMap.get(lookupKeyWithSupplier) || priceMap.get(lookupKeyRefOnly) || 0
      const totalLineHT = matchedPrice * item.quantityWanted

      return {
        source: item.source,
        ref: item.reference,
        name: item.name,
        color: item.color,
        quantityOrdered: item.quantityWanted,
        unitPriceHT: matchedPrice > 0 ? `${matchedPrice.toFixed(2)} €` : "À préciser",
        totalHT: totalLineHT > 0 ? `${totalLineHT.toFixed(2)} €` : "-"
      }
    })

    return {
      referenceOrder: `REASSORT-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('fr-FR'),
      lines: finalLines
    }
  } catch (error) {
    console.error("Erreur lors de la génération du document de réassort :", error)
    throw new Error("Impossible de générer le document de réassort")
  }
}

/**
 * 🎨 Met à jour les informations (tarifs, couleurs) d'une ligne du catalogue grossiste
 */
export async function updateSupplierCatalogItem(
  id: string, 
  data: { purchasePriceHT?: number; color?: string; ngColor?: string }
) {
  try {
    await prisma.supplierCatalogItem.update({
      where: { id },
      data: {
        purchasePriceHT: data.purchasePriceHT,
        color: data.color,
        ngColor: data.ngColor
      }
    })
    
    // On demande à Next.js de rafraîchir le cache pour la page d'approvisionnement
    revalidatePath('/suppliers')
    return { success: true }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'article:", error)
    return { success: false, error }
  }
}