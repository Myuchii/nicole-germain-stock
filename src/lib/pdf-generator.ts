import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Product {
  family: string
  range: string
  customName?: string 
  fabric: {
    reference: string
    name: string
    pricePerMeter: number
  }
  dims: {
    L: number
    l: number
    bonnet?: number
    diametre?: number
  }
  mainFabricMeters: number
  laborMinutes: number
  totalPriceHT: number
  quantity: number 
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
    email?: string 
    phone?: string 
  }
}

export async function generateQuotePDF(data: QuotePDFData): Promise<Blob | null> {
  if (typeof window === 'undefined') {
    return null
  }

  const doc = new jsPDF('p', 'mm', 'a4')

  // --- 0. LOGO ---
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
    console.warn("Génération sans logo.")
  }

  // --- 1. EN-TÊTE ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('ATELIER NICOLE GERMAIN', 20, 35)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Confection de Linge de Lit sur Mesure', 20, 41)
  doc.text('Email : contact@nicolegermain.com', 20, 46)

  // --- 2. CLIENT ---
  const rightColumnX = 120
  doc.setFont('helvetica', 'bold').setFontSize(10)
  doc.text('DESTINATAIRE :', rightColumnX, 35)
  doc.setFont('helvetica', 'bold').setFontSize(11)
  const clientName = data.client?.name || "Client non spécifié"
  doc.text(clientName.toUpperCase(), rightColumnX, 41)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  
  let currentClientY = 46
  if (data.client?.company) { doc.text(data.client.company, rightColumnX, currentClientY); currentClientY += 5 }
  if (data.client?.address) { doc.text(data.client.address, rightColumnX, currentClientY); currentClientY += 5 }
  if (data.client?.zipCode || data.client?.city) {
    doc.text(`${data.client.zipCode || ''} ${data.client.city || ''}`.trim(), rightColumnX, currentClientY)
    currentClientY += 5 
  }
  if (data.client?.email) { doc.text(`Email : ${data.client.email}`, rightColumnX, currentClientY); currentClientY += 5 }
  if (data.client?.phone) { doc.text(`Tél : ${data.client.phone}`, rightColumnX, currentClientY); currentClientY += 5 }

  // --- 3. INFOS DOCUMENT ---
  doc.setFont('helvetica', 'bold').setFontSize(14)
  doc.text(`DEVIS TECHNIQUE SUR MESURE`, 20, 80)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`Référence : ${data.reference}`, 20, 87)
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 20, 92)

  doc.setLineWidth(0.5).setDrawColor(99, 102, 241)
  doc.line(20, 97, 190, 97)

  // --- 4. TABLEAU DES PRODUITS ---
  const tableData = data.products.map((product, index) => {
    let labelFamily = product.family
    if (product.family === 'FITTED') labelFamily = 'Drap Housse'
    if (product.family === 'ENVELOPE') labelFamily = 'Housse Couette / Taie'
    if (product.family === 'FLAT') labelFamily = 'Drap Plat'
    if (product.family === 'BOLSTER') labelFamily = 'Traversin'
    if (product.family === 'ROUND') labelFamily = 'Ouvrage Rond'

    const ouvrageStr = product.customName ? product.customName : `${labelFamily}\nGamme: ${product.range}`
    const dimensionsStr = product.family === 'ROUND' 
      ? `Diam. ${product.dims.diametre || 210}cm`
      : (product.dims.L === 0 && product.dims.l === 0) ? 'Voir descriptif' : `${product.dims.L}×${product.dims.l}${product.dims.bonnet ? ` (B.${product.dims.bonnet}cm)` : ''}`

    // 🎯 FIX SOUSTRACTION : Si la commande est TTC, on divise le montant de la ligne par 1.20 pour Nicole
    const rowPriceRaw = product.totalPriceHT || 0
    const rowPriceHT = data.isTTC ? (rowPriceRaw / 1.20) : rowPriceRaw

    return [
      `${index + 1}`,
      ouvrageStr,
      `${product.quantity || 1}`,
      `${product.fabric.reference}\n${product.fabric.name}`,
      dimensionsStr,
      `${product.mainFabricMeters.toFixed(1)} m`,
      `${product.laborMinutes} min`,
      `${rowPriceHT.toFixed(2)} €` // Affiche toujours du HT propre dans les lignes
    ]
  })

  autoTable(doc, {
    startY: 104, 
    head: [['#', 'OUVRAGE', 'QTÉ', 'MATIÈRE', 'DIMENSIONS', 'MÉTRAGE', 'COUTURE', 'MONTANT']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, valign: 'middle' },
    columnStyles: { 
      0: { halign: 'center', cellWidth: 8 }, 
      1: { cellWidth: 48 }, 
      2: { halign: 'center', cellWidth: 12, fontStyle: 'bold' }, 
      5: { halign: 'right' }, 
      6: { halign: 'center' }, 
      7: { halign: 'right', fontStyle: 'bold' } 
    }
  })

  // --- 5. ZONE DE TOTALISATION HARMONISÉE ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 10
  const totalX = 115 

  doc.setFont('helvetica', 'normal').setFontSize(10)
  let currentY = finalY

  // 🎯 FIX CENTRAL : Si c'est TTC, on extrait le HT global de départ (Prix reçu / 1.20)
  const incomingPrice = data.totalPrice || 0
  let baseTotalHT = data.isTTC ? (incomingPrice / 1.20) : incomingPrice
  let discountAmountHT = 0

  if (data.discountPercent && data.discountPercent > 0) {
    discountAmountHT = baseTotalHT * (data.discountPercent / 100)
    doc.text(`Remise Commerciale (${data.discountPercent}%) :`, totalX, currentY)
    doc.text(`- ${discountAmountHT.toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6
  }

  let netHT = baseTotalHT - discountAmountHT
  
  // 1. Affichage du Net HT calculé
  doc.setFont('helvetica', 'bold')
  doc.text("TOTAL NET HT :", totalX, currentY)
  doc.text(`${netHT.toFixed(2)} €`, 190, currentY, { align: 'right' })
  currentY += 6

  // 2. Ventilation de la TVA et reconstruction du TTC propre
  if (data.isTTC) {
    const tvaAmount = netHT * 0.20
    const totalTTC = netHT + tvaAmount

    doc.setFont('helvetica', 'normal')
    doc.text("TVA (20%) :", totalX, currentY)
    doc.text(`${tvaAmount.toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6

    doc.setFont('helvetica', 'bold').setFontSize(12) 
    doc.text("TOTAL FACTURÉ TTC :", totalX, currentY)
    doc.text(`${totalTTC.toFixed(2)} €`, 190, currentY, { align: 'right' })
  }
  
  return doc.output('blob')
}