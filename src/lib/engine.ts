// src/lib/engine.ts

type ProductFamily = 'FITTED' | 'ENVELOPE' | 'FLAT' | 'BOLSTER' | 'ROUND'
type ProductRange = 'BASIQUE' | 'MONACO' | 'TPR' | 'TR'

interface Dimensions {
  L: number
  l: number
  bonnet?: number
  diametre?: number
}

export function calculateNGProduction(
  family: ProductFamily,
  range: ProductRange,
  dimensions: Dimensions,
  fabrics: { mainPrice: number; secondaryPrice?: number; laize: number },
  baseLaborMinutes: number, 
  costPerMinute: number,
  marginRate: number,
  debug = false
) {
  let linearNeeded = 0;
  
  // ⏱️ 1. INITIALISATION DU TEMPS : On part du temps configuré par Nicole
  let labor = baseLaborMinutes; 
  const laize = fabrics.laize;

  // --- ALGORITHME DE COUPE (Intact) ---
  const getOptimizedLinearMeters = (lengthCm: number, widthCm: number) => {
    const laizeCm = laize;
    const sens1_ok = widthCm <= laizeCm;
    const sens2_ok = lengthCm <= laizeCm;
    
    if (sens1_ok && sens2_ok) {
      const coupeSens1 = lengthCm;
      const coupeSens2 = widthCm;
      if (coupeSens1 <= coupeSens2) return { meters: coupeSens1 / 100 * 1.02, panels: 1, needsAssembly: false };
      else return { meters: coupeSens2 / 100 * 1.02, panels: 1, needsAssembly: false };
    }
    if (sens1_ok) return { meters: lengthCm / 100 * 1.02, panels: 1, needsAssembly: false };
    if (sens2_ok) return { meters: widthCm / 100 * 1.02, panels: 1, needsAssembly: false };
    
    // Si ça ne rentre pas, on doit assembler plusieurs panneaux
    const panelsW = Math.ceil(Math.min(lengthCm, widthCm) / laizeCm);
    const linearM = Math.max(lengthCm, widthCm) / 100 * panelsW * 1.08;
    return { meters: linearM, panels: panelsW, needsAssembly: true }; // 👈 needsAssembly = true !
  };

  // --- GÉOMÉTRIE SELON LA FAMILLE ---
  let opt;
  switch (family) {
    case 'FITTED':
      const b = dimensions.bonnet || 15;
      opt = getOptimizedLinearMeters(dimensions.L + b * 2 + 10, dimensions.l + b * 2 + 10);
      break;
    case 'ENVELOPE':
      opt = getOptimizedLinearMeters(dimensions.L * 2 + 20, dimensions.l + 10);
      break;
    case 'FLAT':
      opt = getOptimizedLinearMeters(dimensions.L + 40, dimensions.l + 40);
      break;
    case 'BOLSTER':
      opt = getOptimizedLinearMeters(90, dimensions.l + 30);
      break;
    case 'ROUND':
      const d = (dimensions.diametre || 200) + 20;
      opt = { meters: d / 100, needsAssembly: false };
      break;
  }

  linearNeeded = opt?.meters ?? 0;
  
  // ⏱️ 2. AJOUT DES PÉNALITÉS TECHNIQUES AU TEMPS DE NICOLE
  // S'il y a un assemblage de panneaux (car tissu pas assez large), on ajoute 25 min d'office
  labor = opt?.needsAssembly ? labor + 25 : labor;

  const isBicolor = ['MONACO'].includes(range);
  let mainMeters = linearNeeded;
  let secondaryMeters = 0;
  
  if (isBicolor) {
    mainMeters *= 0.75;
    secondaryMeters = linearNeeded * 0.30;
    labor += 20; // +20 min pour gérer les deux couleurs
  }

  if (range === 'TR' || range === 'TPR') {
    labor += 15; // +15 min pour la complexité des têtes articulées
  }

  // 💰 3. CALCUL FINANCIER FINAL
  const fabricCost = mainMeters * fabrics.mainPrice + secondaryMeters * (fabrics.secondaryPrice || 0);
  
  // On multiplie le temps total calculé par le coût minute de l'atelier
  const laborCost = labor * costPerMinute;
  
  // Coût de revient = Matière + Main d'œuvre
  const costPriceHT = fabricCost + laborCost; 
  
  // Prix de vente = Coût de revient * Marge configurée par Nicole
  const sellingPriceHT = costPriceHT * marginRate; 

  return {
    mainFabricMeters: Number(mainMeters.toFixed(2)),
    secondaryFabricMeters: Number(secondaryMeters.toFixed(2)),
    laborMinutes: Math.round(labor),
    costPriceHT: Number(costPriceHT.toFixed(2)),       
    totalPriceHT: Number(sellingPriceHT.toFixed(2)),   
    debug: { ...opt, laize, family, range, dimensions }
  };
}