'use server';

import { prisma } from '@/lib/prisma';
import { QuoteStatus, ClientSource } from '@prisma/client';
import { revalidatePath } from "next/cache";

export async function saveImportedNGOrder(orderData: any) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Gestion anti-doublon : Suppression de l'ancien Quote s'il existe déjà
      const existingQuote = await tx.quote.findUnique({
        where: { reference: orderData.orderReference }
      });

      if (existingQuote) {
        // Suppression des anciens items rattachés pour nettoyer la cascade
        await tx.quoteItem.deleteMany({
          where: { quoteId: existingQuote.id }
        });
        
        // Suppression du devis/commande d'origine
        await tx.quote.delete({
          where: { id: existingQuote.id }
        });
      }

      // 2. Recherche du client existant
      let client = await tx.client.findFirst({
        where: { email: orderData.client.email },
      });

      const clientData = {
        name: `${orderData.client.prenom || ''} ${orderData.client.nom || ''}`.trim(),
        address: orderData.client.adresse,
        zipCode: orderData.client.codePostal,
        city: orderData.client.ville,
        source: ClientSource.WEB_VOSGIA,
      };

      // 3. Mise à jour ou création du client
      if (client) {
        client = await tx.client.update({
          where: { id: client.id },
          data: clientData,
        });
      } else {
        client = await tx.client.create({
          data: {
            email: orderData.client.email,
            ...clientData,
          },
        });
      }

      // 4. Récupération d'un tissu de secours (fallback) requis par le schéma BDD
      const fallbackFabric = await tx.fabric.findFirst();
      if (!fallbackFabric) {
        throw new Error("Veuillez créer au moins un tissu de base en base de données avant d'importer.");
      }

      // 5. Génération et mappage des lignes d'articles avec liaison dynamique de tissu
      const itemsToCreate = await Promise.all(
        orderData.items.map(async (item: any) => {
          // On cherche dans la DB un tissu dont le nom ou la référence matche avec la saisie (ex: "Coton Vosges")
          const matchingFabric = await tx.fabric.findFirst({
            where: {
              OR: [
                { name: { contains: item.tissu, mode: 'insensitive' } },
                { reference: { contains: item.tissu, mode: 'insensitive' } }
              ]
            }
          });

          // Choix du tissu final (ID réel trouvé ou ID de secours)
          const finalFabricId = matchingFabric ? matchingFabric.id : fallbackFabric.id;

          return {
  customName: `${item.designation} (${item.couleur || 'Standard'}) - Taille: ${item.taille} / Bonnet: ${item.epaisseur || 'Standard'}`,
  quantityUnits: item.quantite || 1,
  sellingPrice: item.prixUnitaire || 0,
            discountPercent: 0,
            prodTimeMinutes: 15,
            costPerMinute: 0.5,
            statusProduction: 'A_COUPER',
            fabricId: finalFabricId, // 🧠 Clé étrangère configurée dynamiquement
          };
        })
      );

      // 6. Insertion finale du Quote et de ses items d'un seul coup
      const newQuote = await tx.quote.create({
        data: {
          reference: orderData.orderReference,
          totalPrice: orderData.totalTTC,
          isTTC: true,
          status: QuoteStatus.VALIDATED,
          clientId: client.id,
          fabricId: fallbackFabric.id,
          validatedAt: new Date(),
          items: {
            create: itemsToCreate,
          },
        },
      });

      return newQuote;
    });

    // 🔄 Invalidation du cache de la page principale pour refléter le changement
    revalidatePath("/commandes");
    return { success: true, quote: result };

  } catch (error: any) {
    console.error("Erreur Server Action Import NG:", error);
    return { success: false, error: error.message || "Impossible de sauvegarder la commande." };
  }
}