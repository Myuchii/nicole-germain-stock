import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface Product {
  family: string
  range: string
  customName?: string 
  fabric: {
    reference: string
    name: string
    color?: string
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
  // 🟢 NOUVELLE LIGNE : On ajoute le choix de la marque (NG par défaut, VOSGIA, ou AUCUNE)
  brand?: 'NG' | 'VOSGIA' | 'NONE' 
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
  
  // On définit la marque par défaut sur NG si rien n'est coché
  const activeBrand = data.brand || 'NG'

  // --- 0. LOGO ---
  if (activeBrand !== 'NONE') {
    try {
      // On charge le logo dynamiquement selon la marque choisie
      const logoPath = activeBrand === 'VOSGIA' ? '/logo-vosgia.png' : '/logo.png'
      const response = await fetch(logoPath) 
      const blob = await response.blob()
      const base64Logo = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      doc.addImage(base64Logo, 'PNG', 20, 10, 40, 15)
    } catch (error) {
      console.warn(`Génération sans logo pour ${activeBrand}.`)
    }
  }

  // --- 1. EN-TÊTE EXPÉDITEUR ---
  if (activeBrand === 'NG') {
    doc.setFont('helvetica', 'bold').setFontSize(16)
    doc.text('ATELIER NICOLE GERMAIN', 20, 35)
    doc.setFont('helvetica', 'normal').setFontSize(9)
    doc.text('Confection de Linge de Lit sur Mesure', 20, 41)
    doc.text('Email : contact@nicolegermain.com', 20, 46)
  } else if (activeBrand === 'VOSGIA') {
    doc.setFont('helvetica', 'bold').setFontSize(16)
    doc.text('VOSGIA', 20, 35)
    doc.setFont('helvetica', 'normal').setFontSize(9)
    doc.text('Linge de Lit Fabrication Française', 20, 41)
    doc.text('Email : contact@vosgia.fr', 20, 46)
  }
  // Si c'est 'NONE', on n'écrit rien du tout dans ce coin, le devis est 100% anonyme côté expéditeur.

  // --- 2. CLIENT ---
  const rightColumnX = 120
  doc.setFont('helvetica', 'bold').setFontSize(10)
  doc.text('DESTINATAIRE :', rightColumnX, 35)
  doc.setFont('helvetica', 'bold').setFontSize(11)
  
  // 🟢 MODIFICATION : Si le client n'existe pas, on met un espace vide plutôt que "Client non spécifié"
  const clientName = data.client?.name && data.client.name !== "Client Inconnu" 
    ? data.client.name 
    : "_______________________"
    
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
  doc.text(`DEVIS COMMERCIAL SUR MESURE`, 20, 80)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`Référence : ${data.reference}`, 20, 87)
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 20, 92)

  doc.setLineWidth(0.5).setDrawColor(99, 102, 241)
  doc.line(20, 97, 190, 97)

  // --- 4. TABLEAU DES PRODUITS (STRUCTURE DU CROQUIS) ---
  const tableData = data.products.map((product) => {
    let labelFamily = product.family
    if (product.family === 'FITTED') labelFamily = 'Drap Housse'
    if (product.family === 'ENVELOPE') labelFamily = 'Housse Couette'
    if (product.family === 'FLAT') labelFamily = 'Drap Plat'
    if (product.family === 'BOLSTER') labelFamily = 'Traversin'
    if (product.family === 'ROUND') labelFamily = 'Ouvrage Rond'
    if (product.family === 'CUSTOM') labelFamily = 'Sur-mesure'

    const ouvrageStr = product.customName ? product.customName : labelFamily

    const dimensionsStr = product.family === 'ROUND' 
      ? `Diam. ${product.dims.diametre || 210}cm`
      : (product.dims.L === 0 && product.dims.l === 0) ? 'Sur-mesure' : `${product.dims.L}×${product.dims.l}${product.dims.bonnet ? ` (B.${product.dims.bonnet}cm)` : ''}`

    const qualiteStr = `${product.range}\n(${product.fabric.name.split('-')[0].trim()})`
    const colorStr = product.fabric.color 
      ? product.fabric.color.toUpperCase() 
      : (product.fabric.name.split('-')[1]?.trim().toUpperCase() || 'STANDARD')

    const qte = product.quantity || 1
    const totalRowPriceRaw = product.totalPriceHT || 0
    const ptHT = data.isTTC ? (totalRowPriceRaw / 1.20) : totalRowPriceRaw
    const puHT = ptHT / qte

    return [
      ouvrageStr,
      `${qte}`,
      dimensionsStr,
      qualiteStr,
      colorStr,
      `${puHT.toFixed(2)} €`,
      `${ptHT.toFixed(2)} €`
    ]
  })

  autoTable(doc, {
    startY: 104, 
    head: [['OUVRAGE', 'QTÉ', 'DIMENS°', 'QUALITÉ', 'COULEUR', 'PU HT', 'PT HT']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
    bodyStyles: { fontSize: 8.5, valign: 'middle' },
    columnStyles: { 
      0: { halign: 'left', cellWidth: 35 },
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'left', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 23 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
    }
  })

  // --- 5. ZONE DE TOTALISATION HARMONISÉE ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 10
  const totalX = 115 

  doc.setFont('helvetica', 'normal').setFontSize(10)
  let currentY = finalY

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
  
  doc.setFont('helvetica', 'bold')
  doc.text("TOTAL NET HT :", totalX, currentY)
  doc.text(`${netHT.toFixed(2)} €`, 190, currentY, { align: 'right' })
  currentY += 6

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