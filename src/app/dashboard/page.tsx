import { PrismaClient } from '@prisma/client'
import StockTable from '@/components/StockTable'
import PriceCalculator from '@/components/PriceCalculator'

const prisma = new PrismaClient()

export default async function DashboardPage() {
  const fabrics = await prisma.fabric.findMany()

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header Élégant */}
        <header className="flex justify-between items-end border-b pb-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-900">Nicole Germain</h1>
            <p className="text-slate-500">Atelier de Confection • Gestion d'Inventaire</p>
          </div>
          <div className="text-right">
            <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {new Date().toLocaleDateString('fr-FR')}
            </span>
          </div>
        </header>

        {/* Statistiques Rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 uppercase tracking-wider">Tissus en stock</p>
            <p className="text-3xl font-bold">{fabrics.length}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500 uppercase tracking-wider">Alertes Stock</p>
            <p className="text-3xl font-bold text-red-500">
              {fabrics.filter(f => (f.stockMeters || 0) < (f.alertThresholdMeters || 0)).length}
            </p>
          </div>
        </div>

        {/* Contenu Principal */}
        <div className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <StockTable fabrics={fabrics} />
          </div>
          <div className="lg:col-span-5">
            <PriceCalculator fabrics={fabrics} />
          </div>
        </div>
      </div>
    </main>
  )
}