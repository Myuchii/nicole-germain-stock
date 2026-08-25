"use client"

import { useState, useEffect } from 'react'
import { Search, RotateCcw, Calendar, ShieldAlert } from 'lucide-react'
import { unarchiveQuote } from '@/app/_actions/quote-actions'
import ReturnSavModal from '@/components/ReturnSavModal' 

export default function ArchiveListClient({ initialOrders }: { initialOrders: any[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [search, setSearch] = useState('')
  const [filterReturn, setFilterReturn] = useState('ALL') 
  const [sortBy, setSortBy] = useState('NEWEST')

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  // 1. Filtrage et Recherche instantanée
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.reference.toLowerCase().includes(search.toLowerCase()) ||
      order.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.client?.company?.toLowerCase().includes(search.toLowerCase())

    const matchesReturn = 
      filterReturn === 'ALL' ? true :
      filterReturn === 'RETURN_ONLY' ? !!order.returnReason :
      filterReturn === 'NONE' ? !order.returnReason :
      order.returnReason === filterReturn

    return matchesSearch && matchesReturn
  })

  // 2. Tri par Date (🎯 FIX : On utilise la date de validation de commande, ou de création si introuvable)
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const dateA = new Date(a.validatedAt || a.createdAt).getTime()
    const dateB = new Date(b.validatedAt || b.createdAt).getTime()
    return sortBy === 'NEWEST' ? dateB - dateA : dateA - dateB
  })

  // Action de Restauration
  const handleRestore = async (id: string, ref: string) => {
    if (!confirm(`Voulez-vous réactiver la commande ${ref} et la renvoyer dans l'Atelier ?`)) return
    const res = await unarchiveQuote(id)
    if (res.success) {
      alert("🔄 Commande réactivée ! Elle est de nouveau visible dans l'Atelier.")
    }
  }

  return (
    <div className="space-y-6">
      {/* BARRE DE RECHERCHE ET FILTRES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Rechercher une réf, un client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <select
            value={filterReturn}
            onChange={e => setFilterReturn(e.target.value)}
            className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">📋 Tous les dossiers (Avec ou sans SAV)</option>
            <option value="NONE">✅ Commandes sans incident</option>
            <option value="RETURN_ONLY">⚠️ Tous les Retours / Litiges</option>
            <option value="Erreur Client / Changement d'avis">👤 Erreur Client / Changement d'avis</option>
            <option value="Défaut / Erreur Atelier (NG)">🧵 Erreur Atelier / Défaut produit</option>
            <option value="Retour Colis (Transporteur)">📦 Retour Colis (Problème Transporteur)</option>
          </select>
        </div>

        <div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="NEWEST">📅 Les plus récentes d'abord</option>
            <option value="OLDEST">📅 Les plus anciennes d'abord</option>
          </select>
        </div>
      </div>

      {/* LISTE DES COMPOSANTS ARCHIVÉS */}
      {sortedOrders.length === 0 ? (
        <div className="p-12 text-center text-slate-400 font-medium bg-white rounded-3xl border border-dashed">
          Aucun dossier trouvé avec ces filtres.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sortedOrders.map((order) => (
            <div key={order.id} className={`p-6 rounded-3xl border bg-white shadow-sm flex flex-col justify-between transition-all ${order.returnReason ? 'border-rose-200 bg-rose-50/10' : 'border-slate-100'}`}>
              
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400">Réf : {order.reference}</span>
                    <h3 className="font-bold text-slate-900 text-lg uppercase">{order.client?.name || 'Client inconnu'}</h3>
                    {order.client?.company && <p className="text-xs text-slate-500 font-semibold">{order.client.company}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-black text-slate-700 text-lg">{order.totalPrice.toFixed(2)} €</p>
                    {/* 🎯 FIX : Affichage de la date de validation de commande */}
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end" title="Date de validation de la commande">
                      <Calendar size={12}/> {new Date(order.validatedAt || order.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                {/* ITEMS INCLUS */}
                <div className="text-xs bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1 mb-4">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="text-slate-600 flex justify-between items-center">
                      <span>🧵 {item.fabric?.name || item.customName || 'Article Libre'}</span>
                      <span className="font-bold text-slate-400">{item.quantityMeters?.toFixed(1)}m</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MODULE SAV & ACTIONS */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
                
                <div className="w-full sm:w-auto">
                  <ReturnSavModal 
                    quoteId={order.id} 
                    currentReason={order.returnReason} 
                  />
                </div>

                {/* Bouton de Restauration */}
                <button
                  onClick={() => handleRestore(order.id, order.reference)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white font-black rounded-xl text-xs transition-all shadow-sm"
                >
                  <RotateCcw size={14} /> Réactiver
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  )
}