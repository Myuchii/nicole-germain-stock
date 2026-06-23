"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// 🔍 🆕 Mise à jour de l'interface pour accepter les données comparatives
interface RevenueChartProps {
  data: { label: string; current: number; previous: number }[]
}

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-72 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
            tickFormatter={(val) => `${val}€`} 
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ 
              borderRadius: '20px', 
              border: 'none', 
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.05)',
              padding: '12px 16px' 
            }}
            labelStyle={{ fontWeight: '800', color: '#1e293b', marginBottom: '6px', fontSize: '12px' }}
            itemStyle={{ fontSize: '12px', paddingTop: '2px', paddingBottom: '2px' }}
            // 🔍 Formateur mis à jour pour afficher les deux lignes distinctement dans la bulle
            formatter={(value: any, name: any) => [
              `${Number(value || 0).toFixed(2)} €`, 
              name === 'current' ? "Période Cible (N)" : "Année Précédente (N-1)"
            ]}
          />
                    {/* 📊 BARRE ANNEE PRECEDENTE (N-1) */}
          <Bar 
            dataKey="previous" 
            name="previous" 
            fill="#e2e8f0" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={32}
          />
          {/* 📊 BARRE ANNEE EN COURS (N) */}
          <Bar 
            dataKey="current" 
            name="current" 
            fill="#4f46e5" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={32}
          />
          
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}