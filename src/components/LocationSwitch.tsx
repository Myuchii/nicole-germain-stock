'use client'

import { useState, useTransition } from 'react'
import { changeLotLocation } from '@/app/_actions/fabric-actions' // Adapte le chemin si besoin

interface LocationSwitchProps {
  lotId: string
  itemType: 'FABRIC' | 'ACCESSORY' | 'FINISHED_PRODUCT' | 'MERCHANDISE'
  currentLocation: 'ATELIER' | 'BOUTIQUE'
}

export default function LocationSwitch({ lotId, itemType, currentLocation }: LocationSwitchProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticLocation, setOptimisticLocation] = useState(currentLocation)

  const handleToggle = () => {
    const newLocation = optimisticLocation === 'ATELIER' ? 'BOUTIQUE' : 'ATELIER'
    
    // Mise à jour visuelle instantanée (sans attendre le serveur)
    setOptimisticLocation(newLocation)

    // Envoi de la requête au serveur en arrière-plan
    startTransition(() => {
      changeLotLocation(lotId, itemType, newLocation)
    })
  }

  return (
    <button 
      onClick={handleToggle}
      disabled={isPending}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
        optimisticLocation === 'ATELIER' 
          ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200' 
          : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
      }`}
    >
      {optimisticLocation === 'ATELIER' ? '🧵 Atelier' : '🛍️ Boutique'}
      <span className="text-[10px] opacity-50 ml-1">(Changer)</span>
    </button>
  )
}