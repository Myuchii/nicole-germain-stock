// app/(authenticated)/quotes/page.tsx
import { PrismaClient } from '@prisma/client'
import UniversalConfigurator from '@/components/UniversalConfigurator' // Ton nouveau moteur
import { FileText, History, Check, Trash2 } from 'lucide-react'
import { createQuoteFromCalculator, validateQuote, deleteQuote } from '@/app/_actions/quote-actions' // On va les créer

export const dynamic = 'force-dynamic'
const prisma = new PrismaClient()

export default async function QuotesPage() {
  const fabricsRaw = await prisma.fabric.findMany({ where: { isArchived: false } }) // On exclut les archivés
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } }) // 🆕 On charge les clients
  const quotesRaw = await prisma.quote.findMany({
    where: { status: 'DRAFT' },
    include: { fabric: true, client: true },
    orderBy: { createdAt: 'desc' }
  })

  // Nettoyage des tissus
  const fabrics = fabricsRaw.map(f => ({
    ...f,
    pricePerMeter: Number(f.pricePerMeter),
    pricePerUnit: Number(f.pricePerUnit),
  }))

  // Dans votre liste de devis en attente, bouton "Valider" appelle :
  const handleValidate = async (quoteId: string) => {
    await validateQuote(quoteId)
    // Redirige vers /orders ou refresh
  }
  // Nettoyage des devis
  const quotes = quotesRaw.map(q => ({
    ...q,
    totalPrice: Number(q.totalPrice),
    quantity: Number(q.quantity),
  }))

  return (
    <div className="grid lg:grid-cols-12 gap-10">
      {/* COLONNE GAUCHE : LISTE DES DEVIS */}
      <div className="lg:col-span-6 space-y-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-slate-900">Gestion des Devis</h1>
          <p className="text-slate-500">Transformez vos calculs en commandes réelles.</p>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-serif font-bold flex items-center gap-2 text-slate-700">
            <FileText className="text-slate-800" /> Devis en attente
          </h2>
          
          {quotes.length === 0 ? (
            <div className="p-10 border-2 border-dashed border-slate-200 rounded-3xl text-center text-slate-400">
              Aucun devis en attente. Utilisez le calculateur à droite.
            </div>
          ) : (
            <div className="grid gap-4">
              {quotes.map((quote) => (
                <div key={quote.id} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-serif font-bold text-slate-900">{quote.totalPrice.toFixed(2)} €</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-md">Brouillon</span>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">
                      {quote.fabric?.name} — {quote.quantity}m
                    </p>
                    <p className="text-sm text-slate-500 font-medium">
                      👤 Client : <strong className="text-slate-700">{quote.client?.name || "Non spécifié"}</strong>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Matière : {quote.fabric?.name} — {quote.quantity.toFixed(1)}m
                    </p>
                  </div>
                  
                  
                  <div className="flex gap-3">
                    {/* Pour l'instant on utilise des formulaires simples pour les actions serveur */}
                    <form action={async () => { 'use server'; await validateQuote(quote.id); }}>
                      <button className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all">
                        <Check size={20} />
                      </button>
                    </form>

                    <form action={async () => { 'use server'; await deleteQuote(quote.id); }}>
                      <button className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
                        <Trash2 size={20} />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="sticky top-8">
          <UniversalConfigurator 
          fabrics={JSON.parse(JSON.stringify(fabrics))} 
          clients={JSON.parse(JSON.stringify(clients))} 
        />
        </div>
      </div> </div>
  )
}
