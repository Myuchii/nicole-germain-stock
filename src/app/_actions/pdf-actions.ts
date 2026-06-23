import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Product {
  family: string
  range: string
  fabric: {
    reference: string
    name: string
    color?: string // 🆕 Ajout optionnel de la couleur brute si dispo
    pricePerMeter: number
  }
  dims: {
    L: number
    l: number
    bonnet?: number
    diametre?: number
  }
  quantityUnits?: number // 🆕 On récupère la quantité saisie (Qt)
  mainFabricMeters: number
  laborMinutes: number
  totalPriceHT: number
}

interface QuotePDFData {
  id: string
  reference: string
  totalPrice: number
  isTTC?: boolean
  discountPercent?: number
  products: Product[]
  client: {
    name: string
    address?: string
    zipCode?: string
    city?: string
    company?: string
  }
}

export async function generateQuotePDF(data: QuotePDFData): Promise<Blob | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const doc = new jsPDF('p', 'mm', 'a4')

  // --- 0. LOGIQUE DE CHARGEMENT DU LOGO ---
  try {
    const response = await fetch('/logo.png') 
    const blob = await response.blob()
    
    const base64Logo = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    
    doc.addImage(base64Logo, 'PNG', 20, 10, 40, 15)
  } catch (error) {
    console.warn("Impossible de charger le logo, génération du PDF sans logo.", error)
  }

  // --- 1. EN-TÊTE DE L'ATELIER ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ATELIER NICOLE GERMAIN', 20, 35)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Confection de Linge de Lit sur Mesure', 20, 41)
  doc.text('Email : contact@nicolegermain.com', 20, 46)

  // --- 2. BLOC COORDONNÉES CLIENT ---
  const rightColumnX = 120
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DESTINATAIRE :', rightColumnX, 35)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const clientName = data.client?.name || "Client non spécifié"
  doc.text(clientName.toUpperCase(), rightColumnX, 41)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  let currentClientY = 46

  if (data.client?.company) {
    doc.text(data.client.company, rightColumnX, currentClientY)
    currentClientY += 5
  }
  
  if (data.client?.address) {
    doc.text(data.client.address, rightColumnX, currentClientY)
    currentClientY += 5
  }

  if (data.client?.zipCode || data.client?.city) {
    const zip = data.client.zipCode || ''
    const city = data.client.city || ''
    doc.text(`${zip} ${city}`.trim(), rightColumnX, currentClientY)
  }

  // --- 3. INFOS DOCUMENT ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`DEVIS COMMERCIAL SUR MESURE`, 20, 70)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Référence : ${data.reference}`, 20, 77)
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 20, 82)

  doc.setLineWidth(0.5)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 87, 190, 87)

  // --- 4. TABLEAU DES PRODUITS (STRUCTURE EXACTE DU CROQUIS) ---
  const tableData = data.products.map((product) => {
    let labelFamily = product.family
    if (product.family === 'FITTED') labelFamily = 'Drap Housse'
    if (product.family === 'ENVELOPE') labelFamily = 'Housse Couette'
    if (product.family === 'FLAT') labelFamily = 'Drap Plat'
    if (product.family === 'BOLSTER') labelFamily = 'Traversin'
    if (product.family === 'ROUND') labelFamily = 'Ouvrage Rond'
    if (product.family === 'CUSTOM') labelFamily = 'Sur-mesure'

    // Formattage des dimensions stricts
    const dimensionsStr = product.family === 'ROUND' 
      ? `Diam. ${product.dims.diametre || 210}cm`
      : `${product.dims.L}×${product.dims.l}${product.dims.bonnet ? ` (B.${product.dims.bonnet}cm)` : ''}`

    // Séparation Qualité (Matière) et Couleur
    // Si le nom du tissu contient déjà la couleur (ex: "Percale - Blanc"), on nettoie un peu au besoin
    const qualiteStr = `${product.range}\n(${product.fabric.name.split('-')[0].trim()})`
    
    const colorStr = product.fabric.color 
      ? product.fabric.color.toUpperCase() 
      : (product.fabric.name.split('-')[1]?.trim().toUpperCase() || 'STANDARD')

    const qte = product.quantityUnits || 1
    const puHT = product.totalPriceHT / qte // Déduction mathématique du prix unitaire

    return [
      labelFamily,                           // 1. Ouvrage
      `${qte}`,                              // 2. Qt
      dimensionsStr,                         // 3. Dimens°
      qualiteStr,                            // 4. Qualité
      colorStr,                              // 5. Couleur
      `${puHT.toFixed(2)} €`,                // 6. PU HT
      `${product.totalPriceHT.toFixed(2)} €` // 7. PT HT
    ]
  })

  autoTable(doc, {
    startY: 94,
    // 🎯 En-têtes calqués sur les intitulés de ton croquis papier
    head: [['OUVRAGE', 'QT', 'DIMENS°', 'QUALITÉ', 'COULEUR', 'PU HT', 'PT HT']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 8.5, valign: 'middle' },
    columnStyles: { 
      0: { halign: 'left', cellWidth: 32 },   // Ouvrage
      1: { halign: 'center', cellWidth: 12 }, // Qt
      2: { halign: 'center', cellWidth: 30 }, // Dimens°
      3: { halign: 'left', cellWidth: 32 },   // Qualité
      4: { halign: 'center', cellWidth: 24 }, // Couleur
      5: { halign: 'right', cellWidth: 22 },  // PU HT
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 } // PT HT
    }
  })

  // --- 5. ZONE DE TOTALISATION DYNAMIQUE ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 10
  const totalX = 130

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  let currentY = finalY
  if (data.discountPercent && data.discountPercent > 0) {
    doc.text(`Remise Commerciale (${data.discountPercent}%) :`, totalX, currentY)
    doc.text(`- ${(data.totalPrice * (data.discountPercent / 100)).toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const labelTotal = data.isTTC ? "TOTAL FACTURÉ TTC :" : "TOTAL NET HT :"
  doc.text(labelTotal, totalX, currentY)
  doc.text(`${data.totalPrice.toFixed(2)} €`, 190, currentY, { align: 'right' })

  // --- 6. FOOTER LÉGAL ---
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Validité de la proposition : 30 jours à compter de la date d\'émission', 105, pageHeight - 20, { align: 'center' })
  doc.text('Les articles à dimensions spéciales ne sont ni repris, ni échangés', 105, pageHeight - 15, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Atelier Nicole Germain — Confectionné main en France', 105, pageHeight - 10, { align: 'center' })

  return doc.output('blob')
}