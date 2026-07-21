'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPartnerOrder, uploadToBlob } from '@/app/_actions/partner-actions'
import { UploadCloud, FileText, ChevronRight, ArrowLeft, Image as ImageIcon, CheckCircle } from 'lucide-react'

export default function NouvelleCommandePartnerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  // États pour les deux fichiers obligatoires
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [schemaUrl, setSchemaUrl] = useState<string | null>(null)
  
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadingSchema, setUploadingSchema] = useState(false)

  // 🟢 LA VRAIE FONCTION VERCEL BLOB CONNECTÉE
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'doc' | 'schema') => {
    const file = e.target.files?.[0]
    if (!file) return

    const isDoc = type === 'doc'
    if (isDoc) setUploadingDoc(true)
    else setUploadingSchema(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Envoi du vrai fichier au serveur pour Vercel Blob
      const result = await uploadToBlob(formData)

      if (result.url) {
        if (isDoc) {
          setDocUrl(result.url)
        } else {
          setSchemaUrl(result.url)
        }
      } else {
        alert(result.error || "Erreur de téléversement")
      }
    } catch (err) {
      console.error(err)
      alert("Une erreur est survenue lors de l'envoi du fichier.")
    } finally {
      if (isDoc) setUploadingDoc(false)
      else setUploadingSchema(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!docUrl || !schemaUrl) {
      alert("Les deux fichiers (le Bon de commande ET le Schéma) sont obligatoires.")
      return
    }

    setLoading(true)
    const formData = new FormData()
    
    formData.append('docUrl', docUrl)
    formData.append('schemaUrl', schemaUrl)
    formData.append('customName', 'Commande Camping-Car Double Fichier')

    try {
      const res = await createPartnerOrder(formData)
      if (res.success) {
        router.push('/partner/dashboard')
      } else {
        alert(res.error || "Erreur lors de l'envoi à l'atelier.")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen flex flex-col justify-center">
      
      {/* EN-TÊTE CHIRURGICAL */}
      <div className="flex items-start gap-4">
        <Link href="/partner/dashboard" className="p-2.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 shadow-sm shrink-0">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dépôt de Fiches Matelas</h1>
          <p className="text-sm text-slate-500">Importez les fichiers pour lancer la fabrication à l'atelier.</p>
        </div>
      </div>

      {/* ZONE DE FORMULAIRE */}
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-sm space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* FICHES 1 : LE BON DE COMMANDE WORD / TEXTE */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-500" /> 1. Bon de commande (.docx / .pdf)
            </label>
            
            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors relative group h-40 flex flex-col items-center justify-center ${docUrl ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-indigo-500 bg-slate-50'}`}>
              {/* 🟢 Changement ici pour appeler handleFileSelect */}
              <input type="file" accept=".doc,.docx,application/msword,application/pdf" onChange={(e) => handleFileSelect(e, 'doc')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              
              {docUrl ? (
                <div className="space-y-2 text-emerald-700 animate-in fade-in">
                  <CheckCircle size={28} className="mx-auto text-emerald-500" />
                  <p className="font-bold text-xs">Bon de commande chargé</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <UploadCloud size={28} className="mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <p className="font-bold text-slate-700">Glisser le fichier Word</p>
                  {uploadingDoc && <p className="text-[10px] font-bold text-amber-600 animate-pulse">Chargement...</p>}
                </div>
              )}
            </div>
          </div>

          {/* FICHES 2 : LE SCHÉMA TECHNIQUE DE LA FORME */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <ImageIcon size={14} className="text-indigo-500" /> 2. Schéma de la forme (Image / PDF)
            </label>
            
            <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors relative group h-40 flex flex-col items-center justify-center ${schemaUrl ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200 hover:border-indigo-500 bg-slate-50'}`}>
              {/* 🟢 Changement ici pour appeler handleFileSelect */}
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileSelect(e, 'schema')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              
              {schemaUrl ? (
                <div className="space-y-2 text-emerald-700 animate-in fade-in">
                  <CheckCircle size={28} className="mx-auto text-emerald-500" />
                  <p className="font-bold text-xs">Schéma technique chargé</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <UploadCloud size={28} className="mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <p className="font-bold text-slate-700">Glisser le dessin / gabarit</p>
                  {uploadingSchema && <p className="text-[10px] font-bold text-amber-600 animate-pulse">Chargement...</p>}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* BOUTON DE TRANSMISSION GLOBAL */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button 
            type="submit" 
            disabled={loading || uploadingDoc || uploadingSchema || !docUrl || !schemaUrl} 
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-colors disabled:opacity-40 flex items-center justify-center gap-2 shadow-md shadow-indigo-600/10"
          >
            {loading ? 'Transmission en cours...' : 'Envoyer le dossier complet à l\'atelier'}
            <ChevronRight size={14} />
          </button>
        </div>

      </form>
    </div>
  )
}