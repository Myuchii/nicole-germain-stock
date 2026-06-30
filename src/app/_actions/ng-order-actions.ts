'use server';

import { prisma } from '@/lib/prisma';
import { QuoteStatus, ClientSource } from '@prisma/client'; // 🎯 FIX : On importe ClientSource ici !

export async function saveImportedNGOrder(orderData: any) {
  try {
    let client = await prisma.client.findFirst({
      where: { email: orderData.client.email },
    });

    const clientData = {
      name: `${orderData.client.prenom} ${orderData.client.nom}`,
      address: orderData.client.adresse,
      zipCode: orderData.client.codePostal,
      city: orderData.client.ville,
      source: ClientSource.WEB_VOSGIA, // 🎯 FIX : On utilise l'vrai Enum plutôt qu'une string brute !
    };

    if (client) {
      client = await prisma.client.update({
        where: { id: client.id },
        data: clientData,
      });
    } else {
      client = await prisma.client.create({
        data: {
          email: orderData.client.email,
          ...clientData,
        },
      });
    }

    const defaultFabric = await prisma.fabric.findFirst();
    if (!defaultFabric) {
      return { 
        success: false, 
        error: "Veuillez créer au moins un tissu de base en base de données avant d'importer une commande." 
      };
    }

    await prisma.quote.create({
      data: {
        reference: orderData.orderReference,
        totalPrice: orderData.totalTTC,
        isTTC: true,
        status: QuoteStatus.VALIDATED,
        clientId: client.id,
        fabricId: defaultFabric.id,
        validatedAt: new Date(),
        items: {
          create: orderData.items.map((item: any) => ({
            customName: `${item.designation} (${item.typeProduit || 'Standard'}) - ${item.taille} / ${item.epaisseur}`,
            quantityUnits: item.quantite,
            sellingPrice: item.prixUnitaire,
            prodTimeMinutes: 15,
            costPerMinute: 0.5,
            statusProduction: 'A_COUPER',
            fabricId: defaultFabric.id, 
          })),
        },
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Erreur Server Action Import NG:", error);
    return { success: false, error: error.message || "Impossible de sauvegarder la commande." };
  }
}