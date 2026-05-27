"use client"
import { useState } from 'react'
import { calculateNGProduction } from '@/lib/engine'
import { createQuoteFromCalculator } from '@/app/_actions/quote-actions'
import { createClientQuick } from '@/app/_actions/client-actions'
import { generateQuotePDF } from '@/lib/pdf-generator'
import { Calculator, Save, Ruler, Layers, Plus, Trash2, Download, UserPlus, Check } from 'lucide-react'

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

// 🆕 Définition de l'interface Client manquante
interface Client {
  id: string
  name: string
  company?: string
}

export default function UniversalConfigurator({ fabrics, clients: initialClients }: { fabrics: Fabric[], clients: Client[] }) {
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

  const [clients, setClients] = useState<Client[]>(initialClients)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  // 🆕 Déclaration des états pour l'adresse volante
  const [quickAddress, setQuickAddress] = useState('')
  const [quickZip, setQuickZip] = useState('')
  const [quickCity, setQuickCity] = useState('')

  const [options, setOptions] = useState({
    isChute: false,
    isTTC: false,
    discountPercent: 0
  })

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
    if (!selectedClientId) return alert("Attribue d'abord ce devis à un client (existant ou nouveau) !")
    if (products.filter(p => p.fabricId).length === 0) return alert("Choisis un tissu au moins sur l'un de tes articles !")
    
    setIsPending(true)
    
    await createQuoteFromCalculator({ 
      products,
      clientId: selectedClientId,
      isChute: options.isChute,
      isTTC: options.isTTC,
      discountPercent: options.discountPercent
    })
    
    setIsPending(false)
    alert("Devis enregistré avec succès ! Retrouve-le dans la liste de gauche.")
    
    setClientSearch('')
    setSelectedClientId('')
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

// NOUVEAU : Générer PDF avec intégration du client associé
  const handleDownloadPDF = async () => {
    // On récupère l'objet client complet sélectionné par Nicole
    const currentClient = clients.find(c => c.id === selectedClientId)
    if (!currentClient) {
      return alert("💡 Associe d'abord un client pour pouvoir éditer le PDF !")
    }

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
      id: `DEV-${Date.now().toString().slice(-6)}`,
      reference: `DEV-${Date.now().toString().slice(-6)}`,
      totalPrice: grandTotalHT,
      isTTC: options.isTTC,
      discountPercent: options.discountPercent,
      products: validProducts,
      // 🆕 On injecte les données de notre client trouvé
      client: {
        name: currentClient.name,
        address: (currentClient as any).address,
        zipCode: (currentClient as any).zipCode,
        city: (currentClient as any).city,
        company: (currentClient as any).company
      }
    }

try {
      const pdfBlob = await generateQuotePDF(quoteData)
      
      // Si la fonction a renvoyé null (sécurité SSR), on sort proprement
      if (!pdfBlob) return

      const pdfUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `Devis_Nicole_Germain_${quoteData.reference}.pdf`
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
        
        {/* 🆕 BLOC SÉCURISÉ : RECHERCHE OU CRÉATION CLIENT AVEC ADRESSE RAPIDE */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">👤 Assignation du client</label>
          
          <div className="relative">
            <input 
              type="text"
              placeholder="Taper le nom d'un client..."
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value)
                if (selectedClientId) setSelectedClientId('')
              }}
              className="w-full p-3 bg-white placeholder-slate-400 font-bold text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 shadow-sm"
            />
            {clientSearch && filteredClients.length > 0 && !selectedClientId && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 text-xs font-semibold divide-y divide-slate-50">
                {filteredClients.map((c: any) => (
                  <div 
                    key={c.id} 
                    onClick={() => { setSelectedClientId(c.id); setClientSearch(c.name) }}
                    className="p-3 hover:bg-indigo-50 cursor-pointer text-slate-700 transition-colors"
                  >
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formulaire d'adresse dynamique pour nouveau client */}
          {clientSearch && !selectedClientId && !clients.some(c => c.name.toLowerCase() === clientSearch.toLowerCase().trim()) && (
            <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-3 shadow-inner">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">✨ Nouveau client détecté ! Remplir son adresse pour le PDF :</p>
              
              <input 
                type="text" 
                placeholder="Rue et numéro (ex: 14 rue de la paix)" 
                value={quickAddress}
                onChange={(e) => setQuickAddress(e.target.value)}
                className="w-full p-2.5 bg-slate-50 placeholder-slate-400 text-xs rounded-xl border-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
              
              <div className="grid grid-cols-3 gap-2">
                <input 
                  type="text" 
                  placeholder="Code Postal" 
                  value={quickZip}
                  onChange={(e) => setQuickZip(e.target.value)}
                  className="p-2.5 bg-slate-50 placeholder-slate-400 text-xs rounded-xl border-none focus:ring-1 focus:ring-indigo-500 font-medium text-center"
                />
                <input 
                  type="text" 
                  placeholder="Ville" 
                  value={quickCity}
                  onChange={(e) => setQuickCity(e.target.value)}
                  className="col-span-2 p-2.5 bg-slate-50 placeholder-slate-400 text-xs rounded-xl border-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (!quickAddress || !quickZip || !quickCity) {
                    return alert("💡 Renseigne l'adresse complète pour que le devis PDF soit clean !")
                  }
                  
                  const res = await createClientQuick({
                    name: clientSearch,
                    address: quickAddress,
                    zipCode: quickZip,
                    city: quickCity
                  })

                  if (!res.success) alert(res.error)
                  else if (res.client){
                    alert(`✅ Client "${res.client.name}" créé avec son adresse !`)
                    const clientValide = res.client as any as Client
                    setClients([...clients, clientValide])
                    setSelectedClientId(clientValide.id)
                    setQuickAddress('')
                    setQuickZip('')
                    setQuickCity('')
                  }
                }}
                className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-all shadow-sm uppercase tracking-wider"
              >
                <UserPlus size={14} /> Valider & Enregistrer le Client
              </button>
            </div>
          )}

          {selectedClientId && (
            <p className="text-[10px] text-emerald-600 font-black flex items-center gap-1 bg-emerald-50 p-2 rounded-xl border border-emerald-100">
              <Check size={12}/> Client associé avec succès (Prêt pour l'enregistrement et le PDF).
            </p>
          )}
        </div>

        {/* PRODUITS */}
        {products.map((product) => {
          const currentFabric = fabrics.find(f => f.id === product.fabricId)
          const res = results[products.indexOf(product)]

          return (
            <div key={product.id} className="space-y-6 p-6 bg-slate-50 rounded-3xl border-2 border-slate-200 hover:border-indigo-300 transition-all">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Layers size={16} /> Produit
                  </label>
                  <select 
                    value={product.family}
                    onChange={(e) => updateProduct(product.id, { family: e.target.value })} 
                    className="w-full p-4 bg-slate-50 text-slate-700 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-medium outline-none"
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
                    className="w-full p-4 bg-slate-50 text-slate-700 rounded-2xl border-none focus:ring-2 focus:ring-indigo-500 font-medium outline-none"
                  >
                    <option value="BASIQUE">Standard / Basique</option>
                    <option value="MONACO">Monaco (Bicolore)</option>
                    <option value="TPR">TPR (Articulé)</option>
                    <option value="TR">TR (Tête Relevable)</option>
                  </select>
                </div>
              </div>

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
                        className="p-4 rounded-xl border-none text-center font-bold text-slate-400" 
                      />
                      <input 
                        type="number" 
                        value={product.dims.l} 
                        onChange={(e) => updateDims(product.id, { ...product.dims, l: Number(e.target.value) })}
                        placeholder="Larg." 
                        className="p-4 rounded-xl border-none text-center font-bold text-slate-400" 
                      />
                      {product.family === 'FITTED' && (
                        <input 
                          type="number" 
                          value={product.dims.bonnet} 
                          onChange={(e) => updateDims(product.id, { ...product.dims, bonnet: Number(e.target.value) })}
                          placeholder="Bonnet" 
                          className="p-4 rounded-xl border-none text-center font-bold text-slate-400" 
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

        {/* OPTIONS DE FACTURATION */}
        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4 my-6">
          <h4 className="font-bold text-sm text-slate-700 font-serif">Options de facturation</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input 
                type="checkbox" 
                checked={options.isChute}
                onChange={(e) => setOptions({ ...options, isChute: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Utiliser une chute</p>
                <p className="text-slate-400">Stock non déduit</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input 
                type="checkbox" 
                checked={options.isTTC}
                onChange={(e) => setOptions({ ...options, isTTC: e.target.checked })}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-800">Prix TTC (+20%)</p>
                <p className="text-slate-400">Client particulier</p>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Remise commerciale :</span>
            <div className="relative flex-1">
              <input 
                type="number" 
                value={options.discountPercent || ''}
                onChange={(e) => setOptions({ ...options, discountPercent: parseFloat(e.target.value) || 0 })}
                min="0" 
                max="100" 
                placeholder="0"
                className="w-full text-right pr-7 py-1 px-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute right-3 top-1.5 text-xs font-bold text-slate-400">%</span>
            </div>
          </div>
        </div>

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
              Produit
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