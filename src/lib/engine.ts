// Types pour le moteur
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
  range: ProductRange,  // ← FIX : ProductRange au lieu de string
  dimensions: Dimensions,
  fabrics: { mainPrice: number; secondaryPrice?: number; laize: number },
  costPerMinute: number = 0.75,
  debug = false
) {
  let linearNeeded = 0;
  let labor = 0;
  const laize = fabrics.laize; // en cm

const getOptimizedLinearMeters = (lengthCm: number, widthCm: number) => {
  const laizeCm = laize;
  
  // 🆕 TEST LES 2 SENS (optimisé)
  const sens1_ok = widthCm <= laizeCm;   // Largeur dans laize
  const sens2_ok = lengthCm <= laizeCm;  // Longueur dans laize
  
  // PRIORITÉ 1 : 1 PANNEAU (meilleur sens)
  if (sens1_ok) {
    return {
      meters: lengthCm / 100 * 1.02,
      panels: 1,
      needsAssembly: false,
      method: '1_panel_sens1',
      usedLength: lengthCm,
      usedWidth: widthCm
    };
  }
  
  if (sens2_ok) {
    return {
      meters: widthCm / 100 * 1.02,
      panels: 1,
      needsAssembly: false,
      method: '1_panel_sens2',
      usedLength: widthCm,
      usedWidth: lengthCm
    };
  }
  
  // PRIORITÉ 2 : ASSEMBLAGE (seulement si les 2 sens échouent)
  const panelsW = Math.ceil(Math.max(lengthCm, widthCm) / laizeCm);
  const linearM = Math.max(lengthCm, widthCm) / 100 * panelsW * 1.08;
  
  return {
    meters: linearM,
    panels: panelsW,
    needsAssembly: true,
    method: 'multi_panel',
    usedLength: lengthCm,
    usedWidth: widthCm
  };
};
  // 🆗 FIN FONCTION 👆

  // 🆕 CALCULS CORRIGÉS
  let opt;
  switch (family) {
    case 'FITTED': {
      const b = dimensions.bonnet || 15;
      const totalL = dimensions.L + b * 2 + 10;
      const totalW = dimensions.l + b * 2 + 10;
      opt = getOptimizedLinearMeters(totalL, totalW);
      break;
    }

    case 'ENVELOPE': {
      // Face + Dos en 1 coupe optimisée
      const totalL = dimensions.L * 2 + 20; // 420cm
      const totalW = dimensions.l + 10;    // 210cm
      opt = getOptimizedLinearMeters(totalL, totalW);
      break;
    }

    case 'FLAT': {
      const totalL = dimensions.L + 40;
      const totalW = dimensions.l + 40;
      opt = getOptimizedLinearMeters(totalL, totalW);
      break;
    }

    case 'BOLSTER': {
      const circ = 90;
      const long = dimensions.l + 30;
      opt = getOptimizedLinearMeters(circ, long);
      break;
    }

    case 'ROUND': {
      const d = (dimensions.diametre || 200) + 20;
      linearNeeded = d / 100;
      labor = 60;
      opt = { meters: linearNeeded, needsAssembly: false };
      break;
    }
  }

  linearNeeded = opt.meters ?? 0;
  labor = opt.needsAssembly ?? false ? labor + 25 : labor; // + assemblage

  // Bicolore
  const isBicolor = ['MONACO'].includes(range);
  let mainMeters = linearNeeded;
  let secondaryMeters = 0;
  if (isBicolor) {
    mainMeters *= 0.75;
    secondaryMeters = linearNeeded * 0.30;
    labor += 20;
  }

  // Gamme spéciale
  if (range === 'TR' || range === 'TPR') labor += 30;

  const fabricCost = mainMeters * fabrics.mainPrice + secondaryMeters * (fabrics.secondaryPrice || 0);
  const laborCost = labor * costPerMinute;

  return {
    mainFabricMeters: Number(mainMeters.toFixed(2)),
    secondaryFabricMeters: Number(secondaryMeters.toFixed(2)),
    laborMinutes: Math.round(labor),
    totalPriceHT: Number((fabricCost + laborCost).toFixed(2)),
    debug: {
      ...opt,
      laize,
      family,
      range,
      dimensions
    }
  };
}