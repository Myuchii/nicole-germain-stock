'use client'
import { useState, useEffect } from 'react'
import { Plus, Search, User, Trash2, Building, ArrowRight } from 'lucide-react' // 🆕 Ajout de ArrowRight
import { getClients, deleteClient } from '@/app/_actions/client-actions'
import Link from 'next/link'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const data = await getClients()
      setClients(data)
      setLoading(false)
    }
    loadData()
  }, [])

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de l'annuaire...</div>

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Registre Clients</h1>
          <p className="text-slate-500">Fiches de contact pour la facturation et les devis sur mesure.</p>
        </div>
        <Link href="/clients/add">
          <button className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-indigo-600 transition-all shadow-lg">
            <Plus size={20} /> Nouveau Client
          </button>
        </Link>
      </div>

      {/* RECHERCHE */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un client, une entreprise..." 
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-medium" 
        />
      </div>

      {/* GRILLE DES CLIENTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.length === 0 ? (
          <p className="text-slate-400 italic text-center col-span-full py-12">Aucun client trouvé dans le registre.</p>
        ) : (
          filteredClients.map((c) => (
            <div key={c.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative flex flex-col justify-between group hover:border-indigo-100 transition-all">
              <div>
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-2xl ${c.company ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                    {c.company ? <Building size={20} /> : <User size={20} />}
                  </div>
                  <button 
                    onClick={async (e) => {
                      e.preventDefault(); // 🛡️ Évite de cliquer sur le lien par erreur
                      if (confirm(`Supprimer la fiche de ${c.name} ?`)) {
                        const res = await deleteClient(c.id)
                        if (!res.success) alert(res.error)
                        else window.location.reload()
                      }
                    }}
                    className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-4 space-y-1">
                  <h3 className="font-serif font-bold text-slate-900 text-lg">{c.name}</h3>
                  {c.company && <p className="text-sm text-indigo-800 font-bold tracking-wide uppercase">{c.company}</p>}
                </div>
                <div className="mt-4 space-y-1">
                  <h3 className="font-serif font-bold text-slate-900 text-sm">{c.address}</h3>
                  {c.zipCode && <p className="text-xs text-slate-500 uppercase">{c.zipCode} {c.city}</p>}
                  {c.country && <p className="text-xs text-slate-500 uppercase">{c.country}</p>}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 text-sm space-y-1.5 font-medium text-slate-500">
                  {c.email && <p>📧 {c.email}</p>}
                  {c.phone && <p>📞 {c.phone}</p>}
                </div>
              </div>

              {/* 🆕 BOUTON VERS L'HISTORIQUE CLIENT */}
              <div className="mt-6 pt-4 border-t border-slate-50">
                <Link href={`/clients/${c.id}`} className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-600 hover:text-white transition-colors">
                  Voir le dossier client <ArrowRight size={16} />
                </Link>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}