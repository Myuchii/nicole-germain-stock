'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPartnerOrder } from '@/app/_actions/partner-actions'
import { UploadCloud, FileText, ChevronRight, ArrowLeft, Ruler, Layers, User, MapPin } from 'lucide-react'

const VEHICLE_MODELS = [
  { id: 'CENTRAL_COUPE', name: 'Lit Central avec Pans Coupés (Ex: Paris)', fields: ['A', 'B', 'C', 'D'] },
  { id: 'FRANCAIS_GAUCHE', name: 'Lit à la Française (Bord coupé Gauche)', fields: ['A', 'B', 'C'] },
  { id: 'FRANCAIS_DROIT', name: 'Lit à la Française (Bord coupé Droit)', fields: ['A', 'B', 'D'] },
  { id: 'RECTANGLE', name: 'Lit Rectangulaire Standard', fields: ['A', 'B'] },
]

export default function NouvelleCommandePartnerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState(VEHICLE_MODELS[0])
  const [cotes, setCotes] = useState<Record<string, string>>({ A: '', B: '', C: '', D: '' })
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // 🆕 État pour stocker la liste des tissus de la DB
  const [fabrics, setFabrics] = useState<any[]>([])

  // 🆕 Récupération des tissus réels au montage de la page
  useEffect(() => {
    async function loadFabrics() {
      try {
        const response = await fetch('/api/fabrics') // On va créer ce petit endpoint rapide
        if (response.ok) {
          const data = await response.json()
          setFabrics(data)
        }
      } catch (err) {
        console.error("Erreur chargement tissus:", err)
      }
    }
    loadFabrics()
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setBlueprintUrl('https://example.com/blueprints/blueprint_7681.png') 
    } catch (err) {
      alert("Erreur lors du téléversement.")
    } finally { // 🛠️ Correction : finaly -> finally
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!blueprintUrl) {
      alert("Le schéma de coupe est obligatoire.")
      return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    formData.append('blueprintUrl', blueprintUrl)
    formData.append('modelId', selectedModel.id)
    
    Object.entries(cotes).forEach(([key, val]) => {
      formData.append(`cote${key}`, val)
    })

    try {
      const res = await createPartnerOrder(formData)
      if (res.success) {
        router.push('/partner/dashboard')
      } else {
        alert(res.error || "Erreur lors de l'envoi.")
      }
    } catch (err) {
      console.error(err)
    } finally { // 🛠️ Correction : finaly -> finally
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
      
      <div className="flex items-start gap-4">
        <Link href="/partner/dashboard" className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 shadow-sm shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Nouvel Ordre de Fabrication B2B</h1>
          <p className="text-sm text-slate-500">Espace de saisie Matelas Camping-car.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-2 space-y-6">
          
          {/* SECTION 1 : CLIENT FINAL & ADRESSE DE LIVRAISON */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <User size={16} className="text-indigo-500" /> 1. Client Final & Coordonnées
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700">Nom & Prénom</label>
                <input required type="text" name="clientName" placeholder="Ex: FITOUR Mathieu" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Téléphone</label>
                <input type="tel" name="clientPhone" placeholder="Ex: 0685208195" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Email</label>
                <input type="email" name="clientEmail" placeholder="Ex: angeliquer1981@gmail.com" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>

              {/* 🆕 CHAMPS ADRESSE COMPLETS */}
              <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-slate-500 font-bold">
                <MapPin size={14}/> Adresse de livraison
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700">Rue / Lieudit</label>
                <input required type="text" name="clientAddress" placeholder="Ex: 106 Grande Rue" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Code Postal</label>
                <input required type="text" name="clientZipCode" placeholder="Ex: 86700" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Ville</label>
                <input required type="text" name="clientCity" placeholder="Ex: Valence en Poitou" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>
            </div>
          </div>

          {/* SECTION 2 : CONFIGURATION TECHNIQUE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Ruler size={16} className="text-indigo-500" /> 2. Gabarit & Côtes Techniques
            </h2>
            
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700">Modèle d'usine / Forme géométrique</label>
              <select className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium outline-none focus:border-indigo-500" onChange={(e) => {
                const model = VEHICLE_MODELS.find(m => m.id === e.target.value)
                if (model) setSelectedModel(model)
              }}>
                {VEHICLE_MODELS.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              {selectedModel.fields.map(field => (
                <div key={field} className="space-y-1 text-xs">
                  <label className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded">Côte {field} (cm)</label>
                  <input required type="number" value={cotes[field] || ''} onChange={(e) => setCotes({ ...cotes, [field]: e.target.value })} placeholder="Ex: 133" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none font-mono font-bold text-indigo-600 text-center text-sm focus:border-indigo-500" />
                </div>
              ))}
              <div className="space-y-1 text-xs">
                <label className="font-bold text-slate-700">Bonnet (cm)</label>
                <input type="number" name="bonnet" defaultValue="15" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none text-center font-bold" />
              </div>
            </div>
          </div>

          {/* SECTION 3 : CHOIX DU TISSU DYNAMIQUE */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" /> 3. Matière & Tissu d'Atelier
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1 sm:col-span-2">
                <label className="font-bold text-slate-700">Sélectionner le Tissu disponible</label>
                <select name="fabricId" required className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500 font-medium">
                  {fabrics.length === 0 ? (
                    <option value="">Chargement des matières...</option>
                  ) : (
                    fabrics.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.reference} — {f.name} ({f.color})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Quantité</label>
                <input required type="number" name="quantity" defaultValue="1" min="1" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none font-bold text-center" />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <label className="font-bold text-slate-700">Nom personnalisé de la pièce (Optionnel)</label>
                <input type="text" name="customName" placeholder="Ex: Sur-matelas Confort Luxe Poitou" className="w-full p-2.5 bg-slate-50 border rounded-xl outline-none focus:border-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : VALIDATION */}
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 sticky top-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <UploadCloud size={16} className="text-indigo-500" /> Schéma de coupe
            </h2>

            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-indigo-500 transition-colors bg-slate-50 relative group cursor-pointer">
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="space-y-2 text-xs">
                <UploadCloud size={28} className="mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <p className="font-bold text-slate-700">Téléverser le plan coté</p>
              </div>
            </div>

            {uploading && <p className="text-[11px] font-bold text-amber-600 text-center animate-pulse">Traitement...</p>}
            {blueprintUrl && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <FileText size={16} className="text-emerald-600 shrink-0" />
                <span className="font-medium truncate">Plan technique lié</span>
              </div>
            )}

            <button type="submit" disabled={loading || uploading || !blueprintUrl} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10">
              {loading ? 'Traitement...' : 'Envoyer à l\'Atelier NG'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}