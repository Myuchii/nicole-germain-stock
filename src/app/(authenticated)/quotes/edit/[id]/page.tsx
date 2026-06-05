import { PrismaClient } from '@prisma/client'
import UniversalConfigurator from '@/components/UniversalConfigurator'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const prisma = new PrismaClient()

// 🆕 1. On déclare params comme étant une Promesse
export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  
  // 🆕 2. On "attend" de déballer les paramètres pour récupérer l'ID
  const { id } = await params

  // 1. Récupération du devis existant avec son client ET ses lignes de produits
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { 
      client: true,
      items: true 
    }
  })

  if (!quote) return notFound()

  // 2. Récupération des données référentielles
  const fabricsRaw = await prisma.fabric.findMany({ where: { isArchived: false } })
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } })

  const fabrics = fabricsRaw.map(f => ({
    ...f,
    pricePerMeter: Number(f.pricePerMeter),
    pricePerUnit: Number(f.pricePerUnit),
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/quotes" className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">
            Modifier le devis {quote.reference}
          </h1>
          <p className="text-sm text-slate-500">Client : {quote.client?.name}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <UniversalConfigurator 
          fabrics={JSON.parse(JSON.stringify(fabrics))} 
          clients={JSON.parse(JSON.stringify(clients))}
          initialData={JSON.parse(JSON.stringify(quote))} 
        />
      </div>
    </div>
  )
}