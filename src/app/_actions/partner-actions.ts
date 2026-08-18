"use server"

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { put } from '@vercel/blob'

export async function uploadToBlob(formData: FormData) {
  const file = formData.get('file') as File
  if (!file) {
    throw new Error("Aucun fichier fourni")
  }

  try {
    const blob = await put(`partner-orders/${Date.now()}-${file.name}`, file, {
      access: 'private',
    })

    return { url: blob.url }
  } catch (error) {
    console.error("Erreur Vercel Blob:", error)
    return { error: "Échec du téléversement sur le stockage cloud" }
  }
}

export async function createPartnerOrder(formData: FormData) {
  // 🟢 On récupère la chaîne JSON contenant le tableau des URLs
  const docUrlsString = formData.get('docUrls') as string
  const schemaUrl = formData.get('schemaUrl') as string
  const rawOrderNumber = formData.get('orderNumber') as string

  if (!docUrlsString || !schemaUrl || !rawOrderNumber) {
    return { success: false, error: "Le numéro de commande, les bons et le schéma sont obligatoires." }
  }

  try {
    // 🟢 On re-transforme le texte en vrai tableau Javascript
    const docUrls = JSON.parse(docUrlsString)

    // 🟢 On crée le JSON combiné. 
    // Astuce : on crée "docs" avec tout le tableau, et on garde "doc: docUrls[0]" 
    // pour ne pas faire planter les anciennes commandes qui n'avaient qu'un seul fichier !
    const combinedUrls = JSON.stringify({ 
      docs: docUrls, 
      doc: docUrls[0] || null, 
      schema: schemaUrl 
    })

    // 🟢 La suite reste inchangée...
    const cleanNumber = rawOrderNumber.trim()
    const reference = cleanNumber.toUpperCase().startsWith('CC-') 
      ? cleanNumber 
      : `CC-${cleanNumber}`
    
    const dateTransmission = new Date()
    // 1️⃣ Récupération ou création automatique du tissu générique "CI-JOINT"
    const fallbackFabric = await prisma.fabric.upsert({
      where: { reference: "CI-JOINT" },
      update: { isArchived: false },
      create: {
        reference: "CI-JOINT",
        name: "Ci-joint (voir documents)",
        color: "CI-JOINT",
        stockMeters: 0,
        isArchived: false,
        unit: 'METER'
      }
    })

    // 2️⃣ Récupération ou création automatique du client "CAMPING CAR"
    let client = await prisma.client.findFirst({
      where: { name: "CAMPING CAR" }
    })

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: "CAMPING CAR",
          email: "campingcar-b2b@nicolegermain.fr",
          phone: "0240246993"
        }
      })
    }

    // 3️⃣ Création du devis validé
    const quote = await prisma.quote.create({
      data: {
        reference: reference,
        totalPrice: 0, 
        quantity: 1, 
        status: 'VALIDATED',
        validatedAt: dateTransmission,
        createdAt: dateTransmission,
        isTTC: false,
        paymentMethod: 'Compte Partenaire B2B',
        products: [], 
        fabric: { connect: { id: fallbackFabric.id } },
        client: { connect: { id: client.id } }
      }
    })

    // 4️⃣ Création de la ligne d'atelier pour Jade
    await prisma.quoteItem.create({
      data: {
        quoteId: quote.id,
        fabricId: fallbackFabric.id,
        statusProduction: "A_COUPER",
        blueprintUrl: combinedUrls,
        customName: "Commande Camping-Car (Fichiers joints)",
        quantityMeters: 0, 
        prodTimeMinutes: 30,
        costPerMinute: 0,
        sellingPrice: 0,
        quantityUnits: 1,
        isChute: false,
        discountPercent: 0,
        createdAt: dateTransmission
      }
    })

    revalidatePath('/atelier')
    return { success: true }

  } catch (error) {
    console.error("Erreur création commande partenaire :", error)
    return { success: false, error: "Impossible d'enregistrer la commande." }
  }
}