"use client"
import { useState, useEffect } from 'react'
import { Plus, Search, User, Trash2, Building, ArrowRight, Edit2, X, Save } from 'lucide-react'
import { getClients, deleteClient, updateClient } from '@/app/_actions/client-actions'
import Link from 'next/link'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // 🆕 ÉTATS POUR LA MODIFICATION
  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [formData, setFormData] = useState({
    name: '', company: '', email: '', phone: '', address: '', zipCode: '', city: '', country: 'France'
  })

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

  // 🆕 OUVRE LE FORMULAIRE DE MODIFICATION PRÉ-REMPLI
  const handleOpenEdit = (c: any) => {
    setEditingClient(c)
    setFormData({
      name: c.name || '',
      company: c.company || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      zipCode: c.zipCode || '',
      city: c.city || '',
      country: c.country || 'France'
    })
  }

  // 🆕 ENREGISTRE LES MODIFICATIONS
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await updateClient(editingClient.id, formData)

    if (res.success) {
      alert("✅ Fiche client modifiée avec succès !")
      // Mise à jour de la liste locale en temps réel
      setClients(clients.map(c => c.id === editingClient.id ? { ...c, ...formData } : c))
      setEditingClient(null)
    } else {
      alert(res.error)
    }
  }

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Chargement de l'annuaire...</div>

  return (
    <div className="space-y-8 relative">
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
        <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un client, une entreprise..." 
          className="w-full pl-12 pr-4 py-3 bg-white text-slate-500 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-medium" 
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
                  
                  {/* ZONE DES BOUTONS D'ACTION HAUT DROITE */}
                  <div className="flex gap-1">
                    {/* 🆕 BOUTON ÉDITION */}
                    <button 
                      onClick={() => handleOpenEdit(c)}
                      className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Modifier la fiche client"
                    >
                      <Edit2 size={16} />
                    </button>

                    <button 
                      onClick={async (e) => {
                        e.preventDefault();
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
                </div>

                <div className="mt-4 space-y-1">
                  <h3 className="font-serif font-bold text-slate-900 text-lg">{c.name}</h3>
                  {c.company && <p className="text-sm text-indigo-800 font-bold tracking-wide uppercase">{c.company}</p>}
                </div>
                <div className="mt-4 space-y-1">
                  <h3 className="font-serif font-bold text-slate-900 text-sm">{c.address || 'Pas d\'adresse renseignée'}</h3>
                  {(c.zipCode || c.city) && <p className="text-xs text-slate-500 uppercase">{c.zipCode} {c.city}</p>}
                  {c.country && <p className="text-xs text-slate-500 uppercase">{c.country}</p>}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 text-sm space-y-1.5 font-medium text-slate-500">
                  {c.email && <p>📧 {c.email}</p>}
                  {c.phone && <p>📞 {c.phone}</p>}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-50">
                <Link href={`/clients/${c.id}`} className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-600 hover:text-white transition-colors">
                  Voir le dossier client <ArrowRight size={16} />
                </Link>
              </div>

            </div>
          ))
        )}
      </div>

      {/* 🆕 FENÊTRE MODALE INTERACTIVE POUR L'ÉDITION */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <form 
            onSubmit={handleSaveEdit}
            className="bg-white rounded-[2rem] border border-slate-100 p-8 max-w-xl w-full shadow-2xl space-y-5 transform scale-100 transition-transform"
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">Modification</span>
                <h2 className="text-xl font-serif font-bold text-slate-900 mt-1">Fiche de {editingClient.name}</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingClient(null)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Nom complet *</label>
                <input 
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Société / Entreprise</label>
                <input 
                  type="text"
                  value={formData.company}
                  onChange={e => setFormData({...formData, company: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Email</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Téléphone</label>
                <input 
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Rue et numéro (Adresse)</label>
                <input 
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 text-center block">Code Postal</label>
                  <input 
                    type="text"
                    value={formData.zipCode}
                    onChange={e => setFormData({...formData, zipCode: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 text-center rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-bold text-slate-600">Ville</label>
                  <input 
                    type="text"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Pays</label>
                <input 
                  type="text"
                  value={formData.country}
                  onChange={e => setFormData({...formData, country: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3">
              <button 
                type="button" 
                onClick={() => setEditingClient(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs hover:bg-slate-200 transition-colors"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs flex items-center gap-1.5 hover:bg-indigo-700 transition-all shadow-md"
              >
                <Save size={14} /> Sauvegarder
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}