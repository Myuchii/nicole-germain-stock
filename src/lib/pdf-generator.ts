import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Product {
  family: string
  range: string
  fabric: {
    reference: string
    name: string
    pricePerMeter: number
  }
  dims: { L: number; l: number; bonnet?: number; diametre?: number }
  mainFabricMeters: number
  laborMinutes: number
  totalPriceHT: number
}

interface QuotePDFData {
  id: string
  reference: string
  totalPrice: number // C'est le total HT brut calculé par le moteur
  isTTC?: boolean     // La case cochée dans ton configurateur
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

export async function generateQuotePDF(quoteData: QuotePDFData): Promise<Blob | null> {
  if (typeof window === 'undefined') return null

  const doc = new jsPDF('p', 'mm', 'a4')

  // --- 1. EN-TÊTE DE L'ATELIER ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ATELIER NICOLE GERMAIN', 20, 25)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Confection de Linge de Lit sur Mesure', 20, 31)
  doc.text('Email : contact@nicolegermain.com', 20, 36)

  // --- 2. BLOC CLIENT COORDONNÉES ---
  const rightColumnX = 120
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DESTINATAIRE :', rightColumnX, 25)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const clientName = quoteData.client?.name || "Client non spécifié"
  doc.text(clientName.toUpperCase(), rightColumnX, 31)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  let currentClientY = 36
  if (quoteData.client?.company) {
    doc.text(quoteData.client.company, rightColumnX, currentClientY)
    currentClientY += 5
  }
  if (quoteData.client?.address) {
    doc.text(quoteData.client.address, rightColumnX, currentClientY)
    currentClientY += 5
  }
  if (quoteData.client?.zipCode || quoteData.client?.city) {
    const zip = quoteData.client.zipCode || ''
    const city = quoteData.client.city || ''
    doc.text(`${zip} ${city}`.trim(), rightColumnX, currentClientY)
  }

  // --- 3. INFOS DOCUMENT ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`DEVIS CONFECTION SUR MESURE`, 20, 60)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Référence : ${quoteData.reference}`, 20, 67)
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 20, 72)

  doc.setLineWidth(0.5)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 77, 190, 77)

  // --- 4. TABLEAU DES PRODUITS (DYNAMIQUE HT / TTC) ---
  const tableData = quoteData.products.map((product, index) => {
    let labelFamily = product.family
    if (product.family === 'FITTED') labelFamily = 'Drap Housse'
    if (product.family === 'ENVELOPE') labelFamily = 'Housse Couette / Taie'
    if (product.family === 'FLAT') labelFamily = 'Drap Plat'
    if (product.family === 'BOLSTER') labelFamily = 'Traversin'
    if (product.family === 'ROUND') labelFamily = 'Ouvrage Rond'

    const dimensionsStr = product.family === 'ROUND' 
      ? `Diam. ${product.dims.diametre || 210}cm`
      : `${product.dims.L}x${product.dims.l}${product.dims.bonnet ? ` (B${product.dims.bonnet})` : ''} cm`

    // 🎯 Calcul du prix de la ligne selon l'option choisie
    const itemPrice = quoteData.isTTC 
      ? product.totalPriceHT * 1.20  // Application de la TVA 20%
      : product.totalPriceHT

    return [
      `${index + 1}`,
      `${labelFamily}\nGamme: ${product.range}`,
      `${product.fabric.reference} - ${product.fabric.name}`,
      dimensionsStr,
      `${product.mainFabricMeters.toFixed(2)} m`,
      `${product.laborMinutes} min`,
      `${itemPrice.toFixed(2)} €`
    ]
  })

  // Le titre de la dernière colonne change selon l'état choisi
  const lastColumnHeader = quoteData.isTTC ? 'PRIX TTC' : 'PRIX HT'

  autoTable(doc, {
    startY: 84,
    head: [['#', 'OUVRAGE', 'MATIÈRE', 'DIMENSIONS', 'MÉTRAGE', 'COUTURE', lastColumnHeader]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { halign: 'center', fontStyle: 'bold' }, 6: { halign: 'right', fontStyle: 'bold' } },
    styles: { fontSize: 10, cellPadding: 4, halign: 'left', valign: 'middle' }
  })

  // --- 5. ZONE DE TOTALISATION AVANCÉE (HT vs TTC) ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 12
  const totalX = 130
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  
  let currentY = finalY

  // Calcul de la réduction sur la base globale HT
  let baseHT = quoteData.totalPrice
  if (quoteData.discountPercent && quoteData.discountPercent > 0) {
    const discountAmount = baseHT * (quoteData.discountPercent / 100)
    doc.text(`Remise Commerciale (${quoteData.discountPercent}%) :`, totalX, currentY)
    doc.text(`- ${discountAmount.toFixed(2)} €`, 190, currentY, { align: 'right' })
    baseHT -= discountAmount
    currentY += 6
  }

  if (quoteData.isTTC) {
    // 🏢 SI TTC : On affiche la ventilation comptable complète
    const amountTVA = baseHT * 0.20
    const totalTTC = baseHT + amountTVA

    doc.text("TOTAL NET HT :", totalX, currentY)
    doc.text(`${baseHT.toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6

    doc.text("TVA (20%) :", totalX, currentY)
    doc.text(`${amountTVA.toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 7

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text("TOTAL FACTURÉ TTC :", totalX, currentY)
    doc.text(`${totalTTC.toFixed(2)} €`, 190, currentY, { align: 'right' })
  } else {
    // 🛍️ SI HT (Professionnel) : Affichage classique
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text("TOTAL DEVIS NET HT :", totalX, currentY)
    doc.text(`${baseHT.toFixed(2)} €`, 190, currentY, { align: 'right' })
  }

  // --- 6. PIED DE PAGE ---
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(128, 128, 128)
  doc.text('Atelier Nicole Germain - Confection sur mesure', 105, pageHeight - 20, { align: 'center' })
  
  // Modification dynamique de la mention légale en fonction du régime de TVA appliqué
  const legalText = quoteData.isTTC 
    ? 'Validité : 30 jours — Prix calculés avec TVA de 20% incluse.'
    : 'Validité : 30 jours — TVA non applicable, art. 293B du CGI.'
  doc.text(legalText, 105, pageHeight - 13, { align: 'center' })

  return doc.output('blob')
}