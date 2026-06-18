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

export const VENDOR_COLOURS: Record<string, string> = {
  OpenAI: 'var(--primary)',
  Google: 'color-mix(in oklch, var(--primary) 82%, var(--background))',
  ByteDance: 'color-mix(in oklch, var(--primary) 72%, var(--foreground))',
  Alibaba: 'color-mix(in oklch, var(--primary) 55%, var(--background))',
  Cohere: 'color-mix(in oklch, var(--primary) 38%, var(--background))',
  Zhipu: 'color-mix(in oklch, var(--primary) 26%, var(--background))',
  DeepSeek: 'var(--chart-1)',
  Mistral: 'color-mix(in oklch, var(--chart-1) 82%, var(--foreground))',
  Moonshot: 'color-mix(in oklch, var(--chart-1) 58%, var(--background))',
  Meta: 'var(--muted-foreground)',
  MiniMax: 'color-mix(in oklch, var(--muted-foreground) 62%, var(--background))',
  Anthropic: 'var(--chart-1)',
  xAI: 'var(--foreground)',
  Tencent: 'var(--success)',
  Baidu: 'var(--destructive)',
  Others: 'var(--border)',
}

export const FALLBACK_PALETTE = [
  'var(--primary)',
  'color-mix(in oklch, var(--primary) 82%, var(--background))',
  'color-mix(in oklch, var(--primary) 66%, var(--background))',
  'color-mix(in oklch, var(--primary) 48%, var(--background))',
  'var(--chart-1)',
  'color-mix(in oklch, var(--chart-1) 76%, var(--foreground))',
  'color-mix(in oklch, var(--chart-1) 58%, var(--background))',
  'var(--success)',
  'var(--warning)',
  'var(--destructive)',
  'var(--muted-foreground)',
  'color-mix(in oklch, var(--muted-foreground) 70%, var(--background))',
  'color-mix(in oklch, var(--foreground) 42%, var(--background))',
  'var(--border)',
]

/**
 * Build a color map for a list of vendor names.
 * Uses VENDOR_COLOURS for known vendors, FALLBACK_PALETTE for unknown.
 */
export function buildVendorColourMap(names: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  let fallbackIdx = 0

  for (const name of names) {
    if (VENDOR_COLOURS[name]) {
      result[name] = VENDOR_COLOURS[name]
    } else {
      result[name] = FALLBACK_PALETTE[fallbackIdx % FALLBACK_PALETTE.length]
      fallbackIdx++
    }
  }

  return result
}
