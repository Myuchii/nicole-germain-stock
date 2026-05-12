import { PrismaClient } from '@prisma/client'
import StockTable from '@/components/StockTable'
import PriceCalculator from '@/components/PriceCalculator'

const prisma = new PrismaClient()

export default async function Dashboard() {
  const fabrics = await prisma.fabric.findMany({
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
          🧵 Gestion Stocks - Nicole Germain
        </h1>
        <p className="text-xl text-gray-600">Inventaire tissus & Calculateur prix de vente</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <StockTable fabrics={fabrics} />
        <PriceCalculator fabrics={fabrics} />
      </div>
    </div>
  )
}