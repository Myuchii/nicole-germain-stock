// app/(authenticated)/clients/[id]/page.tsx
import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, MapPin, Mail, Phone, FileText } from 'lucide-react'
import ClientQuotesTableBody from '@/components/ClientQuotesTableBody'

const prisma = new PrismaClient()

export default async function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  
  const resolvedParams = await params
  const id = resolvedParams.id

  const client = await prisma.client.findUnique({
    where: { id: id },
    include: {
      quotes: {
        orderBy: { createdAt: 'desc' }, 
        include: { 
          fabric: true,
          items: true 
        } 
      }
    }
  })

  if (!client) return notFound()

  const validatedQuotes = client.quotes.filter(q => q.status === 'VALIDATED')
  const totalSpent = validatedQuotes.reduce((sum, q) => sum + Number(q.totalPrice), 0)
  
  const totalMeters = validatedQuotes.reduce((sum, q) => {
    const quoteSum = q.items && q.items.length > 0
      ? q.items.reduce((s, i) => s + (Number(i.quantityMeters) || 0), 0)
      : Number(q.quantity)
    return sum + quoteSum
  }, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft size={16} /> Retour à l'annuaire
      </Link>

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

        <div className="bg-slate-900 text-white p-6 rounded-3xl w-full md:w-auto min-w-[250px] shadow-lg">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Chiffre d'affaires généré</p>
          <p className="text-4xl font-black text-emerald-400">{totalSpent.toFixed(2)} €</p>
          <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between text-sm">
            <span className="text-slate-300">Commandes : <strong className="text-white">{validatedQuotes.length}</strong></span>
            <span className="text-slate-300">Métrage : <strong className="text-white">{totalMeters.toFixed(1)}m</strong></span>
          </div>
        </div>
      </div>

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
              
              {/* 🎯 FIX : On passe uniquement le tableau clean, sans fonction en prop */}
              <ClientQuotesTableBody quotes={client.quotes} />
              
            </table>
          </div>
        )}
      </div>

    </div>
  )
}