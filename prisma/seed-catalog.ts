import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import csv from 'csv-parser'

const prisma = new PrismaClient()

// Liste de tes fichiers associés aux noms exacts des fournisseurs
const filesToImport = [
  { supplier: 'OPMATIS', filename: 'OPMATIS.csv' },
  { supplier: 'OMEGA', filename: 'OMEGA.csv' },
  { supplier: 'VALRUPT TGV', filename: 'VALRUPT_TGV.csv' },
  { supplier: 'TISSAGE MOULINE THILLOT', filename: 'TISSAGE_MOULINE_THILLOT.csv' },
  { supplier: 'DECHELETTE', filename: 'DECHELETTE.csv' },
  { supplier: 'CAMILLTEX', filename: 'CAMILLTEX.csv' },
  { supplier: 'FILTES FILATI TESSUTI', filename: 'FILTES_FILATI_TESSUTI.csv' },
]

async function importCSV(supplierName: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const results: any[] = []

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Fichier introuvable pour ${supplierName}, ignoré.`)
      return resolve()
    }

    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',' })) // Utilise ',' ou ';' selon la configuration de ton export
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`⏳ Traitement de ${results.length} lignes pour ${supplierName}...`)
        
        let importedCount = 0

        for (const row of results) {
          // Extraction et nettoyage des colonnes clés
          const reference = row['REFERENCE']?.trim()
          const designation = row['DESIGNATION']?.trim() || null
          const couleur = row['COULEUR']?.trim() || null
          const prixRaw = row['PRIX HT AU METRE']

          // Sécurité : On ignore les lignes sans référence valide ou les lignes de frais (forfait roulage)
          if (!reference || reference === 'NaN' || designation?.includes('FORFAIT ROULAGE')) {
            continue
          }

          // Nettoyage du prix pour le convertir proprement en Float
          let purchasePriceHT = 0
          if (prixRaw) {
            const cleanPrice = prixRaw.toString().replace(',', '.').replace(/[^\d.]/g, '')
            purchasePriceHT = parseFloat(cleanPrice) || 0
          }

          try {
            // Insertion ou mise à jour sécurisée (grâce à l'index unique composé)
            await prisma.supplierCatalogItem.upsert({
              where: {
                supplierName_reference: {
                  supplierName: supplierName,
                  reference: reference,
                }
              },
              update: {
                designation: designation,
                color: couleur,
                purchasePriceHT: purchasePriceHT,
              },
              create: {
                supplierName: supplierName,
                reference: reference,
                designation: designation,
                color: couleur,
                purchasePriceHT: purchasePriceHT,
              }
            })
            importedCount++
          } catch (error) {
            console.error(`❌ Erreur sur la réf ${reference} de ${supplierName}:`, error)
          }
        }
        
        console.log(`✅ ${importedCount} références enregistrées pour ${supplierName}.`)
        resolve()
      })
      .on('error', (error) => reject(error))
  })
}

async function main() {
  console.log('🚀 Démarrage de l\'importation du catalogue fournisseurs...')
  
  for (const file of filesToImport) {
    const targetPath = path.join(__dirname, 'data', file.filename)
    await importCSV(file.supplier, targetPath)
  }

  console.log('🏁 Catalogue entièrement synchronisé en Base de Données !')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })