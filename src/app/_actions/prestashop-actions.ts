'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

// 🛠️ Le Traducteur : Calibré pour extraire les données du bloc de texte PrestaShop
function parsePrestashopProduct(productName: string) {
  let family = 'CUSTOM'
  const textLower = productName.toLowerCase()
  
  if (textLower.includes('housse') && textLower.includes('drap')) family = 'FITTED' 
  else if (textLower.includes('drap') && textLower.includes('plat')) family = 'FLAT' 
  else if (textLower.includes('couette')) family = 'ENVELOPE' 
  else if (textLower.includes('rond') || textLower.includes('bulle')) family = 'ROUND'
  else if (textLower.includes('traversin')) family = 'BOLSTER'

  let L = 200, l = 160, bonnet = 0, diametre = 210
  
  const widthLengthMatch = textLower.match(/largeur\s*:\s*(\d+).*?longueur\s*:\s*(\d+)/)
  const crossMatch = textLower.match(/(\d{2,4})\s*x\s*(\d{2,4})/)

  if (widthLengthMatch) {
    let val1 = parseInt(widthLengthMatch[1])
    let val2 = parseInt(widthLengthMatch[2])
    if (val1 >= 500) val1 = Math.round(val1 / 10)
    if (val2 >= 500) val2 = Math.round(val2 / 10)
    L = Math.max(val1, val2)
    l = Math.min(val1, val2)
  } else if (crossMatch) {
    let val1 = parseInt(crossMatch[1])
    let val2 = parseInt(crossMatch[2])
    if (val1 >= 500) val1 = Math.round(val1 / 10)
    if (val2 >= 500) val2 = Math.round(val2 / 10)
    L = Math.max(val1, val2)
    l = Math.min(val1, val2)
  }

  const bonnetMatch = textLower.match(/(?:bonnet|epaisseur|épaisseur).*?(\d{2})/)
  if (bonnetMatch) {
    bonnet = parseInt(bonnetMatch[1])
  }

  return {
    family,
    dims: { L, l, bonnet, diametre }
  }
}

// 🚀 L'aspirateur de commandes PrestaShop mis à jour
export async function syncPrestashopOrders() {
  const psUrl = process.env.PRESTASHOP_URL
  const psKey = process.env.PRESTASHOP_KEY

  if (!psUrl || !psKey) {
    return { success: false, error: "Configuration PrestaShop manquante dans le fichier .env" }
  }

  try {
    const defaultFabric = await prisma.fabric.findFirst()
    if (!defaultFabric) {
      return { success: false, error: "Désolé, vous devez créer au moins un tissu dans votre base de données avant de pouvoir synchroniser le web." }
    }

    const cleanUrl = psUrl.replace(/\/$/, '')
    const dateCharniere = '2026-06-01 00:00:00'
    const dateFuture = '2030-01-01 00:00:00'
    
    const apiUrl = `${cleanUrl}/api/orders?ws_key=${psKey}&display=full&output_format=JSON&filter[current_state]=[2]&filter[date_add]=[${dateCharniere},${dateFuture}]&sort=[id_DESC]`

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 0 } 
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ CRASH API PRESTASHOP (Statut ${response.status}) :`, errorText)
      throw new Error(`Erreur serveur PrestaShop (Code ${response.status})`)
    }

    const data = await response.json()
    const psOrders = data.orders || []

    let importedCount = 0

    for (const order of psOrders) {
      const orderRef = `WEB-#${order.id}`

      const existingQuote = await prisma.quote.findFirst({
        where: { reference: orderRef }
      })

      if (existingQuote) continue 

      const customerUrl = `${cleanUrl}/api/customers/${order.id_customer}?ws_key=${psKey}&output_format=JSON`
      const customerRes = await fetch(customerUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      const customerData = await customerRes.json()
      const psCustomer = customerData.customer

      let client = await prisma.client.findFirst({
        where: { email: psCustomer.email }
      })

      if (!client) {
        client = await prisma.client.create({
          data: {
            name: `${psCustomer.firstname} ${psCustomer.lastname}`,
            email: psCustomer.email,
            phone: '', 
            company: psCustomer.company || ''
          }
        })
      }

      const orderRows = order.associations?.order_rows || []
      const structuredProductsMetadata = orderRows.map((row: any) => {
        const parsed = parsePrestashopProduct(row.product_name)
        return {
          fabricId: defaultFabric.id,
          family: parsed.family,
          dims: parsed.dims
        }
      })

      const newQuote = await prisma.quote.create({
        data: {
          reference: orderRef,
          clientId: client.id,
          fabricId: defaultFabric.id,
          status: 'VALIDATED', 
          totalPrice: parseFloat(order.total_paid_tax_incl),
          isTTC: true,
          validatedAt: new Date(order.invoice_date.replace(' ', 'T')),
          products: structuredProductsMetadata
        }
      })

      for (const row of orderRows) {
        const quantityToCreate = parseInt(row.product_quantity) || 1

        for (let q = 0; q < quantityToCreate; q++) {
          await prisma.quoteItem.create({
            data: {
              quoteId: newQuote.id,
              fabricId: defaultFabric.id,
              customName: row.product_name.replace(/<br\s*\/?>/gi, ' '),
              quantityMeters: 0,
              sellingPrice: parseFloat(row.unit_price_tax_incl),
              prodTimeMinutes: 30,
              costPerMinute: 0, // 🎯 FIX : Propriété requise manquante enfin ajoutée !
              statusProduction: 'A_COUPER'
            }
          })
        }
      }

      importedCount++
    }

    revalidatePath('/atelier')
    revalidatePath('/orders')
    return { success: true, message: `${importedCount} commande(s) web importée(s) avec succès !` }

  } catch (error: any) {
    console.error("Erreur d'intégration de la payload PrestaShop :", error)
    return { success: false, error: error.message || "Échec de l'aspiration des données de vente." }
  }
}