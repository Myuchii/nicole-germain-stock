"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createOrUpdateClient(formData: FormData) {
  const name = formData.get('name') as string
  const company = formData.get('company') as string || null
  const email = formData.get('email') as string || null
  const phone = formData.get('phone') as string || null
  
  // 🆕 Récupération des champs d'adresse
  const address = formData.get('address') as string || null
  const zipCode = formData.get('zipCode') as string || null
  const city = formData.get('city') as string || null
  const country = formData.get('country') as string || "France"

  if (!name) {
    return { success: false, error: "Le nom du client est obligatoire." }
  }

  await prisma.client.create({
    data: { name, company, email, phone, address, zipCode, city, country }
  })

  revalidatePath('/clients')
  redirect('/clients')
}

// 2. Récupérer tous les clients
export async function getClients() {
  return await prisma.client.findMany({
    orderBy: { name: 'asc' }
  })
}

// =========================================================================
// 🆕 CRÉATION RAPIDE CLIENT ENRICHI AVEC LES BONS NOMS DE CHAMPS (SANS BILLING)
// =========================================================================
export async function createClientQuick(data: { name: string; address: string; zipCode: string; city: string }) {
  try {
    if (!data.name || data.name.trim() === "") {
      return { success: false, error: "Le nom est obligatoire." }
    }

    const newClient = await prisma.client.create({
      data: { 
        name: data.name.trim(),
        address: data.address.trim() || null,  // 🔍 C'est bien "address" tout court !
        zipCode: data.zipCode.trim() || null,  // 🔍 C'est bien "zipCode" !
        city: data.city.trim() || null,        // 🔍 C'est bien "city" !
        country: "France"
      }
    })

    return { success: true, client: newClient }
  } catch (error) {
    console.error("Erreur création rapide client:", error)
    return { success: false, error: "Impossible de créer le client." }
  }
}

// 3. Supprimer un client (uniquement s'il n'a pas de devis lié)
export async function deleteClient(id: string) {
  try {
    const hasQuotes = await prisma.quote.findFirst({ where: { clientId: id } })
    
    if (hasQuotes) {
      return { success: false, error: "Impossible de supprimer ce client car des devis lui sont associés." }
    }

    await prisma.client.delete({ where: { id } })
    revalidatePath('/clients')
    return { success: true }
  } catch (e) {
    return { success: false, error: "Une erreur technique est survenue." }
  }
}