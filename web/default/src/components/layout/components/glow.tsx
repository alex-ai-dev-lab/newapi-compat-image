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
import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const glowVariants = cva('absolute w-full', {
  variants: {
    variant: {
      top: 'top-0',
      above: '-top-[128px]',
      bottom: 'bottom-0',
      below: '-bottom-[128px]',
      center: 'top-[50%]',
    },
  },
  defaultVariants: {
    variant: 'top',
  },
})

export interface GlowProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glowVariants> {}

export function Glow({ className, variant, ...props }: GlowProps) {
  return (
    <div
      data-slot='glow'
      className={cn(glowVariants({ variant }), className)}
      {...props}
    >
      <div
        className={cn(
          'bg-border absolute left-1/2 h-px w-[60%] -translate-x-1/2 opacity-60',
          variant === 'center' && '-translate-y-1/2'
        )}
      />
      <div
        className={cn(
          'bg-chart-1/30 absolute left-1/2 mt-2 h-px w-[32%] -translate-x-1/2',
          variant === 'center' && '-translate-y-1/2'
        )}
      />
    </div>
  )
}
