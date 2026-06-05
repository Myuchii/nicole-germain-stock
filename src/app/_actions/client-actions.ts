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

export async function createClientQuick(data: { 
  name: string; 
  address: string; 
  zipCode: string; 
  city: string;
  email?: string;   // 🆕 Nouveau
  phone?: string;   // 🆕 Nouveau
  company?: string; // 🆕 Nouveau
  country?: string;
}) {
  try {
    if (!data.name || data.name.trim() === "") {
      return { success: false, error: "Le nom est obligatoire." }
    }

    const newClient = await prisma.client.create({
      data: { 
        name: data.name.trim(),
        address: data.address.trim() || null,  
        zipCode: data.zipCode.trim() || null,  
        city: data.city.trim() || null,        
        email: data.email?.trim() || null,     // 🆕 Enregistrement
        phone: data.phone?.trim() || null,     // 🆕 Enregistrement
        company: data.company?.trim() || null, // 🆕 Enregistrement
        country: data.country?.trim() || "france",
      }
    })

    return { success: true, client: newClient }
  } catch (error) {
    console.error("Erreur création rapide client:", error)
    return { success: false, error: "Impossible de créer le client." }
  }
}

// 4. Modifier la fiche complète d'un client
export async function updateClient(id: string, data: {
  name: string
  company?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  zipCode?: string | null
  city?: string | null
  country?: string | null
}) {
  try {
    if (!id) return { success: false, error: "ID du client manquant." }
    if (!data.name || data.name.trim() === "") {
      return { success: false, error: "Le nom du client est obligatoire." }
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name: data.name.trim(),
        company: data.company?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        zipCode: data.zipCode?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country?.trim() || "France",
      }
    })

    revalidatePath('/clients')
    revalidatePath(`/clients/${id}`)
    revalidatePath('/quotes')

    return { success: true, client: updatedClient }
  } catch (error) {
    console.error("Erreur lors de la modification du client :", error)
    return { success: false, error: "Une erreur technique est survenue lors de la modification." }
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