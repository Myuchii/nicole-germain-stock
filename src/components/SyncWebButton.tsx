'use client'

import { useState } from 'react'
import { syncPrestashopOrders } from '@/app/_actions/prestashop-actions'
import { RefreshCw } from 'lucide-react'

export default function SyncWebButton() {
  const [loading, setLoading] = useState(false)

  const handleSync = async () => {
    setLoading(true)
    const res = await syncPrestashopOrders()
    if (res.success) {
      alert(`🎉 Succès : ${res.message}`)
    } else {
      alert(`❌ Erreur : ${res.error}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
    >
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      {loading ? 'Aspiration du site...' : 'Synchroniser les commandes Web'}
    </button>
  )
}