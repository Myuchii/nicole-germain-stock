'use server'

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
  products: Product[]
}

export async function generateQuotePDF(data: QuotePDFData): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4')

  doc.setFontSize(24)
  doc.text('ATELIER NICOLE GERMAIN', 105, 25, { align: 'center' })
  doc.setFontSize(14)
  doc.text('DEVIS CONFECTION SUR MESURE', 105, 40, { align: 'center' })
  doc.setFontSize(12)
  doc.text(`Réf: ${data.reference}`, 20, 55)
  doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 20, 62)

  doc.setLineWidth(3)
  doc.setDrawColor(99, 102, 241)
  doc.line(20, 72, 190, 72)

  const tableData = data.products.map((product, index) => [
    `${index + 1}`,
    `${product.family} ${product.range}`,
    `${product.fabric.reference} - ${product.fabric.name}`,
    `${product.dims.L}×${product.dims.l}${product.dims.bonnet ? ` (B${product.dims.bonnet})` : ''}`,
    `${product.mainFabricMeters.toFixed(2)}m`,
    `${product.laborMinutes}min`,
    `${product.totalPriceHT.toFixed(2)}€`
  ])

  autoTable(doc, {
    startY: 80,
    head: [['#', 'PRODUIT', 'TISSU', 'DIMENSIONS', 'MÉTRAGE', 'COUTURE', 'PRIX HT']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'center' }, 6: { halign: 'right', fontStyle: 'bold' } }
  })

  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text('Validité 30 jours - TVA non applicable art. 293B', 105, pageHeight - 20, { align: 'center' })

  return doc.output('blob')
}