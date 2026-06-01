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
    // Récupération de l'image depuis le dossier public
    const response = await fetch('/logo.png') 
    const blob = await response.blob()
    
    // Conversion en Base64 requise par jsPDF
    const base64Logo = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    
    // Ajout au PDF : (données, format, X, Y, Largeur, Hauteur)
    // Ajustez la largeur (40) et la hauteur (15) selon les proportions de votre logo
    doc.addImage(base64Logo, 'PNG', 20, 10, 40, 15)
  } catch (error) {
    console.warn("Impossible de charger le logo, génération du PDF sans logo.", error)
  }

  // --- 1. EN-TÊTE DE L'ATELIER ---
  // J'ai descendu les positions Y (ex: de 25 à 35) pour laisser la place au logo au-dessus
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
  doc.text('DESTINATAIRE :', rightColumnX, 35) // Aligné avec le nom de l'atelier
  
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
  // Descendu également pour s'adapter au nouvel espacement
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`DEVIS TECHNIQUE SUR MESURE`, 20, 70)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Référence : ${data.reference}`, 20, 77)
  doc.text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, 20, 82)

  doc.setLineWidth(0.5)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 87, 190, 87)

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
    startY: 94, // Descendu pour correspondre à la ligne de séparation
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
  const totalX = 140

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  let currentY = finalY
  if (data.discountPercent && data.discountPercent > 0) {
    doc.text(`Remise Commerciale (${data.discountPercent}%) :`, totalX, currentY)
    doc.text(`- ${(data.totalPrice * (data.discountPercent / 100)).toFixed(2)} €`, 190, currentY, { align: 'right' })
    currentY += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  const labelTotal = data.isTTC ? "TOTAL FACTURÉ TTC :" : "TOTAL NET HT :"
  doc.text(labelTotal, totalX, currentY)
  doc.text(`${data.totalPrice.toFixed(2)} €`, 190, currentY, { align: 'right' })

  // --- 6. FOOTER LÉGAL ---
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Validité de la proposition : 30 jours à compter de la date d\'émission', 105, pageHeight - 20, { align: 'center' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text('Les articles à dimensions spéciales ne sont ni repris, ni echangés', 105, pageHeight - 15, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Atelier Nicole Germain — Confectionné main en France', 105, pageHeight - 10, { align: 'center' })

  return doc.output('blob')
}