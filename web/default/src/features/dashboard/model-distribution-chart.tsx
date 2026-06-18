/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { ModelStat } from './stats-api'

interface ModelDistributionChartProps {
  data: ModelStat[]
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
  'var(--success)',
  'var(--warning)',
]

export function ModelDistributionChart({ data }: ModelDistributionChartProps) {
  // Take top 8 models and group the rest as "Others"
  const topModels = data.slice(0, 8)
  const othersCount = data.slice(8).reduce((sum, model) => sum + model.total_requests, 0)

  const chartData = [
    ...topModels.map((model) => ({
      name: model.model_name,
      value: model.total_requests,
    })),
    ...(othersCount > 0 ? [{ name: 'Others', value: othersCount }] : []),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Distribution</CardTitle>
        <CardDescription>Request distribution by model</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name} ${(((percent ?? 0) as number) * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill='var(--primary)'
              dataKey="value"
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
