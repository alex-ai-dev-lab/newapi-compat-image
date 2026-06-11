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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TimeRange } from './stats-api'

interface TimeRangeSelectorProps {
  value: TimeRange
  onChange: (value: TimeRange) => void
  className?: string
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1d', label: '1 Day' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
]

export function TimeRangeSelector({ value, onChange, className }: TimeRangeSelectorProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-md border p-1', className)}>
      {TIME_RANGES.map((range) => (
        <Button
          key={range.value}
          variant={value === range.value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => onChange(range.value)}
          className={cn(
            'h-8 px-3 text-xs',
            value === range.value && 'bg-secondary'
          )}
        >
          {range.label}
        </Button>
      ))}
    </div>
  )
}
