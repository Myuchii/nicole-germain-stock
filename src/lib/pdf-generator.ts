import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable' // ← IMPORT CORRECT
import 'jspdf-autotable' // ← ET CELUI-CI

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

export async function generateQuotePDF(quoteData: QuotePDFData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4')

  // EN-TÊTE
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('ATELIER NICOLE GERMAIN', 105, 25, { align: 'center' })
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text('DEVIS DE CONFECTION SUR MESURE', 105, 40, { align: 'center' })
  
  doc.setFontSize(12)
  doc.text(`Réf: ${quoteData.reference}`, 20, 55)
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, 62)

  // LIGNE DÉCORATIVE
  doc.setLineWidth(3)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 72, 190, 72)

  // TABLEAU DES PRODUITS
  const tableData = quoteData.products.map((product, index) => [
    `${index + 1}`,
    `${product.family} ${product.range}`,
    `${product.fabric.reference}\n${product.fabric.name}`,
    `${product.dims.L}×${product.dims.l}${product.dims.bonnet ? ` (B${product.dims.bonnet})` : ''}`,
    `${product.mainFabricMeters.toFixed(2)}m`,
    `${product.laborMinutes}min`,
    `${product.totalPriceHT.toFixed(2)}€`
  ])

  // ← UTILISER autoTable au lieu de doc.autoTable
  autoTable(doc, {
    startY: 80,
    head: [['#', 'PRODUIT', 'TISSU', 'DIMENSIONS', 'MÉTRAGE', 'COUTURE', 'PRIX HT']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      valign: 'middle',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 25 }
    },
    didDrawPage: (data) => {
      // Total en bas à droite
      const finalY = data.cursor.y + 15
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text(`TOTAL HT: ${quoteData.totalPrice.toFixed(2)} €`, 170, finalY, { align: 'right' })
    },
    margin: { top: 80, bottom: 40 }
  })

  // PIED DE PAGE
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text('Atelier Nicole Germain - Couture sur mesure de qualité', 105, pageHeight - 25, { align: 'center' })
  doc.text('Validité 30 jours - TVA non applicable art. 293B du CGI', 105, pageHeight - 18, { align: 'center' })
  doc.text('Paiement: 50% à la commande, solde à la livraison', 105, pageHeight - 11, { align: 'center' })

  return doc.output('blob')
}