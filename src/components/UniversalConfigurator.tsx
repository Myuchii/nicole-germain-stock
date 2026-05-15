"use client"
import { useState } from 'react'
import { calculateNGProduction } from '@/lib/engine'
import { createQuoteFromCalculator } from '@/app/_actions/quote-actions'
import { generateQuotePDF } from '@/lib/pdf-generator'
import { Calculator, Save, Ruler, Layers, Plus, Trash2, Download } from 'lucide-react'

interface Fabric {
  id: string
  reference: string
  name: string
  pricePerMeter: number
  width: number
}

interface Product {
  id: string
  family: string
  range: string
  fabricId: string
  dims: { L: number; l: number; bonnet: number; diametre: number }
}

export default function UniversalConfigurator({ fabrics }: { fabrics: Fabric[] }) {
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      family: 'FITTED',
      range: 'BASIQUE',
      fabricId: '',
      dims: { L: 200, l: 160, bonnet: 30, diametre: 210 }
    }
  ])
  const [isPending, setIsPending] = useState(false)

  const results = products.map(product => {
    const fabric = fabrics.find(f => f.id === product.fabricId)
    return calculateNGProduction(
       product.family as 'FITTED' | 'ENVELOPE' | 'FLAT' | 'BOLSTER' | 'ROUND',
       product.range as 'BASIQUE' | 'MONACO' | 'TPR' | 'TR',
       product.dims,
      { 
        mainPrice: Number(fabric?.pricePerMeter || 0),
        laize: Number(fabric?.width || 300)
      }
    )
  })

  const grandTotalHT = results.reduce((sum, res) => sum + res.totalPriceHT, 0)

  const addProduct = () => {
    setProducts([...products, {
      id: `${products.length + 1}`,
      family: 'FITTED',
      range: 'BASIQUE',
      fabricId: '',
      dims: { L: 200, l: 160, bonnet: 30, diametre: 210 }
    }])
  }

  const removeProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id))
  }

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ))
  }

  const updateDims = (id: string, newDims: any) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, dims: newDims } : p
    ))
  }

  const handleSave = async () => {
    if (products.filter(p => p.fabricId).length === 0) return alert("Choisis un tissu !")
    setIsPending(true)
    await createQuoteFromCalculator({ products })
    setIsPending(false)
    alert("Devis enregistré avec succès !")
  }

  // NOUVEAU : Générer PDF
  const handleDownloadPDF = async () => {
    const validProducts = products
      .filter(p => p.fabricId)
      .map((p) => {
        const fabric = fabrics.find(f => f.id === p.fabricId)!
        const res = results[products.indexOf(p)]
        return {
          family: p.family,
          range: p.range,
          fabric: {
            reference: fabric.reference,
            name: fabric.name,
            pricePerMeter: fabric.pricePerMeter
          },
          dims: p.dims,
          mainFabricMeters: res.mainFabricMeters,
          laborMinutes: res.laborMinutes,
          totalPriceHT: res.totalPriceHT
        }
      })

    const quoteData = {
      id: `DEV-${Date.now()}`,
      reference: `DEV-${Date.now()}`,
      totalPrice: grandTotalHT,
      products: validProducts
    }

    try {
      const pdfBlob = await generateQuotePDF(quoteData)
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `Devis-${quoteData.reference}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pdfUrl)
    } catch (error) {
      alert('Erreur lors de la génération du PDF')
      console.error(error)
    }
  }

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
      {/* HEADER */}
      <div className="bg-slate-900 p-6 text-white flex items-center gap-3">
        <div className="p-3 bg-indigo-500 rounded-2xl">
          <Calculator size={24} />
        </div>
        <div>
          <h2 className="font-bold text-lg">Configurateur Universel</h2>
          <p className="text-slate-400 text-xs uppercase tracking-wider">Atelier Nicole Germain</p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {/* PRODUITS */}
        {products.map((product) => {
          const currentFabric = fabrics.find(f => f.id === product.fabricId)
          const res = results[products.indexOf(product)]

          return (
            <div key={product.id} className="space-y-6 p-6 bg-slate-50 rounded-3xl border-2 border-slate-200 hover:border-indigo-300 transition-all">
              {/* EN-TÊTE PRODUIT */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500 rounded-2xl text-white">
                    <Layers size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-800">Produit {product.id}</h3>
                </div>
                {products.length > 1 && (
                  <button 
                    onClick={() => removeProduct(product.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {/* SECTION 1 : PRODUIT & GAMME */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Layers size={16} /> Produit
                  </label>
                  <select 
                    value={product.family}
                    onChange={(e) => updateProduct(product.id, { family: e.target.value })} 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="FITTED">Drap Housse / Protège Matelas</option>
                    <option value="ENVELOPE">Housse de Couette / Taie</option>
                    <option value="FLAT">Drap Plat / Nappe</option>
                    <option value="BOLSTER">Traversin</option>
                    <option value="ROUND">Lit Rond / Couette Ronde</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Gamme</label>
                  <select 
                    value={product.range}
                    onChange={(e) => updateProduct(product.id, { range: e.target.value })} 
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="BASIQUE">Standard / Basique</option>
                    <option value="MONACO">Monaco (Bicolore)</option>
                    <option value="TPR">TPR (Articulé)</option>
                    <option value="TR">TR (Tête Relevable)</option>
                  </select>
                </div>
              </div>

              {/* SECTION 2 : TISSU */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tissu à utiliser</label>
                <select 
                  value={product.fabricId}
                  onChange={(e) => updateProduct(product.id, { fabricId: e.target.value })} 
                  className="w-full p-4 bg-indigo-50 text-indigo-700 rounded-2xl border-none font-bold outline-none"
                >
                  <option value="">Sélectionner dans le stock...</option>
                  {fabrics.map(f => (
                    <option key={f.id} value={f.id}>{f.reference} - {f.name} ({Number(f.pricePerMeter).toFixed(2)}€/m)</option>
                  ))}
                </select>
              </div>

              {/* SECTION 3 : DIMENSIONS */}
              <div className="p-6 bg-slate-50 rounded-3xl space-y-4">
                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm uppercase">
                  <Ruler size={16} /> Dimensions (cm)
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {product.family !== 'ROUND' ? (
                    <>
                      <input 
                        type="number" 
                        value={product.dims.L} 
                        onChange={(e) => updateDims(product.id, { ...product.dims, L: Number(e.target.value) })}
                        placeholder="Long." 
                        className="p-4 rounded-xl border-none text-center font-bold" 
                      />
                      <input 
                        type="number" 
                        value={product.dims.l} 
                        onChange={(e) => updateDims(product.id, { ...product.dims, l: Number(e.target.value) })}
                        placeholder="Larg." 
                        className="p-4 rounded-xl border-none text-center font-bold" 
                      />
                      {product.family === 'FITTED' && (
                        <input 
                          type="number" 
                          value={product.dims.bonnet} 
                          onChange={(e) => updateDims(product.id, { ...product.dims, bonnet: Number(e.target.value) })}
                          placeholder="Bonnet" 
                          className="p-4 rounded-xl border-none text-center font-bold" 
                        />
                      )}
                    </>
                  ) : (
                    <input 
                      type="number" 
                      value={product.dims.diametre} 
                      onChange={(e) => updateDims(product.id, { ...product.dims, diametre: Number(e.target.value) })}
                      placeholder="Diamètre" 
                      className="col-span-3 p-4 rounded-xl border-none text-center font-bold" 
                    />
                  )}
                </div>
              </div>

              {/* MINI-RÉSULTAT */}
              {product.fabricId && (
                <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-200 text-sm">
                  <div className="flex justify-between">
                    <span className="font-bold text-indigo-800">{res.totalPriceHT.toFixed(2)} €</span>
                    <span>{res.mainFabricMeters.toFixed(1)}m | {res.laborMinutes}min</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* SECTION RÉSULTAT + BOUTONS */}
        <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-200">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Total Commande HT</p>
              <p className="text-4xl font-black">{grandTotalHT.toFixed(2)} €</p>
            </div>
            <div className="text-right text-sm">
              <p>Métrage : <strong>{results.reduce((sum, r) => sum + r.mainFabricMeters, 0).toFixed(1)} m</strong></p>
              <p>Couture : <strong>{results.reduce((sum, r) => sum + r.laborMinutes, 0)} min</strong></p>
            </div>
          </div>
          
          {/* 3 BOUTONS EN LIGNE */}
          <div className="flex gap-3">
            <button 
              onClick={handleSave}
              disabled={isPending || products.filter(p => p.fabricId).length === 0}
              className="flex-1 py-4 bg-white text-indigo-600 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-100 transition-all disabled:opacity-50 shadow-lg"
            >
              <Save size={20} />
              {isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            
            <button 
              onClick={addProduct}
              className="px-6 py-4 bg-white/80 text-indigo-600 rounded-2xl font-bold flex items-center gap-2 hover:bg-white hover:shadow-md transition-all border border-indigo-200"
            >
              <Plus size={20} />
              Produit +
            </button>

            <button 
              onClick={handleDownloadPDF}
              disabled={products.filter(p => p.fabricId).length === 0}
              className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg"
            >
              <Download size={20} />
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}