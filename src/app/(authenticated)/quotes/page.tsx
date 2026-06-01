// app/(authenticated)/quotes/page.tsx
import { PrismaClient } from '@prisma/client'
import UniversalConfigurator from '@/components/UniversalConfigurator'
import { FileText, Check, Trash2, Building2, MapPin } from 'lucide-react' // 🆕 Ajout de MapPin
import { validateQuote, deleteQuote } from '@/app/_actions/quote-actions'
import { getAtelierSettings, getProductTypes } from '@/app/_actions/settings-actions' 

export const dynamic = 'force-dynamic'
const prisma = new PrismaClient()

export default async function QuotesPage() {
  const fabricsRaw = await prisma.fabric.findMany({ where: { isArchived: false } })
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } })
  const quotesRaw = await prisma.quote.findMany({
    where: { status: 'DRAFT' },
    include: { fabric: true, client: true },
    orderBy: { createdAt: 'desc' }
  })

  const settings = await getAtelierSettings()
  const productTypes = await getProductTypes()

  const fabrics = fabricsRaw.map(f => ({
    ...f,
    pricePerMeter: Number(f.pricePerMeter),
    pricePerUnit: Number(f.pricePerUnit),
  }))

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
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-serif font-bold text-slate-900">{quote.totalPrice.toFixed(2)} €</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-md">Brouillon</span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        Réf: {quote.reference}
                      </p>
                    </div>

                    {/* Bloc d'informations client enrichi */}
                    <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <p className="font-bold text-slate-800 flex items-center gap-1.5">
                        👤 {quote.client?.name || "Client non spécifié"}
                      </p>
                      
                      {/* 🆕 Affichage dynamique de la société si elle existe */}
                      {quote.client?.company && (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Building2 size={12} className="text-slate-400" /> {quote.client.company}
                        </p>
                      )}

                      {/* 🆕 Affichage dynamique du pays (ex: "France" ou "Belgique") */}
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400" /> {quote.client?.country || "France"}
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-400 font-mono">
                      Matière : {quote.fabric?.name} — {quote.quantity.toFixed(1)}m
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
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
            settings={settings}
            productTypes={productTypes}
          />
        </div>
      </div>
    </div>
  )
}