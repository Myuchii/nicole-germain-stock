"use client"

import { useState, useEffect } from 'react'
import { calculateNGProduction } from '@/lib/engine'
import { createQuoteFromCalculator, updateQuoteFromCalculator } from '@/app/_actions/quote-actions'
import { createClientQuick } from '@/app/_actions/client-actions'
import { generateQuotePDF } from '@/lib/pdf-generator'
import { Calculator, Save, Ruler, Layers, Plus, Trash2, Download, UserPlus, Check } from 'lucide-react'

// 🟢 Ajout de l'interface Accessory
interface Accessory {
  id: string
  name: string
  category: string
  pricePerUnit: number
}

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
  dims: { L: number; l: number; epaisseur: number; diametre: number }
  isChute: boolean
  quantity: number 
  customName?: string
  customPriceHT?: number
  customLaborMinutes?: number
  customFabricMeters?: number
  // 🟢 Ajout des champs pour mémoriser les choix de mercerie
  threadId?: string
  biasId?: string
  elasticId?: string
  zipperId?: string
}

interface Client {
  id: string
  name: string
  company?: string
  address?: string
  zipCode?: string
  city?: string
  country?: string
  email?: string
  phone?: string
}

interface UniversalConfiguratorProps {
  fabrics: Fabric[]
  clients: Client[]
  accessories?: Accessory[] // 🟢 On dit au composant qu'il a le droit de recevoir les accessoires
  settings?: any       
  productTypes?: any[] 
  initialData?: any
}

export default function UniversalConfigurator({ 
  fabrics, 
  clients: initialClients,
  accessories, // 🟢 On les récupère ici
  settings,       
  productTypes,
  initialData    
}: UniversalConfiguratorProps) {

  const [brand, setBrand] = useState<'NG' | 'VOSGIA' | 'NONE'>('NG')

  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      family: 'FITTED',
      range: 'BASIQUE',
      fabricId: '',
      dims: { L: 200, l: 160, epaisseur: 20, diametre: 210 },
      isChute: false,
      quantity: 1 
    }
  ])
  const [isPending, setIsPending] = useState(false)
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')

  const [quickAddress, setQuickAddress] = useState('')
  const [quickZip, setQuickZip] = useState('')
  const [quickCity, setQuickCity] = useState('')
  const [quickCountry, setQuickCountry] = useState('France')
  const [quickEmail, setQuickEmail] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickCompany, setQuickCompany] = useState('')

  const [options, setOptions] = useState({
    isTTC: true,
    discountPercent: 0,
    dueDate: '',         
    paymentMethod: ''    
  })

  useEffect(() => {
    if (initialData) {
      if (initialData.clientId) {
        setSelectedClientId(initialData.clientId)
        const client = clients.find(c => c.id === initialData.clientId) || initialData.client
        if (client) setClientSearch(client.name)
      }
      
      if (initialData.brand) {
        setBrand(initialData.brand)
      }

      setOptions({
        isTTC: initialData.isTTC ?? true, 
        discountPercent: initialData.items?.[0]?.discountPercent || 0,
        dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
        paymentMethod: initialData.paymentMethod || ''
      })

      if (initialData.products && Array.isArray(initialData.products) && initialData.products.length > 0) {
        const loadedProducts = initialData.products.map((p: any, index: number) => {
          const correspondingItem = initialData.items?.[index]
          return {
            id: correspondingItem?.id || p.id || String(index + 1),
            family: p.family || 'FITTED',
            range: p.range || 'BASIQUE',
            fabricId: p.fabricId || correspondingItem?.fabricId || '',
            dims: p.dims ? { ...p.dims, epaisseur: p.dims.epaisseur || p.dims.bonnet || 20 } : { L: 200, l: 160, epaisseur: 20, diametre: 210 },
            isChute: p.isChute || false,
            quantity: p.quantity || correspondingItem?.quantityUnits || 1, 
            customName: p.customName || correspondingItem?.customName || '',
            customPriceHT: p.customPriceHT || Number(correspondingItem?.sellingPrice) || 0,
            customLaborMinutes: p.customLaborMinutes || Number(correspondingItem?.prodTimeMinutes) || 0,
            customFabricMeters: p.customFabricMeters || Number(correspondingItem?.quantityMeters) || 0,
            threadId: p.threadId || '',
            biasId: p.biasId || '',
            elasticId: p.elasticId || '',
            zipperId: p.zipperId || ''
          }
        })
        setProducts(loadedProducts)
      } else if (initialData.items && initialData.items.length > 0) {
        const loadedProducts = initialData.items.map((item: any, index: number) => {
          return {
            id: item.id || String(index + 1),
            family: 'CUSTOM', 
            range: 'BASIQUE',
            fabricId: item.fabricId || '',
            dims: { L: 200, l: 160, epaisseur: 20, diametre: 210 },
            isChute: false,
            quantity: item.quantityUnits || 1, 
            customName: item.customName || 'Article Importé Web',
            customPriceHT: Number(item.sellingPrice) || 0,
            customLaborMinutes: Number(item.prodTimeMinutes) || 0,
            customFabricMeters: Number(item.quantityMeters) || 0,
          }
        })
        setProducts(loadedProducts)
      }
    }
  }, [initialData, clients])

  const results = products.map(product => {
    const qty = product.quantity || 1 

    if (product.family === 'CUSTOM') {
      return {
        totalPriceHT: (Number(product.customPriceHT) || 0) * qty,
        mainFabricMeters: (Number(product.customFabricMeters) || 0) * qty, 
        laborMinutes: (Number(product.customLaborMinutes) || 0) * qty
      }
    }

    const fabric = fabrics.find(f => f.id === product.fabricId)
    const currentProductType = productTypes?.find(pt => pt.family === product.family)
    const baseLaborMinutes = currentProductType ? currentProductType.baseLaborTime : 30 

    // On passe des prix par défaut pour l'affichage en temps réel. 
    // Le vrai calcul exact avec la BDD se fait côté serveur à la sauvegarde.
    const thread = accessories?.find(a => a.id === product.threadId)
    const bias = accessories?.find(a => a.id === product.biasId)
    const elastic = accessories?.find(a => a.id === product.elasticId)
    const zipper = accessories?.find(a => a.id === product.zipperId)

    const dynamicSupplyPrices = {
      threadPerMeter: thread ? thread.pricePerUnit : 0.005,
      biasPerMeter: bias ? bias.pricePerUnit : 0.10,
      elasticPerMeter: elastic ? elastic.pricePerUnit : 0.20,
      zipperPerMeter: zipper ? zipper.pricePerUnit : 6.00
    }

    const baseCalculation = calculateNGProduction(
       product.family as 'FITTED' | 'ENVELOPE' | 'FLAT' | 'BOLSTER' | 'ROUND',
       product.range as 'BASIQUE' | 'MONACO' | 'TPR' | 'TR',
       product.dims,
      { mainPrice: Number(fabric?.pricePerMeter || 0), laize: Number(fabric?.width || 300) },
      baseLaborMinutes,               
      settings?.laborCostPerMin || 0.35, 
      settings?.marginRate || 2.5,
      dynamicSupplyPrices // 🟢 On passe les prix dynamiques au moteur front-end aussi
    )

    return {
      totalPriceHT: baseCalculation.totalPriceHT * qty,
      mainFabricMeters: baseCalculation.mainFabricMeters * qty,
      laborMinutes: baseCalculation.laborMinutes * qty
    }
  })

  const grandTotalHT = results.reduce((sum, res) => sum + res.totalPriceHT, 0)
  
  const totalMetersGlobal = results.reduce((sum, res, idx) => {
    const p = products[idx]
    if (p.isChute) return sum 
    if (p.family !== 'CUSTOM' && !p.fabricId) return sum 
    return sum + res.mainFabricMeters
  }, 0)

  const totalLaborMinutesGlobal = results.reduce((sum, res) => sum + res.laborMinutes, 0)

  const addProduct = () => {
    setProducts([...products, {
      id: `${products.length + 1}`,
      family: 'FITTED',
      range: 'BASIQUE',
      fabricId: '',
      dims: { L: 200, l: 160, epaisseur: 20, diametre: 210 },
      isChute: false,
      quantity: 1 
    }])
  }

  const removeProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id))
  }

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const updateDims = (id: string, newDims: any) => {
    setProducts(products.map(p => p.id === id ? { ...p, dims: newDims } : p))
  }

  const handleSave = async () => {
    const invalidProducts = products.filter(p => p.family !== 'CUSTOM' && !p.fabricId)
    if (invalidProducts.length > 0) return alert("Choisis un tissu pour tes articles classiques !")
    
    setIsPending(true)

    const priceWithTax = options.isTTC ? grandTotalHT * 1.20 : grandTotalHT
    const finalPriceWithDiscount = priceWithTax * (1 - (options.discountPercent || 0) / 100)
    
    const payload = { 
      products, 
      clientId: selectedClientId || null, 
      brand, 
      isTTC: options.isTTC, 
      discountPercent: options.discountPercent, 
      dueDate: options.dueDate, 
      paymentMethod: options.paymentMethod,
      totalPrice: finalPriceWithDiscount 
    }
    
    try {
      if (initialData?.id) {
        await updateQuoteFromCalculator(initialData.id, payload)
        alert("Devis modifié avec succès !")
      } else {
        await createQuoteFromCalculator(payload)
        alert("Devis enregistré avec succès !")
        setClientSearch('')
        setSelectedClientId('')
        setProducts([{ id: '1', family: 'FITTED', range: 'BASIQUE', fabricId: '', dims: { L: 200, l: 160, epaisseur: 20, diametre: 210 }, isChute: false, quantity: 1 }])
      }
    } catch (error) {
      alert("Une erreur est survenue.")
      console.error(error)
    }
    setIsPending(false)
  }

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))

  const handleDownloadPDF = async () => {
    const currentClient = clients.find(c => c.id === selectedClientId)

    const validProducts = products.map((p, idx) => {
      const res = results[idx]
      let rowPriceFinal = res.totalPriceHT
      if (options.isTTC) rowPriceFinal = rowPriceFinal * 1.20

      if (p.family === 'CUSTOM') {
        const customFabric = p.fabricId ? fabrics.find(f => f.id === p.fabricId) : null
        return {
          family: p.customName || 'Article sur mesure',
          range: '',
          fabric: { reference: customFabric ? customFabric.reference : '-', name: customFabric ? `Tissu: ${customFabric.name}` : 'Sans tissu fourni', pricePerMeter: customFabric ? customFabric.pricePerMeter : 0 },
          dims: { L: 0, l: 0, epaisseur: 0, diametre: 0 },
          mainFabricMeters: res.mainFabricMeters,
          laborMinutes: res.laborMinutes,
          totalPriceHT: rowPriceFinal, 
          quantity: p.quantity || 1
        }
      }

      const fabric = fabrics.find(f => f.id === p.fabricId)!
      return {
        family: p.family, range: p.range, fabric: { reference: fabric.reference, name: fabric.name, pricePerMeter: fabric.pricePerMeter }, dims: p.dims, mainFabricMeters: res.mainFabricMeters, laborMinutes: res.laborMinutes, totalPriceHT: rowPriceFinal, quantity: p.quantity || 1
      }
    })

    const quoteData = {
      id: initialData?.id || `DEV-${Date.now().toString().slice(-6)}`,
      reference: initialData?.reference || `DEV-${Date.now().toString().slice(-6)}`,
      totalPrice: options.isTTC ? grandTotalHT * 1.20 : grandTotalHT,
      isTTC: options.isTTC,
      discountPercent: options.discountPercent,
      brand, 
      products: validProducts,
      client: currentClient 
        ? { name: currentClient.name, address: (currentClient as any).address, zipCode: (currentClient as any).zipCode, city: (currentClient as any).city, country: (currentClient as any).country, company: (currentClient as any).company, email: (currentClient as any).email, phone: (currentClient as any).phone } 
        : { name: "Client Inconnu" }
    }

    try {
      const pdfBlob = await generateQuotePDF(quoteData)
      if (!pdfBlob) return
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `Devis_${quoteData.reference}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pdfUrl)
    } catch (error) {
      console.error(error)
    }
  }

  const isSaveDisabled = isPending || products.some(p => p.family !== 'CUSTOM' && !p.fabricId)

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
      {/* BANNER */}
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
        
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">🏢 Entité du Devis</label>
          <div className="flex gap-4">
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${brand === 'NG' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <input type="radio" name="brand" value="NG" checked={brand === 'NG'} onChange={(e) => setBrand(e.target.value as any)} className="hidden" />
              Nicole Germain
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${brand === 'VOSGIA' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <input type="radio" name="brand" value="VOSGIA" checked={brand === 'VOSGIA'} onChange={(e) => setBrand(e.target.value as any)} className="hidden" />
              Vosgia
            </label>
            <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${brand === 'NONE' ? 'border-slate-500 bg-slate-100 text-slate-700 font-bold shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
              <input type="radio" name="brand" value="NONE" checked={brand === 'NONE'} onChange={(e) => setBrand(e.target.value as any)} className="hidden" />
              Anonyme
            </label>
          </div>
        </div>

        {/* CLIENT ASSIGNATION */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-3xl space-y-4">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider block">👤 Assignation du client</label>
          <div className="relative">
            <input 
              type="text"
              placeholder="Taper le nom d'un client (Optionnel)..."
              value={clientSearch}
              onChange={(e) => { setClientSearch(e.target.value); if (selectedClientId) setSelectedClientId('') }}
              className="w-full p-3 bg-white placeholder:text-slate-500 text-slate-900 font-bold text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm"
            />
            {clientSearch && filteredClients.length > 0 && !selectedClientId && (
              <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 text-xs font-bold divide-y divide-slate-100">
                {filteredClients.map((c: any) => (
                  <div key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch(c.name) }} className="p-3 hover:bg-indigo-50 cursor-pointer text-slate-800 transition-colors">
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!selectedClientId && !clientSearch && (
            <p className="text-[10px] text-slate-500 font-black flex items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
              💡 Ce devis n'est rattaché à aucun client (Devis Anonyme).
            </p>
          )}

          {clientSearch && !selectedClientId && !clients.some(c => c.name.toLowerCase() === clientSearch.toLowerCase().trim()) && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-sm">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">✨ Nouveau client détecté !</p>
              <input type="text" placeholder="Nom de la société (Optionnel)" value={quickCompany} onChange={(e) => setQuickCompany(e.target.value)} className="w-full p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold" />
              <input type="text" placeholder="Rue et numéro" value={quickAddress} onChange={(e) => setQuickAddress(e.target.value)} className="w-full p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold" />
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="Code Postal" value={quickZip} onChange={(e) => setQuickZip(e.target.value)} className="p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold text-center" />
                <input type="text" placeholder="Ville" value={quickCity} onChange={(e) => setQuickCity(e.target.value)} className="p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold" />
                <input type="text" placeholder="Pays" value={quickCountry} onChange={(e) => setQuickCountry(e.target.value)} className="p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold text-center" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="email" placeholder="Email (Optionnel)" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} className="p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold" />
                <input type="text" placeholder="Téléphone (Optionnel)" value={quickPhone} onChange={(e) => setQuickPhone(e.target.value)} className="p-2.5 bg-slate-50 placeholder:text-slate-500 text-slate-900 text-xs rounded-xl border border-slate-200 font-bold" />
              </div>
              <button type="button" onClick={async () => {
                if (!quickAddress || !quickZip || !quickCity) return alert("💡 Renseigne l'adresse complète !")
                const res = await createClientQuick({ name: clientSearch, address: quickAddress, zipCode: quickZip, city: quickCity, country: quickCountry, email: quickEmail, phone: quickPhone, company: quickCompany })
                if (!res.success) alert(res.error)
                else if (res.client){
                  alert(`✅ Client "${res.client.name}" créé !`)
                  const clientValide = res.client as any as Client
                  setClients([...clients, clientValide])
                  setSelectedClientId(clientValide.id)
                }
              }} className="w-full py-3 bg-emerald-600 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 uppercase tracking-wider">
                <UserPlus size={14} /> Enregistrer le Client
              </button>
            </div>
          )}

          {selectedClientId && (
            <p className="text-[10px] text-emerald-700 font-black flex items-center gap-1 bg-emerald-50 p-2 rounded-xl border border-emerald-200">
              <Check size={12}/> Client associé avec succès.
            </p>
          )}
        </div>

        {/* PRODUCTS LIST */}
        {products.map((product, idx) => {
          const res = results[idx]

          return (
            <div key={product.id} className="space-y-6 p-6 bg-slate-50 rounded-3xl border-2 border-slate-200 hover:border-indigo-300 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-500 rounded-2xl text-white">
                    <Layers size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Produit {idx + 1}</h3>
                </div>
                {products.length > 1 && (
                  <button onClick={() => removeProduct(product.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3 space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Layers size={16} /> Type de confection
                  </label>
                  <select 
                    value={product.family}
                    onChange={(e) => updateProduct(product.id, { family: e.target.value, fabricId: '' })} 
                    className="w-full p-4 bg-white text-slate-800 border border-slate-200 rounded-2xl font-bold outline-none"
                  >
                    <option value="FITTED">Drap Housse / Protège Matelas</option>
                    <option value="ENVELOPE">Housse de Couette / Taie</option>
                    <option value="FLAT">Drap Plat / Nappe</option>
                    <option value="BOLSTER">Traversin</option>
                    <option value="ROUND">Lit Rond / Couette Ronde</option>
                    <option value="CUSTOM">✨ Article Libre (Saisie manuelle)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-800 block text-center">Quantité</label>
                  <input 
                    type="number" 
                    min="1"
                    value={product.quantity || 1} 
                    onChange={e => updateProduct(product.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full p-4 rounded-2xl bg-white border border-slate-300 text-center font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
              </div>

              {product.family === 'CUSTOM' ? (
                <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-200 space-y-4">
                  <label className="text-sm font-bold text-slate-800">Création sur-mesure</label>
                  <input type="text" placeholder="Nom de l'article" value={product.customName || ''} onChange={e => updateProduct(product.id, { customName: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 placeholder:text-slate-500 text-slate-900 font-bold border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Prix de vente unitaire HT (€)" value={product.customPriceHT || ''} onChange={e => updateProduct(product.id, { customPriceHT: parseFloat(e.target.value) || 0 })} className="w-full p-4 rounded-xl bg-slate-50 placeholder:text-slate-500 text-slate-900 font-bold border border-slate-200 outline-none" />
                    <input type="number" placeholder="Temps unitaire estimé (min)" value={product.customLaborMinutes || ''} onChange={e => updateProduct(product.id, { customLaborMinutes: parseInt(e.target.value) || 0 })} className="w-full p-4 rounded-xl bg-slate-50 placeholder:text-slate-500 text-slate-900 font-bold border border-slate-200 outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Tissu (Optionnel)</label>
                      <select value={product.fabricId} onChange={(e) => updateProduct(product.id, { fabricId: e.target.value })} className="w-full p-4 rounded-xl bg-slate-50 text-slate-900 text-sm font-bold border border-slate-200 outline-none">
                        <option value="">(Aucun tissu)</option>
                        {fabrics.map(f => <option key={f.id} value={f.id}>{f.reference} - {f.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Métrage unitaire déduit (m)</label>
                      <input type="number" placeholder="Ex: 1.5" step="0.1" disabled={!product.fabricId} value={product.customFabricMeters || ''} onChange={e => updateProduct(product.id, { customFabricMeters: parseFloat(e.target.value) || 0 })} className="w-full p-4 rounded-xl bg-slate-50 placeholder:text-slate-500 text-slate-900 font-bold border border-slate-200 outline-none disabled:opacity-50" />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-800">Gamme</label>
                      <select value={product.range} onChange={(e) => updateProduct(product.id, { range: e.target.value })} className="w-full p-4 bg-white text-slate-800 border border-slate-200 rounded-2xl font-bold outline-none">
                        <option value="BASIQUE">Standard / Basique</option>
                        <option value="MONACO">Monaco (Bicolore)</option>
                        <option value="TPR">TPR (Articulé)</option>
                        <option value="TR">TR (Tête Relevable)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-800">Tissu à utiliser</label>
                      <select value={product.fabricId} onChange={(e) => updateProduct(product.id, { fabricId: e.target.value })} className="w-full p-4 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-2xl font-black outline-none">
                        <option value="" className="text-slate-800 font-bold">Sélectionner dans le stock de l'atelier...</option>
                        {fabrics.map(f => <option key={f.id} value={f.id} className="text-slate-900 font-bold">{f.reference} — {f.name} ({Number(f.pricePerMeter).toFixed(2)}€/m)</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-100/60 rounded-3xl space-y-4 border border-slate-200/60">
                    <div className="flex items-center gap-2 text-slate-600 font-black text-xs uppercase tracking-wide">
                      <Ruler size={16} /> Dimensions de coupe (cm)
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      {product.family !== 'ROUND' ? (
                        <>
                          <input type="number" value={product.dims.L || ''} onChange={(e) => updateDims(product.id, { ...product.dims, L: Number(e.target.value) })} placeholder="Longueur" className="p-4 rounded-xl border border-slate-200 text-center font-black text-slate-900 bg-white placeholder:text-slate-500 outline-none" />
                          <input type="number" value={product.dims.l || ''} onChange={(e) => updateDims(product.id, { ...product.dims, l: Number(e.target.value) })} placeholder="Largeur" className="p-4 rounded-xl border border-slate-200 text-center font-black text-slate-900 bg-white placeholder:text-slate-500 outline-none" />
                          {product.family === 'FITTED' && (
                            <input type="number" value={product.dims.epaisseur || ''} onChange={(e) => updateDims(product.id, { ...product.dims, epaisseur: Number(e.target.value) })} placeholder="Épaisseur (cm)" className="p-4 rounded-xl border border-slate-200 text-center font-black text-slate-900 bg-white placeholder:text-slate-500 outline-none" />
                          )}
                        </>
                      ) : (
                        <input type="number" value={product.dims.diametre || ''} onChange={(e) => updateDims(product.id, { ...product.dims, diametre: Number(e.target.value) })} placeholder="Diamètre du lit rond" className="col-span-3 p-4 rounded-xl border border-slate-200 text-center font-black text-slate-900 bg-white placeholder:text-slate-500 outline-none" />
                      )}
                    </div>
                  </div>

                  {/* 🟢 NOUVEAU : BLOC MERCERIE */}
                  <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      🧵 Fournitures Spécifiques
                    </label>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-600">Bobine de fil</label>
                        <select 
                          value={product.threadId || ''} 
                          onChange={(e) => updateProduct(product.id, { threadId: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                        >
                          <option value="">Fil standard par défaut</option>
                          {accessories?.filter(a => a.category.toLowerCase().includes('fil')).map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.pricePerUnit}€/m)</option>
                          ))}
                        </select>
                      </div>

                      {(product.family === 'ENVELOPE' || product.family === 'ROUND') && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-600">Fermeture au mètre</label>
                          <select 
                            value={product.zipperId || ''} 
                            onChange={(e) => updateProduct(product.id, { zipperId: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                          >
                            <option value="">Fermeture par défaut</option>
                            {accessories?.filter(a => a.category.toLowerCase().includes('fermeture') || a.category.toLowerCase().includes('zip')).map(a => (
                              <option key={a.id} value={a.id}>{a.name} ({a.pricePerUnit}€/m)</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {product.family === 'FITTED' && (
                        <>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600">Biais</label>
                            <select 
                              value={product.biasId || ''} 
                              onChange={(e) => updateProduct(product.id, { biasId: e.target.value })}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                            >
                              <option value="">Biais par défaut</option>
                              {accessories?.filter(a => a.category.toLowerCase().includes('biais')).map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.pricePerUnit}€/m)</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-600">Élastique</label>
                            <select 
                              value={product.elasticId || ''} 
                              onChange={(e) => updateProduct(product.id, { elasticId: e.target.value })}
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none"
                            >
                              <option value="">Élastique par défaut</option>
                              {accessories?.filter(a => a.category.toLowerCase().includes('elastique') || a.category.toLowerCase().includes('élastique')).map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({a.pricePerUnit}€/m)</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {(product.family === 'CUSTOM' || product.fabricId) && (
                <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-200 text-sm mt-4">
                  <div className="flex justify-between font-medium text-slate-600">
                    <span className="font-black text-indigo-900">Total ligne : {res.totalPriceHT.toFixed(2)} € HT</span>
                    <span className="font-bold text-slate-700">{res.mainFabricMeters.toFixed(1)}m | {res.laborMinutes}min {product.quantity > 1 && `(Saisie pour ${product.quantity} pièces)`}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* INVOICE OPTIONS */}
        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4 my-6">
          <h4 className="font-bold text-sm text-slate-800 font-serif">Options de facturation</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">À faire avant le :</label>
              <input type="date" value={options.dueDate} onChange={e => setOptions({...options, dueDate: e.target.value})} className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Moyen de paiement :</label>
              <select value={options.paymentMethod} onChange={e => setOptions({...options, paymentMethod: e.target.value})} className="w-full p-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500">
                <option value="">(En attente / Non défini)</option>
                <option value="CB">Carte Bancaire</option>
                <option value="VIREMENT">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="ESPECES">Espèces</option>
              </select>
            </div>
            <label className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200 cursor-pointer hover:bg-slate-100/50 transition-colors">
              <input type="checkbox" checked={options.isTTC} onChange={(e) => setOptions({ ...options, isTTC: e.target.checked })} className="rounded text-indigo-600 h-4 w-4" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Prix TTC (+20%)</p>
                <p className="text-slate-500 font-medium">Client particulier</p>
              </div>
            </label>
            <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800 whitespace-nowrap">Remise commerciale :</span>
              <div className="relative flex-1">
                <input type="number" value={options.discountPercent || ''} onChange={(e) => setOptions({ ...options, discountPercent: parseFloat(e.target.value) || 0 })} min="0" max="100" placeholder="0" className="w-full text-right pr-7 py-2.5 px-3 border border-slate-300 rounded-xl text-sm font-black text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500" />
                <span className="absolute right-3 top-2 text-sm font-black text-slate-500">%</span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM TOTAL BANNER */}
        <div className="p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-indigo-200 text-xs font-bold uppercase mb-1">Total Commande {options.isTTC ? 'TTC' : 'HT'}</p>
              <p className="text-4xl font-black">
  {(
    (options.isTTC ? grandTotalHT * 1.2 : grandTotalHT) * 
    (1 - (options.discountPercent || 0) / 100)
  ).toFixed(2)} €
</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-medium text-indigo-100">Métrage global : <strong className="text-white font-mono text-base">{totalMetersGlobal.toFixed(1)} m</strong></p>
              <p className="font-medium text-indigo-100">Couture globale : <strong className="text-white font-mono text-base">{totalLaborMinutesGlobal} min</strong></p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={isSaveDisabled} className="flex-1 py-4 bg-white text-indigo-600 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-100 transition-all disabled:opacity-50 shadow-lg">
              <Save size={20} />
              {isPending ? 'Enregistrement...' : (initialData?.id ? 'Mettre à jour le devis' : 'Créer le devis')}
            </button>
            <button onClick={addProduct} className="px-6 py-4 bg-white/80 text-indigo-700 rounded-2xl font-black flex items-center gap-2 hover:bg-white transition-all border border-indigo-200">
              <Plus size={20} /> Produit
            </button>
            <button onClick={handleDownloadPDF} disabled={isSaveDisabled} className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl font-black flex items-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50 shadow-lg">
              <Download size={20} /> PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}