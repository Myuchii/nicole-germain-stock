// src/lib/engine.ts

type ProductFamily = 'FITTED' | 'ENVELOPE' | 'FLAT' | 'BOLSTER' | 'ROUND'
type ProductRange = 'BASIQUE' | 'MONACO' | 'TPR' | 'TR'

interface Dimensions {
  L: number
  l: number
  epaisseur?: number
  diametre?: number
}

// 🟢 NOUVEAU : L'interface pour accepter les prix de ta base de données
interface SupplyPrices {
  threadPerMeter: number
  biasPerMeter: number
  elasticPerMeter: number
  zipperPerMeter?: number
}

function getValeurAjoutee(epaisseur: number): number {
  if (epaisseur <= 4) return 24;
  if (epaisseur === 5) return 28;
  if (epaisseur === 6) return 32;
  if (epaisseur <= 8) return 34;
  if (epaisseur <= 10) return 44;
  if (epaisseur <= 12) return 48;
  if (epaisseur <= 15) return 56;
  if (epaisseur <= 17) return 60;
  if (epaisseur <= 20) return 70;
  if (epaisseur <= 25) return 80;
  if (epaisseur <= 30) return 85;
  if (epaisseur <= 35) return 95;
  if (epaisseur <= 40) return 105;
  if (epaisseur <= 45) return 115;
  if (epaisseur <= 52) return 125; 
  if (epaisseur <= 55) return 135; 
  return 135; 
}

export function calculateNGProduction(
  family: ProductFamily,
  range: ProductRange,
  dimensions: Dimensions,
  fabrics: { mainPrice: number; secondaryPrice?: number; laize: number },
  baseLaborMinutes: number, 
  costPerMinute: number,
  marginRate: number,
  // 🟢 NOUVEAU : Le 8ème paramètre qui remplace le vieux "debug"
  supplyPrices: SupplyPrices = { threadPerMeter: 0.005, biasPerMeter: 0.10, elasticPerMeter: 0.20, zipperPerMeter: 6.00 },
  debug = false
) {
  let linearNeeded = 0;
  let labor = baseLaborMinutes; 
  const laize = fabrics.laize;

  // --- ALGORITHME DE COUPE ---
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
    
    const panelsW = Math.ceil(Math.min(lengthCm, widthCm) / laizeCm);
    const linearM = Math.max(lengthCm, widthCm) / 100 * panelsW * 1.08;
    return { meters: linearM, panels: panelsW, needsAssembly: true }; 
  };

  let opt;
  switch (family) {
    case 'FITTED':
      const epaisseur = dimensions.epaisseur || 15;
      const valeurAjoutee = getValeurAjoutee(epaisseur);
      opt = getOptimizedLinearMeters(dimensions.L + valeurAjoutee, dimensions.l + valeurAjoutee);
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
  
  labor = opt?.needsAssembly ? labor + 25 : labor;

  const isBicolor = ['MONACO'].includes(range);
  let mainMeters = linearNeeded;
  let secondaryMeters = 0;
  
  if (isBicolor) {
    mainMeters *= 0.75;
    secondaryMeters = linearNeeded * 0.30;
    labor += 20; 
  }
  if (range === 'TR' || range === 'TPR') labor += 15; 

  // 🧶 CALCUL DES FOURNITURES
  const L_m = dimensions.L / 100;
  const l_m = dimensions.l / 100;
  const perimeter_m = (L_m + l_m) * 2;
  
  let elasticMeters = 0;
  let biasMeters = 0;
  let threadMeters = 0;
  let zipperMeters = 0;

  switch (family) {
    case 'FITTED':
      biasMeters = perimeter_m;
      elasticMeters = dimensions.l < 160 ? (l_m + 1) * 2 : 4.80;
      threadMeters = perimeter_m * 15; // 3m biais + 12m surjet
      break;
    case 'ENVELOPE':
      const seamLengthHC = (L_m * 2) + l_m; 
      threadMeters = seamLengthHC * 15; // 12m surjet + 3m ourler
      zipperMeters = l_m; 
      break;
    case 'ROUND':
      const roundPerimeter = (dimensions.diametre || 200) * Math.PI / 100;
      threadMeters = roundPerimeter * 15;
      zipperMeters = 2.50; 
      break;
    case 'FLAT':
      threadMeters = perimeter_m * 3; 
      break;
    case 'BOLSTER':
      threadMeters = 12; 
      break;
  }

  // 💰 CALCUL FINANCIER FINAL
  const fabricCost = mainMeters * fabrics.mainPrice + secondaryMeters * (fabrics.secondaryPrice || 0);
  const laborCost = labor * costPerMinute;
  
  const suppliesCostHT = 
    (threadMeters * supplyPrices.threadPerMeter) +
    (biasMeters * supplyPrices.biasPerMeter) +
    (elasticMeters * supplyPrices.elasticPerMeter) +
    (zipperMeters * (supplyPrices.zipperPerMeter || 6.00));

  const costPriceHT = fabricCost + laborCost + suppliesCostHT; 
  const sellingPriceHT = costPriceHT * marginRate; 

  return {
    mainFabricMeters: Number(mainMeters.toFixed(2)),
    secondaryFabricMeters: Number(secondaryMeters.toFixed(2)),
    laborMinutes: Math.round(labor),
    suppliesCostHT: Number(suppliesCostHT.toFixed(2)),
    costPriceHT: Number(costPriceHT.toFixed(2)),       
    totalPriceHT: Number(sellingPriceHT.toFixed(2)),   
    // 🟢 NOUVEAU : On inclut bien "supplies" dans le debug final pour que l'action serveur puisse le lire !
    debug: { ...opt, laize, family, range, dimensions, supplies: { threadMeters, biasMeters, elasticMeters, zipperMeters } }
  };
}