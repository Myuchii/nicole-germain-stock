'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createPartnerOrder(formData: FormData) {
  try {
    // 1️⃣ RÉCUPÉRATION DES DONNÉES DU FORMULAIRE
    const clientName = formData.get('clientName') as string
    const clientPhone = formData.get('clientPhone') as string || null
    const clientEmail = formData.get('clientEmail') as string || null
    const clientAddress = formData.get('clientAddress') as string || null
    const clientZipCode = formData.get('clientZipCode') as string || null
    const clientCity = formData.get('clientCity') as string || null
    
    const fabricId = formData.get('fabricId') as string
    const formCustomName = formData.get('customName') as string || null
    const modelId = formData.get('modelId') as string
    const quantity = parseInt(formData.get('quantity') as string, 10) || 1
    const bonnet = parseInt(formData.get('bonnet') as string, 10) || 0
    const blueprintUrl = formData.get('blueprintUrl') as string

    // Extraction des côtes géométriques complexes d'usine[cite: 1]
    const coteA = formData.get('coteA') ? parseFloat(formData.get('coteA') as string) : null
    const coteB = formData.get('coteB') ? parseFloat(formData.get('coteB') as string) : null
    const coteC = formData.get('coteC') ? parseFloat(formData.get('coteC') as string) : null
    const coteD = formData.get('coteD') ? parseFloat(formData.get('coteD') as string) : null

    if (!clientName || !blueprintUrl || !fabricId) {
      return { success: false, error: "Le nom du client, le tissu et le schéma technique sont obligatoires." }
    }

    // 2️⃣ RÉCUPÉRATION DU COMPTE PARTENAIRE UNIQUE (Matelas Camping-car)
    const partner = await prisma.partner.upsert({
      where: { email: 'contact@matelas-camping-car.com' },
      update: {},
      create: {
        name: 'Matelas Camping-car',
        email: 'contact@matelas-camping-car.com',
        phone: '02.40.24.69.93'
      }
    })

    // 3️⃣ GESTION OU CRÉATION DU CLIENT FINAL AVEC SON ADRESSE COMPLÈTE[cite: 1]
    let client = await prisma.client.findFirst({
      where: { name: clientName, phone: clientPhone }
    })

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: clientName,
          phone: clientPhone,
          email: clientEmail,
          address: clientAddress,   // Stockage de la rue[cite: 1]
          zipCode: clientZipCode,   // Stockage du CP[cite: 1]
          city: clientCity,         // Stockage de la ville[cite: 1]
          company: 'Client Final Matelas Camping-car'
        }
      })
    } else {
      // Optionnel : On met à jour l'adresse si elle a changé ou était absente
      await prisma.client.update({
        where: { id: client.id },
        data: {
          address: clientAddress,
          zipCode: clientZipCode,
          city: clientCity
        }
      })
    }

    // 4️⃣ CALCULS FINANCIERS ET TEMPS DE MAIN D'ŒUVRE THÉORIQUE
    const settings = await atelierSettings()
    
    // Temps standard de base pour un gabarit d'usine complexe : 30 minutes[cite: 1]
    const baseLaborTime = 30 
    const laborCost = baseLaborTime * settings.laborCostPerMin
    const baseHT = laborCost * settings.marginRate
    const finalSellingPrice = baseHT * quantity

    // Génération d'une référence propre au format BC-7681
    const randomRef = `BC-${Math.floor(1000 + Math.random() * 9000)}`

    // Détermination de l'intitulé final de la pièce
    const finalItemName = formCustomName 
      ? formCustomName 
      : `Pièce Camping-car [Modèle ${modelId}]`

    // 5️⃣ CRÉATION DE LA COMMANDE ET DE L'ARTICLE DE PRODUCTION
    await prisma.quote.create({
      data: {
        reference: randomRef,
        status: 'VALIDATED', // Validé d'office pour passer sur la tablette de Jade
        totalPrice: finalSellingPrice,
        quantity: quantity,
        isTaxExempt: true,   // Exonération Pro
        paymentMethod: 'VIREMENT',
        clientId: client.id,
        partnerId: partner.id,
        fabricId: fabricId,  // ID réel du tissu sélectionné dynamiquement par le client
        items: {
          create: {
            customName: finalItemName,
            quantityUnits: quantity,
            prodTimeMinutes: baseLaborTime,
            costPerMinute: settings.laborCostPerMin,
            sellingPrice: finalSellingPrice,
            statusProduction: 'A_COUPER',
            
            // Injection des côtes géométriques pour l'atelier[cite: 1]
            coteA,
            coteB,
            coteC,
            coteD,
            bonnet,
            blueprintUrl
          }
        }
      }
    })

    // Revalidation instantanée du planning de coupe
    revalidatePath('/atelier')
    return { success: true }

  } catch (error) {
    console.error("Erreur createPartnerOrder:", error)
    return { success: false, error: "Impossible de générer l'ordre de fabrication." }
  }
}

async function atelierSettings() {
  const settings = await prisma.atelierSettings.findUnique({
    where: { id: 'global' }
  })
  return settings || { laborCostPerMin: 0.5, marginRate: 2.0 }
}