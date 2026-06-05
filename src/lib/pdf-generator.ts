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
  dims: {
    L: number
    l: number
    bonnet?: number
    diametre?: number
  }
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
    email?: string // 🆕 Ajout de l'email
    phone?: string // 🆕 Ajout du téléphone
  }
}

export async function generateQuotePDF(data: QuotePDFData): Promise<Blob | null> {
  // 🛡️ SÉCURITÉ NEXT.JS : Si on est côté serveur pendant le pré-rendu, on n'exécute rien
  if (typeof window === 'undefined') {
    return null
  }

  const doc = new jsPDF('p', 'mm', 'a4')

  // --- 0. AJOUT DU LOGO ---
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

  // --- 2. BLOC CLIENT COORDONNÉES ---
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
    currentClientY += 5 // 🆕 On n'oublie pas d'incrémenter pour la ligne suivante !
  }

  // 🆕 Affichage de l'email
  if (data.client?.email) {
    doc.text(`Email : ${data.client.email}`, rightColumnX, currentClientY)
    currentClientY += 5
  }

  // 🆕 Affichage du téléphone
  if (data.client?.phone) {
    doc.text(`Tél : ${data.client.phone}`, rightColumnX, currentClientY)
    currentClientY += 5
  }

  // --- 3. INFOS DOCUMENT ---
  // 💡 J'ai décalé de +10 vers le bas (Y passe de 70 à 80) pour laisser la place aux nouvelles lignes client
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`DEVIS TECHNIQUE SUR MESURE`, 20, 80)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Référence : ${data.reference}`, 20, 87)
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 20, 92)

  doc.setLineWidth(0.5)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 97, 190, 97)

  // --- 4. TABLEAU DES PRODUITS ---
  const tableData = data.products.map((product, index) => {
    let labelFamily = product.family
    if (product.family === 'FITTED') labelFamily = 'Drap Housse'
    if (product.family === 'ENVELOPE') labelFamily = 'Housse Couette / Taie'
    if (product.family === 'FLAT') labelFamily = 'Drap Plat'
    if (product.family === 'BOLSTER') labelFamily = 'Traversin'
    if (product.family === 'ROUND') labelFamily = 'Ouvrage Rond'

    const dimensionsStr = product.family === 'ROUND' 
      ? `Diam. ${product.dims.diametre || 210}cm`
      : `${product.dims.L}×${product.dims.l}${product.dims.bonnet ? ` (Bonnet ${product.dims.bonnet}cm)` : ''}`

    return [
      `${index + 1}`,
      `${labelFamily}\nGamme: ${product.range}`,
      `${product.fabric.reference}\n${product.fabric.name}`,
      dimensionsStr,
      `${product.mainFabricMeters.toFixed(1)} m`,
      `${product.laborMinutes} min`,
      `${product.totalPriceHT.toFixed(2)} €`
    ]
  })

  autoTable(doc, {
    startY: 104, // 💡 Décalé de +10 également pour suivre la ligne
    head: [['#', 'OUVRAGE', 'MATIÈRE', 'DIMENSIONS', 'MÉTRAGE', 'COUTURE', 'MONTANT']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, valign: 'middle' },
    columnStyles: { 
      0: { halign: 'center', cellWidth: 8 }, 
      4: { halign: 'right' }, 
      5: { halign: 'center' }, 
      6: { halign: 'right', fontStyle: 'bold' } 
    }
  })

// --- 5. ZONE DE TOTALISATION DYNAMIQUE ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 10
  
  // 💡 On recule le texte à 115 au lieu de 135 pour laisser respirer le TTC !
  const totalX = 115 

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  let currentY = finalY
  let baseTotalHT = data.totalPrice
  let discountAmount = 0

  // 1. Calcul et affichage de la remise
  if (data.discountPercent && data.discountPercent > 0) {
    discountAmount = baseTotalHT * (data.discountPercent / 100)
    doc.text(`Remise Commerciale (${data.discountPercent}%) :`, totalX, currentY)
    doc.text(`- ${discountAmount.toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6
  }

  let netHT = baseTotalHT - discountAmount

  // 2. Ligne HT
  doc.setFont('helvetica', 'bold')
  doc.text("TOTAL NET HT :", totalX, currentY)
  doc.text(`${netHT.toFixed(2)} €`, 190, currentY, { align: 'right' })
  currentY += 6

  // 3. Calcul de la TVA et TTC
  if (data.isTTC) {
    const tvaAmount = netHT * 0.20
    const totalTTC = netHT + tvaAmount

    doc.setFont('helvetica', 'normal')
    doc.text("TVA (20%) :", totalX, currentY)
    doc.text(`${tvaAmount.toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12) // La police grossit ici...
    // ...mais grâce au X=115, ça ne touchera plus le prix !
    doc.text("TOTAL FACTURÉ TTC :", totalX, currentY)
    doc.text(`${totalTTC.toFixed(2)} €`, 190, currentY, { align: 'right' })
  }
  return doc.output('blob')
}