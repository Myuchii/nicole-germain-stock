// app/(authenticated)/clients/[id]/page.tsx
import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Building2, MapPin, Mail, Phone, FileText, CheckCircle, Clock, XCircle, Scissors, Package, Truck, Ruler } from 'lucide-react'

const prisma = new PrismaClient()

// 🛠️ Fonction utilitaire pour générer le bon badge selon l'état du devis/des articles
function getProductionStatusBadge(quote: any) {
  // 1. Si le devis n'est pas encore validé ou est annulé
  if (quote.status === 'DRAFT') {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg"><Clock size={14}/> Brouillon</span>
  }
  if (quote.status === 'CANCELLED') {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg"><XCircle size={14}/> Annulé</span>
  }

  // 2. Si VALIDÉ, on regarde où en sont les articles dans l'atelier
  const items = quote.items || []
  if (items.length === 0) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle size={14}/> Validé</span>
  }

  // On extrait tous les statuts des articles de ce devis
  const statuses = items.map((i: any) => i.statusProduction)

  // Logique de priorité (l'étape la plus en retard définit le statut global de la commande)
  if (statuses.includes('A_COUPER')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg"><Scissors size={14}/> À Couper</span>
  }
  if (statuses.includes('EN_COUTURE') || statuses.includes('COUTURE')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-lg"><Ruler size={14}/> En Couture</span>
  }
  if (statuses.includes('A_EXPEDIER') || statuses.includes('PRET')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-lg"><Package size={14}/> À Expédier</span>
  }
  if (statuses.every((s: string) => s === 'EXPEDIE' || s === 'LIVRE')) {
    return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><Truck size={14}/> Expédié</span>
  }

  // Fallback de sécurité
  return <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg"><CheckCircle size={14}/> Validé</span>
}


export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  
  const resolvedParams = await params
  const id = resolvedParams.id

  // 1. Récupération du client et de l'historique
  const client = await prisma.client.findUnique({
    where: { id: id },
    include: {
      quotes: {
        orderBy: { createdAt: 'desc' }, 
        include: { 
          fabric: true,
          items: true // 🆕 On inclut les articles pour pouvoir lire leur "statusProduction" !
        } 
      }
    }
  })

  if (!client) return notFound()

  // 2. Calcul des statistiques du client
  const validatedQuotes = client.quotes.filter(q => q.status === 'VALIDATED')
  const totalSpent = validatedQuotes.reduce((sum, q) => sum + Number(q.totalPrice), 0)
  const totalMeters = validatedQuotes.reduce((sum, q) => sum + Number(q.quantity), 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      
      {/* BOUTON RETOUR */}
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft size={16} /> Retour à l'annuaire
      </Link>

      {/* EN-TÊTE DU CLIENT */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 justify-between items-start">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-serif text-3xl font-black">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-slate-900">{client.name}</h1>
              {client.company && (
                <p className="flex items-center gap-1.5 text-slate-500 font-medium mt-1">
                  <Building2 size={16} /> {client.company}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {client.email && <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Mail size={14}/> {client.email}</span>}
            {client.phone && <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100"><Phone size={14}/> {client.phone}</span>}
            {(client.city || client.zipCode) && (
              <span className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <MapPin size={14}/> {client.address}, {client.zipCode} {client.city} ({client.country})
              </span>
            )}
          </div>
        </div>

        {/* BLOC STATISTIQUES FINANCIÈRES */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl w-full md:w-auto min-w-[250px] shadow-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Chiffre d'affaires généré</p>
          <p className="text-4xl font-black text-emerald-400">{totalSpent.toFixed(2)} €</p>
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-sm">
            <span className="text-slate-300">Commandes : <strong className="text-white">{validatedQuotes.length}</strong></span>
            <span className="text-slate-300">Métrage : <strong className="text-white">{totalMeters.toFixed(1)}m</strong></span>
          </div>
        </div>
      </div>

      {/* HISTORIQUE DES DEVIS / COMMANDES */}
      <div className="space-y-6">
        <h2 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2">
          <FileText className="text-indigo-500" /> Historique complet
        </h2>

        {client.quotes.length === 0 ? (
          <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400 font-medium">
            Aucun historique pour ce client pour le moment.
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold">Référence</th>
                  <th className="p-4 font-bold">Tissu Principal</th>
                  <th className="p-4 font-bold text-right">Montant</th>
                  <th className="p-4 font-bold text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {client.quotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-medium text-slate-600">
                      {quote.createdAt.toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-4 text-sm font-mono text-slate-500">
                      {quote.reference}
                    </td>
                    <td className="p-4 text-sm font-medium text-slate-800">
                      {quote.fabric?.name || "Multiple"}
                      <span className="text-xs text-slate-400 block">{Number(quote.quantity).toFixed(1)} m</span>
                    </td>
                    <td className="p-4 text-sm font-black text-slate-900 text-right">
                      {Number(quote.totalPrice).toFixed(2)} €
                    </td>
                    <td className="p-4 flex justify-center">
                      {/* 🆕 Appel de notre fonction de badges dynamiques */}
                      {getProductionStatusBadge(quote)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}