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
import { Search, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCommandPalette } from '@/stores/command-palette-store'
import { cn } from '@/lib/utils'

export function CommandPaletteTrigger() {
  const { open } = useCommandPalette()

  return (
    <Button
      variant="outline"
      className={cn(
        'relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64',
        'hover:bg-accent/50'
      )}
      onClick={open}
    >
      <Search className="mr-2 h-4 w-4" />
      <span className="hidden lg:inline-flex">Search...</span>
      <span className="inline-flex lg:hidden">Search</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
        <Command className="h-3 w-3" />
        K
      </kbd>
    </Button>
  )
}
