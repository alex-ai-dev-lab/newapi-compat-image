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

/**
 * Vendor color palette for rankings and charts.
 *
 * v3 Design System:
 * - Restrained blue scale as primary (#0070f3 → #cadff9)
 * - Teal (#3aa89f) and slate (#64748b) accents
 * - NO purple/violet colors
 * - Use luminosity/saturation gradients to differentiate vendors
 *
 * Color collision resolution:
 * - Previous: 4 pairs shared identical colors
 * - Solution: Use brightness/gray scale variations within blue/teal/slate families
 */
export const VENDOR_COLOURS: Record<string, string> = {
  // Primary blue scale
  OpenAI: '#0070f3',      // v3 primary blue
  Google: '#5a9bf0',      // v3 blue-2 (lighter than OpenAI)
  ByteDance: '#2563eb',   // deeper blue (distinct from Google)
  Alibaba: '#9cc4f5',     // v3 blue-3 (much lighter)
  Cohere: '#bfdbfe',      // pale blue (distinct from Alibaba)
  Zhipu: '#cadff9',       // v3 blue-4 (palest)

  // Teal/cyan accents
  DeepSeek: '#3aa89f',    // v3 teal
  Mistral: '#14b8a6',     // brighter teal (distinct from DeepSeek)
  Moonshot: '#5eead4',    // light teal (was #ec4899 magenta, too vivid for blue-gray base)

  // Slate/gray accents
  Meta: '#64748b',        // v3 slate
  MiniMax: '#94a3b8',     // lighter slate (distinct from Meta)

  // Special colors
  Anthropic: '#F0794A',   // v3 warn (coral orange)
  xAI: '#111111',         // v3 ink (dark)
  Tencent: '#16a34a',     // v3 success green
  Baidu: '#dc4d47',       // v3 error red
  Others: '#cbd5e1',      // neutral light gray
}

/**
 * Fallback palette for unknown vendors.
 * Extended to 14 colors to avoid early cycling when many vendors present.
 * Constrained to blue/teal/slate/neutral gradients (NO purple).
 */
export const FALLBACK_PALETTE = [
  // Blue scale (6 shades)
  '#0070f3',  // primary
  '#2563eb',  // deep
  '#5a9bf0',  // mid
  '#9cc4f5',  // light
  '#bfdbfe',  // pale
  '#cadff9',  // palest

  // Teal/cyan scale (3 shades)
  '#3aa89f',  // primary teal
  '#14b8a6',  // bright teal
  '#5eead4',  // light teal

  // Slate/gray scale (5 shades)
  '#64748b',  // primary slate
  '#94a3b8',  // light slate
  '#cbd5e1',  // pale gray
  '#475569',  // dark slate
  '#1e293b',  // darkest slate
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
