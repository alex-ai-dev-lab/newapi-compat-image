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
import { cn } from '@/lib/utils'

type StatItemTone = 'default' | 'success' | 'destructive' | 'accent'

interface StatItem {
  label: string
  value: string | number
  tone?: StatItemTone
}

const toneClasses: Record<StatItemTone, string> = {
  default: 'text-muted-foreground',
  success: 'text-green-600 dark:text-green-400',
  destructive: 'text-red-600 dark:text-red-400',
  accent: 'text-blue-600 dark:text-blue-400',
}

export function InlineStatsBar({
  items,
  className,
}: {
  items: StatItem[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-xs',
        className
      )}
    >
      {items.map((item, index) => (
        <div key={index} className='flex items-center gap-1.5'>
          <span className='text-muted-foreground'>{item.label}</span>
          <span
            className={cn(
              'font-medium tabular-nums',
              toneClasses[item.tone ?? 'default']
            )}
          >
            {item.value}
          </span>
          {index < items.length - 1 && (
            <span className='text-muted-foreground/40'>·</span>
          )}
        </div>
      ))}
    </div>
  )
}
