'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from 'next/cache'

// 🛠️ Helper universel pour extraire le texte des champs multilingues capricieux de PrestaShop
function getPsValue(field: any): string {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (Array.isArray(field)) {
    return field[0]?.value || field[0]?._ || ''
  }
  return ''
}

// 🛠️ Le Traducteur : Unifié pour les lits articulés ET les draps ronds
function parsePrestashopProduct(productName: string) {
  let family = 'CUSTOM'
  const textLower = productName.toLowerCase()
  
  if (textLower.includes('housse') && textLower.includes('drap')) family = 'FITTED' 
  else if (textLower.includes('drap') && textLower.includes('plat')) family = 'FLAT' 
  else if (textLower.includes('couette')) family = 'ENVELOPE' 
  else if (textLower.includes('rond') || textLower.includes('bulle')) family = 'ROUND'
  else if (textLower.includes('traversin')) family = 'BOLSTER'

  let L = 200, l = 160, bonnet = 0, diametre = 210
  
// 1️⃣ CAS PARTICULIER : Produit Rond (Vosgia, NG, etc.)
  if (family === 'ROUND') {
    // Cette regex attrape : "diamètre : 220", "diametre:215", "diam. 210", "diam: 220"
    const diametreMatch = textLower.match(/(?:diamètre|diametre|diam)\s*[:.]?\s*(\d{2,3})/)
    if (diametreMatch) {
      diametre = parseInt(diametreMatch[1], 10)
    }
    // Sécurité : on aligne L et l sur le diamètre pour éviter les clés vides ou cassées ailleurs
    L = diametre
    l = diametre
  } 
  // 2️⃣ CAS GÉNÉRAL : Rectangulaire (Drap housse, plat, etc.)
  else {
    // 🎯 On nettoie le "2x" ou "2 x" initial des lits articulés pour ne pas fausser les dimensions
    const cleanTextForDims = textLower.replace(/\b2\s*x\s*(?=\d{2,3}\s*x)/g, '')

    const widthLengthMatch = cleanTextForDims.match(/largeur\s*:\s*(\d+).*?longueur\s*:\s*(\d+)/)
    const crossMatch = cleanTextForDims.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/)

    if (widthLengthMatch) {
      let val1 = parseInt(widthLengthMatch[1], 10)
      let val2 = parseInt(widthLengthMatch[2], 10)
      if (val1 >= 500) val1 = Math.round(val1 / 10)
      if (val2 >= 500) val2 = Math.round(val2 / 10)
      L = Math.max(val1, val2)
      l = Math.min(val1, val2)
    } else if (crossMatch) {
      let val1 = parseInt(crossMatch[1], 10)
      let val2 = parseInt(crossMatch[2], 10)
      if (val1 >= 500) val1 = Math.round(val1 / 10)
      if (val2 >= 500) val2 = Math.round(val2 / 10)
      L = Math.max(val1, val2)
      l = Math.min(val1, val2)
    }
  }

  // 3️⃣ Extraction globale du bonnet (commun à toutes les familles si spécifié)
  const bonnetMatch = textLower.match(/(?:bonnet|epaisseur|épaisseur)\s*:\s*.*?(\d{2})/i) || textLower.match(/(?:de\s+)(\d{2})\s+à/)
  if (bonnetMatch) {
    bonnet = parseInt(bonnetMatch[1], 10)
  }

  return {
    family,
    dims: { L, l, bonnet, diametre }
  }
}

// 🚀 L'aspirateur de commandes PrestaShop (Version Résilience Totale + Moteur Bicolore Avancé)
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
    const apiUrl = `${cleanUrl}/api/orders?ws_key=${psKey}&display=full&output_format=JSON&sort=[id_DESC]&limit=200`

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      next: { revalidate: 0 } 
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error(`❌ CRASH API PRESTASHOP (Statut ${response.status}) :`, responseText)
      throw new Error(`Erreur serveur PrestaShop (Code ${response.status})`)
    }

    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      throw new Error("PrestaShop a renvoyé une page d'erreur au format HTML au lieu du JSON attendu.")
    }

    const data = JSON.parse(responseText)
    const rawOrders = data.orders || []

    const targetStatuses = ['1','2', '3', '4', '5', '10']
    const psOrders = rawOrders.filter((order: any) => targetStatuses.includes(String(order.current_state)))

    let importedCount = 0

    for (const order of psOrders) {
      try {
        const orderRef = `VOS-#${order.id}`

        const existingQuote = await prisma.quote.findFirst({
          where: { reference: orderRef }
        })

        if (existingQuote) continue 

        // 1️⃣ Récupération du Client
        const customerUrl = `${cleanUrl}/api/customers/${order.id_customer}?ws_key=${psKey}&output_format=JSON`
        const customerRes = await fetch(customerUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        
        let psCustomer = { 
          firstname: 'Client', 
          lastname: `Inconnu (#${order.id_customer})`, 
          email: `inconnu-${order.id_customer}@vosgia.fr`, 
          company: '' 
        }

        if (customerRes.ok) {
          const customerData = await customerRes.json()
          if (customerData.customer) {
            psCustomer = customerData.customer
          }
        }

        const clientEmail = psCustomer.email?.trim() || `missing-${order.id_customer}-${order.id}@vosgia.fr`

        // 2️⃣ Extraction de l'adresse
        let clientPhone = 'Non renseigné'
        let clientStreet = ''
        let clientZip = ''
        let clientCity = ''

        const addressUrl = `${cleanUrl}/api/addresses/${order.id_address_delivery}?ws_key=${psKey}&output_format=JSON`
        const addressRes = await fetch(addressUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        
        if (addressRes.ok) {
          const addressData = await addressRes.json()
          const addr = addressData.address
          if (addr) {
            clientPhone = addr.phone_mobile || addr.phone || 'Non renseigné'
            clientStreet = `${addr.address1} ${addr.address2 || ''}`.trim()
            clientZip = addr.postcode || ''
            clientCity = addr.city || ''
          }
        }

        // 3️⃣ Enregistrement / Update du Client
        let client = await prisma.client.findFirst({
          where: { email: clientEmail }
        })

        if (!client) {
          client = await prisma.client.create({
            data: {
              name: `${psCustomer.firstname} ${psCustomer.lastname}`,
              email: clientEmail,
              phone: clientPhone,
              company: psCustomer.company || '',
              address: clientStreet,
              zipCode: clientZip,
              city: clientCity
            }
          })
        } else {
          client = await prisma.client.update({
            where: { id: client.id },
            data: {
              phone: !client.phone || client.phone === 'Non renseigné' ? clientPhone : client.phone,
              address: !client.address ? clientStreet : client.address,
              zipCode: !client.zipCode ? clientZip : client.zipCode,
              city: !client.city ? clientCity : client.city
            }
          })
        }

        const orderRows = order.associations?.order_rows || []
        const customizations = order.associations?.customizations || []
        
        const totalItemsQuantity = orderRows.reduce((acc: number, row: any) => acc + (parseInt(row.product_quantity) || 1), 0)

        // 4️⃣ Analyse des lignes pour le JSON global de la commande
        const structuredProductsMetadata = []
        for (const row of orderRows) {
          const parsed = parsePrestashopProduct(row.product_name)
          const textLower = row.product_name.toLowerCase()
          let matchedFabricId = defaultFabric.id

          let matiere = "Coton"
          if (textLower.includes("percale")) matiere = "Percale de coton"
          else if (textLower.includes("satin")) matiere = "Satin de coton"
          else if (textLower.includes("lin")) matiere = "Lin lavé"
          else if (textLower.includes("matelas")) matiere = "Molleton"

          const dessusMatch = textLower.match(/couleurs\s+dessus\s*:\s*([a-zéèàôûâ\s-]+?)(?=\s+couleurs|\s+dimensions|\s+configurator|$)/)
          const dessousMatch = textLower.match(/couleurs\s+dessous\s*:\s*([a-zéèàôûâ\s-]+?)(?=\s+couleurs|\s+dimensions|\s+configurator|$)/)
          const standardMatch = textLower.match(/couleurs\s*:\s*([a-zéèàôûâ\s-]+?)(?=\s+dimensions|\s+configurator|$)/)

          let foundFabric = null

          if (dessusMatch) {
            const targetName = `${matiere} - ${dessusMatch[1].trim()}`
            foundFabric = await prisma.fabric.findFirst({ where: { name: { equals: targetName, mode: 'insensitive' } } })
          }
          if (!foundFabric && dessousMatch) {
            const targetName = `${matiere} - ${dessousMatch[1].trim()}`
            foundFabric = await prisma.fabric.findFirst({ where: { name: { equals: targetName, mode: 'insensitive' } } })
          }
          if (!foundFabric && standardMatch) {
            const targetName = `${matiere} - ${standardMatch[1].trim()}`
            foundFabric = await prisma.fabric.findFirst({ where: { name: { equals: targetName, mode: 'insensitive' } } })
          }

          if (foundFabric) {
            matchedFabricId = foundFabric.id
          } else {
            const fallbackFabric = await prisma.fabric.findFirst({ where: { name: { equals: `${matiere} - Blanc`, mode: 'insensitive' } } })
            matchedFabricId = fallbackFabric ? fallbackFabric.id : defaultFabric.id
          }

          structuredProductsMetadata.push({
            fabricId: matchedFabricId,
            family: parsed.family,
            dims: parsed.dims
          })
        }

        // Fix montant global
        const safeTotalPrice = parseFloat(order.total_products_wt) || parseFloat(order.total_paid_tax_incl) || 0
        const orderDateStr = order.date_add ? order.date_add.replace(' ', 'T') : new Date().toISOString()
        // 🎯 On attrape le nom du module de paiement (ex: "Stripe", "bankwire")
const psPaymentRaw = order.payment || 'Non renseigné'
        
        // 5️⃣ Création de la commande (Quote)
        const newQuote = await prisma.quote.create({
          data: {
            reference: orderRef,
            clientId: client.id,
            fabricId: defaultFabric.id,
            status: 'VALIDATED', 
            totalPrice: safeTotalPrice,
            quantity: totalItemsQuantity, 
            isTTC: true,
            validatedAt: new Date(orderDateStr),
            products: structuredProductsMetadata,
            paymentMethod: psPaymentRaw
          }
        })

        // 6️⃣ Génération des fiches de production individuelles (QuoteItem)
        for (const row of orderRows) {
          const quantityToCreate = parseInt(row.product_quantity) || 1
          const textLower = row.product_name.toLowerCase()
          let matchedFabricId = defaultFabric.id

          let matiere = "Coton"
          if (textLower.includes("percale")) matiere = "Percale de coton"
          else if (textLower.includes("satin")) matiere = "Satin de coton"
          else if (textLower.includes("lin")) matiere = "Lin lavé"
          else if (textLower.includes("matelas")) matiere = "Molleton"

          // Moteur de capture intelligent multi-scénarios
          const dessusMatch = textLower.match(/couleurs\s+dessus\s*:\s*([a-zéèàôûâ\s-]+?)(?=\s+couleurs|\s+dimensions|\s+configurator|$)/)
          const dessousMatch = textLower.match(/couleurs\s+dessous\s*:\s*([a-zéèàôûâ\s-]+?)(?=\s+couleurs|\s+dimensions|\s+configurator|$)/)
          const standardMatch = textLower.match(/couleurs\s*:\s*([a-zéèàôûâ\s-]+?)(?=\s+dimensions|\s+configurator|$)/)

          let foundFabric = null

          // La couleur principale de coupe (Face A) sera TOUJOURS le dessus s'il est spécifié
          if (dessusMatch) {
            const targetName = `${matiere} - ${dessusMatch[1].trim()}`
            foundFabric = await prisma.fabric.findFirst({ where: { name: { equals: targetName, mode: 'insensitive' } } })
          }
          if (!foundFabric && dessousMatch) {
            const targetName = `${matiere} - ${dessousMatch[1].trim()}`
            foundFabric = await prisma.fabric.findFirst({ where: { name: { equals: targetName, mode: 'insensitive' } } })
          }
          if (!foundFabric && standardMatch) {
            const targetName = `${matiere} - ${standardMatch[1].trim()}`
            foundFabric = await prisma.fabric.findFirst({ where: { name: { equals: targetName, mode: 'insensitive' } } })
          }

          if (foundFabric) {
            matchedFabricId = foundFabric.id
          } else {
            const fallbackFabric = await prisma.fabric.findFirst({ where: { name: { equals: `${matiere} - Blanc`, mode: 'insensitive' } } })
            matchedFabricId = fallbackFabric ? fallbackFabric.id : defaultFabric.id
          }

          // 🎯 ENGIN DE DÉTECTION DU DEUXIÈME TISSU (Face B de la housse bicolore)
          let bicolorAlerteNote = ""
          if (dessusMatch && dessousMatch) {
            const secondColorName = dessousMatch[1].trim()
            const targetSecondName = `${matiere} - ${secondColorName}`
            
            // On cherche le deuxième rouleau en DB pour Nicole
            const foundSecondFabric = await prisma.fabric.findFirst({
              where: { name: { equals: targetSecondName, mode: 'insensitive' } }
            })

            if (foundSecondFabric) {
              bicolorAlerteNote = `⚠️ MODÈLE BICOLORE ➡️ Envers à couper : [${foundSecondFabric.reference}] ${foundSecondFabric.name}`
            } else {
              bicolorAlerteNote = `⚠️ MODÈLE BICOLORE ➡️ Envers à couper : ${secondColorName} (Alerte : tissu absent du stock local)`
            }
          }

          // TRADUCTION DU TYPE EN CLAIR
          const parsedForLoop = parsePrestashopProduct(row.product_name)
          const familyLabels: Record<string, string> = {
            FITTED: 'Drap housse',
            FLAT: 'Drap plat',
            ENVELOPE: 'Housse de couette',
            ROUND: 'Drap rond',
            BOLSTER: 'Traversin',
            CUSTOM: 'Sur-mesure'
          }
          const productTypeLabel = familyLabels[parsedForLoop.family] || 'Article'

          // EXTRACTEUR DE SPÉCIFICITÉS
          let extraSpecs: string[] = []
          for (const cust of customizations) {
            if (String(cust.id_product) === String(row.product_id)) {
              const fields = cust.customization_fields || []
              for (const f of fields) {
                const textVal = getPsValue(f.value).trim()
                if (textVal && textVal !== '') {
                  extraSpecs.push(textVal)
                }
              }
            }
          }

          const refPrefix = row.product_reference ? `[${row.product_reference}] ` : ''
          let fullCustomName = `${productTypeLabel} — ${refPrefix}${row.product_name.replace(/<br\s*\/?>/gi, ' ')}`
          
          // On injecte l'alerte du deuxième rouleau bicolore de manière très visible
          if (bicolorAlerteNote !== "") {
            fullCustomName += ` (${bicolorAlerteNote})`
          }

          if (extraSpecs.length > 0) {
            fullCustomName += ` (Spécificités : ${extraSpecs.join(' | ')})`
          }

// ... (juste au dessus de la boucle des items)
          const safeUnitPrice = parseFloat(row.unit_price_tax_incl) 
            || parseFloat(row.unit_price_tax_excl) * 1.2 
            || parseFloat(row.product_price) * 1.2 
            || 0

          for (let q = 0; q < quantityToCreate; q++) {
            await prisma.quoteItem.create({
              data: {
                quoteId: newQuote.id,
                fabricId: matchedFabricId, 
                customName: fullCustomName, 
                quantityMeters: 0, 
                quantityUnits: 1,  
                sellingPrice: safeUnitPrice, 
                prodTimeMinutes: 30,
                costPerMinute: 0, 
                statusProduction: 'A_COUPER',
                // 🎯 LE FIX ICI : On force la fiche atelier à prendre la vraie date de la commande !
                createdAt: new Date(orderDateStr) 
              }
            })
          }
        }

        importedCount++

      } catch (orderError: any) {
        console.warn(`⚠️ Commande WEB-#${order.id} ignorée pour l'instant :`, orderError.message || orderError)
        continue
      }
    }

    revalidatePath('/atelier')
    revalidatePath('/orders')
    return { success: true, message: `${importedCount} commande(s) web importée(s) avec succès !` }

  } catch (error: any) {
    console.error("Erreur générale de l'aspiration :", error)
    return { success: false, error: error.message || "Échec global." }
  }
}

// 🌪️ L'ASPIRATEUR DE TISSUS TECHNIQUE (Matière + Couleur)
export async function syncAllPrestashopFabrics() {
  const psUrl = process.env.PRESTASHOP_URL
  const psKey = process.env.PRESTASHOP_KEY

  if (!psUrl || !psKey) {
    return { success: false, error: "Configuration PrestaShop manquante." }
  }

  try {
    const cleanUrl = psUrl.replace(/\/$/, '')

    // 1️⃣ Charger le dictionnaire complet des attributs de couleur
    const valuesUrl = `${cleanUrl}/api/product_option_values?ws_key=${psKey}&display=full&output_format=JSON`
    const valuesRes = await fetch(valuesUrl, { next: { revalidate: 0 } })
    
    if (!valuesRes.ok) {
      const errorText = await valuesRes.text()
      console.error(`❌ CRASH DICTIONNAIRE OPTIONS (Statut ${valuesRes.status}) :`, errorText)
      throw new Error(`Impossible de charger le dictionnaire d'options (Code ${valuesRes.status})`)
    }
    
    const valuesData = await valuesRes.json()
    const allOptions = valuesData.product_option_values || []

    const colorDictionary: Record<string, string> = {}
    allOptions.forEach((opt: any) => {
      const nameText = getPsValue(opt.name)
      if (nameText && !nameText.includes('X') && !nameText.includes('x')) {
        colorDictionary[opt.id] = nameText.trim()
      }
    })

    // 2️⃣ Aspirer les produits du catalogue
    const productsUrl = `${cleanUrl}/api/products?ws_key=${psKey}&display=full&output_format=JSON&limit=600`
    const productsRes = await fetch(productsUrl, { next: { revalidate: 0 } })
    
    if (!productsRes.ok) {
      const errorText = await productsRes.text()
      console.error(`❌ CRASH API CATALOGUE PRODUITS (Statut ${productsRes.status}) :`, errorText)
      throw new Error(`Erreur serveur catalogue PrestaShop (Code ${productsRes.status})`)
    }
    
    const productsData = await productsRes.json()
    const psProducts = productsData.products || []

    let createdCount = 0

    // 3️⃣ Analyse croisée pour générer le magasin de tissus de Nicole
    for (const prod of psProducts) {
      const rawName = getPsValue(prod.name)
      if (!rawName) continue
      
      let matiere = "Coton"
      if (rawName.toLowerCase().includes("percale")) matiere = "Percale de coton"
      else if (rawName.toLowerCase().includes("satin")) matiere = "Satin de coton"
      else if (rawName.toLowerCase().includes("lin")) matiere = "Lin lavé"
      else if (rawName.toLowerCase().includes("matelas")) matiere = "Molleton"

      const optionLinks = prod.associations?.product_option_values || []
      
      for (const link of optionLinks) {
        const colorName = colorDictionary[link.id]

        if (colorName) {
          const textMatiere = matiere
          const textCouleur = colorName
          
          const cleanMatiereRef = textMatiere.substring(0, 3).toUpperCase()
          const cleanColorRef = textCouleur.substring(0, 4).toUpperCase().replace(/\s+/g, '-')
          const uniqueRef = `${cleanMatiereRef}-${cleanColorRef}`

          const existingFabric = await prisma.fabric.findFirst({
            where: { name: `${textMatiere} - ${textCouleur}` }
          })

          if (!existingFabric) {
            await prisma.fabric.create({
              data: {
                reference: uniqueRef,
                name: `${textMatiere} - ${textCouleur}`,
                color: textCouleur,
                unit: 'METER',
                width: textMatiere.includes("percale") ? 280 : 240, 
                pricePerMeter: textMatiere.includes("percale") ? 8.50 : 5.20, 
                stockMeters: 0,
                alertThresholdMeters: 20
              }
            })
            createdCount++
          }
        }
      }
    }

    revalidatePath('/fabric')
    return { success: true, message: `✨ Structure textile synchronisée ! ${createdCount} fiches tissus techniques [Matière + Couleur] créées.` }

  } catch (error: any) {
    console.error(error)
    return { success: false, error: error.message }
  }
}