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
import type { CanvasChartColors } from '@/lib/canvas-chart-colors'

export function getRankingFallbackPalette(colors: CanvasChartColors) {
  // Build from the high-contrast categorical series only, plus a few
  // semantic accents — never black/near-black or the muted border grey,
  // so stacked series stay visually distinct.
  return [
    ...colors.series,
    colors.chart1,
    colors.success,
    colors.warning,
    colors.destructive,
  ]
}

export function getVendorColours(
  colors: CanvasChartColors
): Record<string, string> {
  const s = colors.series
  return {
    OpenAI: s[0], // blue
    Google: s[1], // purple
    ByteDance: s[2], // amber
    Alibaba: s[3], // red
    Cohere: s[4], // teal
    Zhipu: s[5], // pink
    DeepSeek: s[6], // light teal
    Mistral: s[7], // orange
    Moonshot: s[8], // violet
    Meta: s[9], // green
    MiniMax: colors.warning,
    Anthropic: colors.chart1,
    xAI: colors.mutedForeground,
    Tencent: colors.success,
    Baidu: colors.destructive,
    Others: colors.mutedForeground,
  }
}

/**
 * Build a color map for a list of vendor names.
 * Uses VENDOR_COLOURS for known vendors, FALLBACK_PALETTE for unknown.
 */
export function buildVendorColourMap(
  names: string[],
  colors: CanvasChartColors
): Record<string, string> {
  const result: Record<string, string> = {}
  let fallbackIdx = 0
  const vendorColours = getVendorColours(colors)
  const fallbackPalette = getRankingFallbackPalette(colors)

  for (const name of names) {
    if (vendorColours[name]) {
      result[name] = vendorColours[name]
    } else {
      result[name] = fallbackPalette[fallbackIdx % fallbackPalette.length]
      fallbackIdx++
    }
  }

  return result
}
