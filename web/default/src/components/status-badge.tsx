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
/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { type LucideIcon } from 'lucide-react'
import { stringToColor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

export const dotColorMap = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  accent: 'bg-chart-1',
  info: 'bg-info',
  neutral: 'bg-neutral',
  amber: 'bg-warning',
  blue: 'bg-chart-1',
  cyan: 'bg-chart-1',
  green: 'bg-success',
  grey: 'bg-neutral',
  'light-blue': 'bg-info',
  'light-green': 'bg-success',
  lime: 'bg-chart-1',
  orange: 'bg-warning',
  pink: 'bg-chart-1',
  red: 'bg-destructive',
  teal: 'bg-chart-1',
  yellow: 'bg-warning',
} as const

export const textColorMap = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  accent: 'text-chart-1',
  info: 'text-info',
  neutral: 'text-muted-foreground',
  amber: 'text-warning',
  blue: 'text-chart-1',
  cyan: 'text-chart-1',
  green: 'text-success',
  grey: 'text-muted-foreground',
  'light-blue': 'text-info',
  'light-green': 'text-success',
  lime: 'text-chart-1',
  orange: 'text-warning',
  pink: 'text-chart-1',
  red: 'text-destructive',
  teal: 'text-chart-1',
  yellow: 'text-warning',
} as const

const surfaceColorMap = {
  success: 'border-success/18 bg-success/10 dark:border-success/24 dark:bg-success/14',
  warning: 'border-warning/22 bg-warning/12 dark:border-warning/28 dark:bg-warning/14',
  danger:
    'border-destructive/18 bg-destructive/10 dark:border-destructive/24 dark:bg-destructive/14',
  accent: 'border-chart-1/22 bg-chart-1/12 dark:border-chart-1/26 dark:bg-chart-1/16',
  info: 'border-info/18 bg-info/10 dark:border-info/24 dark:bg-info/14',
  neutral:
    'border-border/70 bg-muted/55 text-muted-foreground dark:border-border/60 dark:bg-muted/28',
  amber: 'border-warning/22 bg-warning/12 dark:border-warning/28 dark:bg-warning/14',
  blue: 'border-chart-1/22 bg-chart-1/12 dark:border-chart-1/26 dark:bg-chart-1/16',
  cyan: 'border-chart-1/22 bg-chart-1/12 dark:border-chart-1/26 dark:bg-chart-1/16',
  green: 'border-success/18 bg-success/10 dark:border-success/24 dark:bg-success/14',
  grey:
    'border-border/70 bg-muted/55 text-muted-foreground dark:border-border/60 dark:bg-muted/28',
  'light-blue': 'border-info/18 bg-info/10 dark:border-info/24 dark:bg-info/14',
  'light-green':
    'border-success/18 bg-success/10 dark:border-success/24 dark:bg-success/14',
  lime: 'border-chart-1/22 bg-chart-1/12 dark:border-chart-1/26 dark:bg-chart-1/16',
  orange: 'border-warning/22 bg-warning/12 dark:border-warning/28 dark:bg-warning/14',
  pink: 'border-chart-1/22 bg-chart-1/12 dark:border-chart-1/26 dark:bg-chart-1/16',
  red: 'border-destructive/18 bg-destructive/10 dark:border-destructive/24 dark:bg-destructive/14',
  teal: 'border-chart-1/22 bg-chart-1/12 dark:border-chart-1/26 dark:bg-chart-1/16',
  yellow: 'border-warning/22 bg-warning/12 dark:border-warning/28 dark:bg-warning/14',
} as const

export type StatusVariant = keyof typeof dotColorMap

const sizeMap = {
  sm: 'h-6 gap-1.5 px-2 text-[11px] leading-none',
  md: 'h-6 gap-1.5 px-2 text-[11px] leading-none',
  lg: 'h-7 gap-1.5 px-2.5 text-xs leading-none',
} as const

export interface StatusBadgeProps extends Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> {
  label?: string
  children?: React.ReactNode
  icon?: LucideIcon
  pulse?: boolean
  /** Kept for compatibility. Badges no longer render leading dots. */
  showDot?: boolean
  variant?: StatusVariant | null
  size?: 'sm' | 'md' | 'lg' | null
  copyable?: boolean
  copyText?: string
  autoColor?: string
  truncateLabel?: boolean
}

export function StatusBadge({
  label,
  children,
  icon: Icon,
  variant,
  size = 'sm',
  pulse = false,
  showDot = true,
  copyable = true,
  copyText,
  autoColor,
  truncateLabel = true,
  className,
  onClick,
  ...props
}: StatusBadgeProps) {
  const { copyToClipboard } = useCopyToClipboard()

  const computedVariant: StatusVariant = autoColor
    ? (stringToColor(autoColor) as StatusVariant)
    : (variant ?? 'neutral')

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (copyable) {
      e.stopPropagation()
      copyToClipboard(copyText || label || '')
    }
    onClick?.(e)
  }

  const content =
    children ??
    (label ? (
      <span className={truncateLabel ? 'truncate' : undefined}>{label}</span>
    ) : null)

  return (
    <span
      className={cn(
        'inline-flex w-fit max-w-full shrink-0 items-center rounded-full border font-medium tracking-normal whitespace-nowrap transition-colors',
        sizeMap[size ?? 'sm'],
        surfaceColorMap[computedVariant],
        textColorMap[computedVariant],
        pulse && 'animate-pulse',
        copyable &&
          'cursor-copy hover:brightness-95 active:scale-95 dark:hover:brightness-110',
        className
      )}
      onClick={handleClick}
      title={copyable ? `Click to copy: ${copyText || label || ''}` : undefined}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block size-1.5 shrink-0 rounded-full',
            dotColorMap[computedVariant]
          )}
          aria-hidden='true'
        />
      )}
      {Icon && <Icon className='size-3.5 shrink-0' />}
      {content}
    </span>
  )
}

export interface StatusBadgeListProps<T> extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'children'
> {
  empty?: React.ReactNode
  getKey?: (item: T, index: number) => React.Key
  items: T[]
  max?: number
  moreLabel?: (remaining: number) => string
  renderItem: (item: T, index: number) => React.ReactNode
}

export function StatusBadgeList<T>(props: StatusBadgeListProps<T>) {
  const {
    className,
    empty = <span className='text-muted-foreground text-xs'>-</span>,
    getKey,
    items,
    max = 2,
    moreLabel,
    renderItem,
    ...domProps
  } = props

  if (items.length === 0) {
    return empty
  }

  const displayed = items.slice(0, max)
  const remaining = items.length - max

  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-1 overflow-hidden',
        className
      )}
      {...domProps}
    >
      {displayed.map((item, index) => (
        <React.Fragment key={getKey?.(item, index) ?? index}>
          {renderItem(item, index)}
        </React.Fragment>
      ))}
      {remaining > 0 && (
        <StatusBadge
          label={moreLabel?.(remaining) ?? `+${remaining}`}
          variant='neutral'
          size='sm'
          copyable={false}
          className='shrink-0'
        />
      )}
    </div>
  )
}

export const statusPresets = {
  active: {
    variant: 'success' as const,
    label: 'Active',
  },
  inactive: {
    variant: 'neutral' as const,
    label: 'Inactive',
  },
  invited: {
    variant: 'info' as const,
    label: 'Invited',
  },
  suspended: {
    variant: 'danger' as const,
    label: 'Suspended',
  },
  pending: {
    variant: 'warning' as const,
    label: 'Pending',
    pulse: true,
  },
} as const

export type StatusPreset = keyof typeof statusPresets
