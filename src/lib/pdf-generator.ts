import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'

interface QuotePDFData {
  id: string
  reference: string
  totalPrice: number
  products: Array<{
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
  }>
}

export async function generateQuotePDF(quoteData: QuotePDFData, elementId?: string): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4')

  // EN-TÊTE
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ATELIER NICOLE GERMAIN', 105, 20, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Devis de confection sur mesure', 105, 30, { align: 'center' })
  doc.text(`Référence: ${quoteData.reference}`, 105, 38, { align: 'center' })
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, 45, { align: 'center' })

  // LIGNE DÉCORATIVE
  doc.setLineWidth(2)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 55, 190, 55)

  // TABLEAU DES PRODUITS
  const tableData = quoteData.products.map((product, index) => [
    `${index + 1}`,
    `${product.family} ${product.range}`,
    `${product.fabric.reference} - ${product.fabric.name}`,
    `${product.dims.L}x${product.dims.l}${product.dims.bonnet ? ` (B${product.dims.bonnet})` : ''} cm`,
    `${product.mainFabricMeters.toFixed(2)} m`,
    `${product.laborMinutes} min`,
    `${product.totalPriceHT.toFixed(2)} €`
  ])

  autoTable(doc, {
    startY: 65,
    head: [['#', 'PRODUIT', 'TISSU', 'DIMENSIONS', 'MÉTRAGE', 'COUTURE', 'PRIX HT']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'right', fontStyle: 'bold' }
    },
    styles: {
      fontSize: 10,
      cellPadding: 4,
      halign: 'left'
    },
    didDrawPage: (data) => {
      // Total en bas
      const finalY = (data.cursor?.y || 100) + 10
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`TOTAL DEVIS HT: ${quoteData.totalPrice.toFixed(2)} €`, 150, finalY, { align: 'right' })
    }
  })

  // PIED DE PAGE
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(128, 128, 128)
  doc.text('Atelier Nicole Germain - Confection sur mesure', 105, pageHeight - 20, { align: 'center' })
  doc.text('Validité: 30 jours - TVA non applicable art. 293B du CGI', 105, pageHeight - 13, { align: 'center' })

  // LOGO (optionnel)
  try {
    // Si vous avez un logo, ajoutez-le ici
    // doc.addImage(logoBase64, 'PNG', 20, 10, 30, 30)
  } catch {}

  return doc.output('blob')
}

// Version HTML to PDF (alternative)
export async function generateQuotePDFFromHTML(elementId: string): Promise<Blob> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error('Élément HTML non trouvé')

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgWidth = 210
  const pageHeight = 295
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  let heightLeft = imgHeight

  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  return pdf.output('blob')
}