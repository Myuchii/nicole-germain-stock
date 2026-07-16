// src/lib/pdf-parser-ng.ts

export function parseNGPdfContent(text: string) {
  const orderNum = text.match(/(?:Numéro de commande:\s*|\bN°\s*)\s*"?(\d+)"?/)?.[1] || "";
  const orderDate = text.match(/Date de la commande:\s*"?([^\n"]+)"?/)?.[1]?.trim() || "";
  const totalTTC = text.match(/TOTAL TTC\s*"?\s*([\d,.]+)\s*€/)?.[1] || "0";
  const shippingCost = text.match(/Frais de port\s*"?\s*([\d,.]+)\s*€/)?.[1] || "0";

  const email = text.match(/E-mail:\s*"?\s*([^\n"()]+)"?/)?.[1]?.trim() || "";
  const nom = text.match(/Nom:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const prenom = text.match(/Prénom:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const adresse = text.match(/Adresse:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const codePostal = text.match(/Code Postal:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const ville = text.match(/Ville:\s*"?\s*([^\n"]+)"?/)?.[1]?.trim() || "";
  const telephone = text.match(/Tél:\s*"?\s*([\d\s]+)"?/)?.[1]?.trim() || "";

  const items: any[] = [];
  const debugLogs: string[] = []; // 🎯 Tableau de tracking structurel
  const vus = new Set<string>();

  const articleRegex = /([A-ZÆŒÇ\s\-]+)\s*Taille\s*:\s*([^\n]+)\s*Tissu\s*:\s*([^\n]+)(?:\s*Couleur principale\s*:\s*([^\n]+))?(?:\s*Type\s*:\s*([^\n]+))?\s*Epaisseur\s*:\s*([^\n]+?)\s*([\d,.]+)\s*€\s+(\d+)\s+([\d,.]+)\s*€/g;

  for (const match of text.matchAll(articleRegex)) {
    const designation = match[1].replace(/Prix unitaire|Quantité|Prix total/gi, "").trim();
    const taille = match[2].split("Tissu")[0].replace(/[:|]/g, "").trim();
    const tissu = match[3].split("Couleur")[0].split("Type")[0].split("Epaisseur")[0].replace(/[:|]/g, "").trim();
    const couleur = match[4] ? match[4].split("Type")[0].split("Epaisseur")[0].replace(/[:|]/g, "").trim() : "Aucune";
    const typeProduit = match[5] ? match[5].split("Epaisseur")[0].replace(/[:|]/g, "").trim() : "Standard";
    
    const epaisseurBrute = match[6].replace(/[:|]/g, "").trim();
    const epaisseur = epaisseurBrute.split(/[\d,.]+\s*€/)[0].trim();

    const prixUnitaire = parseFloat(match[7].replace(',', '.'));
    const quantite = parseInt(match[8], 10);
    const prixTotal = parseFloat(match[9].replace(',', '.'));

    const cleUnique = `${designation}-${taille}-${quantite}`;

    if (!vus.has(cleUnique) && designation.length > 3) {
      items.push({
        designation, taille, tissu, couleur, typeProduit, epaisseur, prixUnitaire, quantite, prixTotal
      });
      vus.add(cleUnique);

      // 🔍 Structuration visuelle du log pour ce bloc d'article
      debugLogs.push(`
📦 [ARTICLE DÉTECTÉ] -> "${designation}"
   ├── 📏 Taille     : "${taille}"
   ├── 🧵 Tissu      : "${tissu}"
   ├── 🎨 Couleur    : "${couleur}"
   ├── 📐 Type       : "${typeProduit}"
   ├── 🥞 Épaisseur  : "${epaisseur}"
   └── 💰 Tarification: ${prixUnitaire} € x ${quantite} = ${prixTotal} €
      `.trim());
    }
  }

  // Affiche le résultat directement dans la console de ton navigateur au moment du traitement
  console.log("============== STRUCTURE DU PDF PARSÉ ==============");
  debugLogs.forEach(log => console.log(log));
  console.log("====================================================");

  return {
    orderReference: `NG-#${orderNum}`,
    dateCommande: orderDate || "Date inconnue",
    totalTTC: parseFloat(totalTTC.replace(',', '.')),
    fraisPort: parseFloat(shippingCost.replace(',', '.')),
    client: { email, nom, prenom, adresse, codePostal, ville, telephone },
    items,
    _debugLogs: debugLogs // Permet de l'afficher aussi dans ton interface UI si besoin
  };
}
