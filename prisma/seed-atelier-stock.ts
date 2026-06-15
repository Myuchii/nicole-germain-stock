import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'

const prisma = new PrismaClient()

// 🎯 Alignement exact avec les fichiers générés par extract_sheets.py
const filesToImport = [
  { filename: 'OPMATIS.csv' },
  { filename: 'OMEGA.csv' },
  { filename: 'VALRUPT_TGV.csv' },
  { filename: 'TISSAGE_MOULINE_THILLOT.csv' },
  { filename: 'DECHELETTE.csv' },
  { filename: 'CAMILLTEX.csv' },
  { filename: 'FILTES_FILATI_TESSUTI.csv' },
]

async function importStockMeters(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const results: any[] = []

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Fichier introuvable : ${filePath}`)
      return resolve()
    }

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' }))
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        let count = 0
        for (const row of results) {
          const reference = row['REFERENCE']?.trim()
          const designation = row['DESIGNATION']?.trim()
          const couleur = row['COULEUR']?.trim() || 'Standard'
          const quantiteRaw = row['QUANTITE']
          const prixRaw = row['PRIX HT AU METRE']

          if (!reference || reference === 'NaN' || designation?.includes('FORFAIT ROULAGE')) continue

          const cleanQty = quantiteRaw ? parseFloat(quantiteRaw.toString().replace(',', '.')) : 0
          const cleanPrice = prixRaw ? parseFloat(prixRaw.toString().replace(',', '.').replace(/[^\d.]/g, '')) : 0

          if (cleanQty <= 0) continue

          // Injection directe dans le stock réel de l'atelier
          await prisma.fabric.upsert({
            where: { reference: reference },
            update: {
              stockMeters: { increment: cleanQty }
            },
            create: {
              reference: reference,
              name: designation || `Tissu ${reference}`,
              color: couleur,
              stockMeters: cleanQty,
              alertThresholdMeters: 15.0, 
              pricePerMeter: cleanPrice || 5.0,
              unit: 'METER',
              isArchived: false
            }
          })
          count++
        }
        console.log(`🧵 Stock atelier incrémenté de ${count} lignes pour ${path.basename(filePath)}`)
        resolve()
      })
      .on('error', (error) => reject(error))
  })
}

async function main() {
  console.log('🚀 Démarrage de l\'injection des métrages dans le stock de l\'atelier...')
  
  // S'adapte que le script soit lancé depuis la racine ou src/prisma
  const baseDir = fs.existsSync(path.join(__dirname, 'data')) 
    ? path.join(__dirname, 'data')
    : path.join(__dirname, '..', 'prisma', 'data')

  for (const file of filesToImport) {
    const targetPath = path.join(baseDir, file.filename)
    await importStockMeters(targetPath)
  }

  console.log('🏁 Tout le stock de l\'atelier a été alimenté !')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })