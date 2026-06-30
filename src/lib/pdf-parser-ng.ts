// src/lib/pdf-parser-ng.ts

interface DynamicNGItem {
  designation: string
  taille: string
  tissu: string
  couleur: string
  typeProduit: string
  epaisseur: string
  prixUnitaire: number
  quantite: number
  prixTotal: number
}

export function parseNGPdfContent(text: string) {
  // 1. Métadonnées globales (Via Regex)
  const orderNum = text.match(/(?:Numéro de commande:\s*|\bN°\s*)\s*"?(\d+)"?/)?.[1] || "";
  const orderDate = text.match(/Date de la commande:\s*"?([^\n"]+)"?/)?.[1]?.trim() || "";
  const totalTTC = text.match(/TOTAL TTC\s*"?\s*([\d,.]+)\s*€/)?.[1] || "0";
  const shippingCost = text.match(/Frais de port\s*"?\s*([\d,.]+)\s*€/)?.[1] || "0";

  // Client
  const email = text.match(/E-mail:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const nom = text.match(/Nom:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const prenom = text.match(/Prénom:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const adresse = text.match(/Adresse:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const codePostal = text.match(/Code Postal:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const ville = text.match(/Ville:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const telephone = text.match(/Tél:\s*"?\s*([\d\s]+)"?/)?.[1]?.trim() || "";

  // 2. Extraction 100% dynamique des descriptifs articles
  const items: DynamicNGItem[] = [];

  // On isole la partie centrale qui contient le descriptif des articles
  const corpsArticles = text.split(/Détails de la Commande N° \d+/)[1]?.split(/TOTAL TTC/)[0] || "";
  const lignes = corpsArticles.split('\n').map(l => l.trim()).filter(Boolean);
  
  let currentItem: Partial<DynamicNGItem> = {};

  lignes.forEach((ligne) => {
    if (ligne.includes("Taille")) {
      currentItem.taille = ligne.split(':').pop()?.replace(/"/g, '').trim() || "";
    } else if (ligne.includes("Tissu")) {
      currentItem.tissu = ligne.split(':').pop()?.replace(/"/g, '').trim() || "";
    } else if (ligne.includes("Couleur")) {
      currentItem.couleur = ligne.split(':').pop()?.replace(/"/g, '').trim() || "";
    } else if (ligne.includes("Type")) {
      currentItem.typeProduit = ligne.split(':').pop()?.replace(/"/g, '').trim() || "";
    } else if (ligne.includes("Epaisseur")) {
      currentItem.epaisseur = ligne.split(':').pop()?.replace(/"/g, '').trim() || "";
    }
    // Détection d'une nouvelle ligne d'article (Désignation en MAJUSCULES)
    else if (ligne === ligne.toUpperCase() && !ligne.includes("€") && isNaN(Number(ligne)) && !ligne.includes("DÉSIGNATION")) {
      if (currentItem.designation) {
        items.push({
          designation: currentItem.designation,
          taille: currentItem.taille || "",
          tissu: currentItem.tissu || "",
          couleur: currentItem.couleur || "",
          typeProduit: currentItem.typeProduit || "",
          epaisseur: currentItem.epaisseur || "",
          prixUnitaire: 0,
          quantite: 0,
          prixTotal: 0
        });
      }
      currentItem = { designation: ligne };
    }
  });

  // On pousse le dernier article traité dans la boucle
  if (currentItem.designation) {
    items.push({
      designation: currentItem.designation,
      taille: currentItem.taille || "",
      tissu: currentItem.tissu || "",
      couleur: currentItem.couleur || "",
      typeProduit: currentItem.typeProduit || "",
      epaisseur: currentItem.epaisseur || "",
      prixUnitaire: 0,
      quantite: 0,
      prixTotal: 0
    });
  }

  // 3. Association dynamique des prix et quantités reçus en colonnes
  const zonePrixBrute = text.split(/Prix total/)[1]?.split(/TOTAL TTC/)[0] || "";
  const patternDonnees = /([\d,.]+)\s*€|(?<![\d,.])(\d+)(?![\d,.€])/g;
  let match;
  const valeursExtraites: string[] = [];

  while ((match = patternDonnees.exec(zonePrixBrute)) !== null) {
    valeursExtraites.push(match[1] || match[2]);
  }

  // Distribution séquentielle par triplets (Prix Unit, Qté, Prix Total)
  items.forEach((item, index) => {
    const baseIndex = index * 3;
    if (valeursExtraites[baseIndex] && valeursExtraites[baseIndex + 1] && valeursExtraites[baseIndex + 2]) {
      item.prixUnitaire = parseFloat(valeursExtraites[baseIndex].replace(',', '.'));
      item.quantite = parseInt(valeursExtraites[baseIndex + 1], 10);
      item.prixTotal = parseFloat(valeursExtraites[baseIndex + 2].replace(',', '.'));
    }
  });

  return {
    orderReference: `NG-#${orderNum}`, // 👈 Virgule ajoutée ici
    dateCommande: orderDate,
    totalTTC: parseFloat(totalTTC.replace(',', '.')),
    fraisPort: parseFloat(shippingCost.replace(',', '.')),
    client: { email, nom, prenom, adresse, codePostal, ville, telephone },
    items: items
  };
}