'use server'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { Product } from '@/types'

export async function generateQuotePDF(data: {
  products: Product[]
  fabrics: Fabric[]
  total: any
}) {
  const doc = new jsPDF()
  
  // Header
  doc.setFontSize(20)
  doc.text('ATELIER NICOLE GERMAIN', 20, 25)
  doc.setFontSize(12)
  doc.text('DEVIS COUTURE SUR MESURE', 20, 35)
  
  // Tableau produits
  const tableData = data.products.map((p, i) => {
    const fabric = data.fabrics[i]
    const res = calculateNGProduction(p.family, p.range, p.dims, {
      mainPrice: fabric.pricePerMeter,
      laize: fabric.width || 300
    })
    
    return [
      `${p.family} ${p.range}`,
      `${fabric.reference}`,
      `${p.dims.L}×${p.dims.l}cm`,
      `${res.mainFabricMeters.toFixed(2)}m`,
      `${res.laborMinutes}min`,
      `${res.totalPriceHT.toFixed(2)}€`
    ]
  })
  
  doc.autoTable({
    head: [['Produit', 'Tissu', 'Dimensions', 'Métrage', 'Temps', 'Prix HT']],
    body: tableData,
    startY: 50,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] }
  })
  
  // Total
  const finalY = doc.lastAutoTable.finalY + 20
  doc.setFontSize(16)
  doc.text(`TOTAL HT : ${data.total.totalPriceHT.toFixed(2)} €`, 170, finalY, { align: 'right' })
  
  // Footer
  doc.setFontSize(10)
  doc.text('Validité 30 jours - TVA 20%', 20, doc.internal.pageSize.height - 20)
  
  // DOWNLOAD
  doc.save(`devis-${Date.now()}.pdf`)
  
  return true
}