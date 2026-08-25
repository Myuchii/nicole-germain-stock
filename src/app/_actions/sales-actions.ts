'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

export async function recordSale(formData: FormData) {
  const cartJson = formData.get('cart') as string
  const paymentMethod = formData.get('paymentMethod') as string
  const applyVAT = formData.get('applyVAT') === 'true' 
  const discountPercent = parseFloat(formData.get('discountPercent') as string) || 0 // 🆕 Récupère la remise

  if (!cartJson || !paymentMethod) return { success: false, error: "Données de vente manquantes" }

  try {
    const cartItems: { reference: string; quantity: number; type: 'PRODUIT_FINI' | 'MARCHANDISE' }[] = JSON.parse(cartJson)
    if (cartItems.length === 0) return { success: false, error: "Le panier est vide" }

    const ticketId = `TICK-${Date.now().toString().slice(-6)}`
    const taxRate = applyVAT ? 20.0 : 0
    const multiplier = 1 + (taxRate / 100)

    for (const cartItem of cartItems) {
      const { reference, quantity, type } = cartItem
      let itemName = ""
      let totalRevenueBaseHT = 0 // Le prix AVANT remise

      // ==========================================
      // CAS 1 : FLUX ② PRODUITS FINIS
      // ==========================================
      if (type === 'PRODUIT_FINI') {
        const item = await prisma.finishedProduct.findUnique({ where: { reference }, include: { lots: { orderBy: { createdAt: 'asc' } } }})
        if (!item) throw new Error(`Article ${reference} introuvable`)

        const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
        if (totalInStock < quantity) throw new Error(`Stock insuffisant pour ${reference}`)

        let quantityToDeduct = quantity

        for (const lot of item.lots) {
          if (quantityToDeduct <= 0) break
          if (lot.quantityLeft > 0) {
            const take = Math.min(quantityToDeduct, lot.quantityLeft)
            const priceToUse = lot.sellingPriceHT && lot.sellingPriceHT > 0 ? lot.sellingPriceHT : item.sellingPriceHT
            totalRevenueBaseHT += take * priceToUse
            quantityToDeduct -= take
            await prisma.finishedProductLot.update({ where: { id: lot.id }, data: { quantityLeft: lot.quantityLeft - take } })
          }
        }
        itemName = item.name
      } 
      // ==========================================
      // CAS 2 : FLUX ③ MARCHANDISES
      // ==========================================
      else {
        const item = await prisma.merchandise.findUnique({ where: { reference }, include: { lots: { orderBy: { createdAt: 'asc' } } }})
        if (!item) throw new Error(`Article ${reference} introuvable`)

        const totalInStock = item.lots.reduce((sum, l) => sum + l.quantityLeft, 0)
        if (totalInStock < quantity) throw new Error(`Stock insuffisant pour ${reference}`)

        let quantityToDeduct = quantity

        for (const lot of item.lots) {
          if (quantityToDeduct <= 0) break
          if (lot.quantityLeft > 0) {
            const take = Math.min(quantityToDeduct, lot.quantityLeft)
            const priceToUse = lot.sellingPriceHT && lot.sellingPriceHT > 0 ? lot.sellingPriceHT : item.sellingPriceHT
            totalRevenueBaseHT += take * priceToUse 
            quantityToDeduct -= take
            await prisma.merchandiseLot.update({ where: { id: lot.id }, data: { quantityLeft: lot.quantityLeft - take } })
          }
        }
        itemName = item.name
      }

      // 🆕 CALCULS COMPTABLES 
      const unitPriceHT = quantity > 0 ? totalRevenueBaseHT / quantity : 0
      const finalTotalPriceHT = totalRevenueBaseHT * (1 - discountPercent / 100) // HT Remisé
      const finalTotalPriceTTC = finalTotalPriceHT * multiplier                  // TTC Remisé

      await prisma.saleLog.create({
        data: {
          referenceItem: reference,
          name: itemName,
          type: type,
          quantitySold: quantity,
          
          unitPriceHT: unitPriceHT,             // 🆕 Prix unitaire de base sauvegardé
          discountPercent: discountPercent,     // 🆕 Remise sauvegardée
          
          totalPriceHT: finalTotalPriceHT,
          totalPriceTTC: finalTotalPriceTTC, 
          taxRate: taxRate,
          isTaxExempt: !applyVAT,
          isTTC: applyVAT,
          paymentMethod: paymentMethod,
          ticketId: ticketId
        }
      })
    }

    revalidatePath('/', 'layout') 
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message || "Erreur technique lors de la vente" }
  }
}

// ==========================================
// LECTURE DU JOURNAL (INCHANGÉ)
// ==========================================
export async function getSalesJournal(type: 'PRODUIT_FINI' | 'MARCHANDISE') {
  return await prisma.saleLog.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' }
  })
}

interface AccountingFilter {
  startDate: string
  endDate: string
}

// 📑 1. JOURNAL DES VENTES (JDV) — GROUPÉ PAR TICKET + INFOS CLIENTS
export async function getBoutiqueJDV(filters: AccountingFilter) {
  const start = new Date(filters.startDate)
  const end = new Date(filters.endDate)
  end.setHours(23, 59, 59, 999)

  const logs = await prisma.saleLog.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' }
  })

  // Regroupement par ID de ticket
  const ticketsMap: Record<string, any> = {}

  logs.forEach(log => {
    const key = log.ticketId || `ISOLATED-${log.id}`
    
    if (!ticketsMap[key]) {
      ticketsMap[key] = {
        date: log.createdAt.toLocaleDateString('fr-FR'),
        ticketId: key,
        typeVente: log.type === 'PRODUIT_FINI' ? 'CONFECTION' : 'NÉGOCE',
        motifRemboursement: "-", // Placeholer (À lier si tu ajoutes un flux de retour)
        nbrArticles: 0,
        caHT20: 0,
        tva20: 0,
        caTTC20: 0,
        cb: 0,
        especes: 0,
        cheque: 0,
        remboursementCB: 0,
        remboursementEspeces: 0,
        remboursementCheque: 0,
        totalRemboursement: 0,
        totalRemises: 0,
        // Vos champs CRM Client (Défaut vide pour l'instant, personnalisable via PrestaShop/Fiches)
        clientPrenom: "",
        clientNom: "",
        clientEntreprise: "",
        clientEmail: "",
        clientTelephone: "",
        clientCodePostal: "",
        clientNote: ""
      }
    }

    const t = ticketsMap[key]
    t.nbrArticles += log.quantitySold

    // Calculs financiers selon s'il y a de la TVA (20%) ou non
    if (log.taxRate === 20) {
      t.caHT20 += log.totalPriceHT
      const itemTTC = log.totalPriceTTC || log.totalPriceHT * 1.20
      t.caTTC20 += itemTTC
      t.tva20 += (itemTTC - log.totalPriceHT)
    } else {
      // Si exonéré (PRO), on l'ajoute au HT brut global
      t.caHT20 += log.totalPriceHT
      t.caTTC20 += log.totalPriceHT
    }

    // Ventilation des modes d'encaissement sur le ticket
    const currentPriceTTC = log.totalPriceTTC || log.totalPriceHT
    if (log.paymentMethod === 'CB') t.cb += currentPriceTTC
    if (log.paymentMethod === 'ESPECES') t.especes += currentPriceTTC
    if (log.paymentMethod === 'CHEQUE') t.cheque += currentPriceTTC

    // Estimation de la remise accordée en euros sur la ligne
    if (log.discountPercent && log.discountPercent > 0) {
      const originalHT = log.totalPriceHT / (1 - log.discountPercent / 100)
      t.totalRemises += (originalHT - log.totalPriceHT)
    }
  })

  return Object.values(ticketsMap)
}

// 🪙 2. JOURNAL DE CAISSE (JDC) — CLÔTURE QUOTIDIENNE (Z DE CAISSE)
export async function getBoutiqueJDC(filters: AccountingFilter) {
  const start = new Date(filters.startDate)
  const end = new Date(filters.endDate)
  end.setHours(23, 59, 59, 999)

  const logs = await prisma.saleLog.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'asc' }
  })

  // Regroupement par Journée Calendrier
  const daysMap: Record<string, any> = {}

  logs.forEach(log => {
    const dayKey = log.createdAt.toISOString().split('T')[0] // '2026-06-11'
    const logTime = log.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const currentTicketId = log.ticketId || 'SANS_TICKET'

    if (!daysMap[dayKey]) {
      daysMap[dayKey] = {
        jourOuverture: log.createdAt.toLocaleDateString('fr-FR'),
        heureOuverture: logTime, // Premier log rencontré
        heureFermeture: logTime, // Mis à jour à chaque itération
        premierTicket: currentTicketId,
        dernierTicket: currentTicketId,
        nbrVentes: new Set().add(currentTicketId), // Compte les tickets uniques
        nbrRemboursements: 0,
        caHT20: 0,
        tva20: 0,
        caTTC20: 0,
        encaissementCB: 0,
        encaissementEspeces: 0,
        encaissementCheque: 0,
        totalPaiement: 0,
        remboursementCB: 0,
        remboursementEspeces: 0,
        remboursementCheque: 0,
        totalRemboursement: 0,
        ttcRemise: 0,
        // Variables du fond de caisse physique
        especesOuverture: 100.00, // Fond de caisse fixe par défaut (ajustable)
        sorties: 0,
        nbrEntreesSorties: 0,
        detailEntreesSorties: "-"
      }
    }

    const d = daysMap[dayKey]
    
    // Ajustement de l'amplitude horaire et des références de tickets
    d.heureFermeture = logTime
    d.dernierTicket = currentTicketId
    d.nbrVentes.add(currentTicketId)

    const itemTTC = log.totalPriceTTC || log.totalPriceHT

    if (log.taxRate === 20) {
      d.caHT20 += log.totalPriceHT
      d.caTTC20 += itemTTC
      d.tva20 += (itemTTC - log.totalPriceHT)
    } else {
      d.caHT20 += log.totalPriceHT
      d.caTTC20 += log.totalPriceHT
    }

    // Accumulation des encaissements par méthode
    if (log.paymentMethod === 'CB') d.encaissementCB += itemTTC
    if (log.paymentMethod === 'ESPECES') d.encaissementEspeces += itemTTC
    if (log.paymentMethod === 'CHEQUE') d.encaissementCheque += itemTTC

    if (log.discountPercent && log.discountPercent > 0) {
      d.ttcRemise += itemTTC // Cumul de la valeur des paniers qui ont bénéficié d'un rabais
    }
  })

  // Finalisation des calculs mathématiques pour chaque journée
  return Object.values(daysMap).map((d: any) => {
    const totalVentesCount = d.nbrVentes.size
    d.nbrVentes = totalVentesCount // Convertit le Set en chiffre propre
    d.totalPaiement = d.encaissementCB + d.encaissementEspeces + d.encaissementCheque
    
    // Calcul mathématique du tiroir-caisse attendu en fin de journée
    d.especesAttendues = d.especesOuverture + d.encaissementEspeces - d.sorties
    d.especesConstatees = d.especesAttendues // Par défaut synchrone, ajuster si écart
    d.difference = d.especesConstatees - d.especesAttendues

    return d
  })
}