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

export type CanvasChartColors = {
  background: string
  foreground: string
  mutedForeground: string
  border: string
  primary: string
  chart1: string
  success: string
  warning: string
  destructive: string
  text: string
  grid: string
  series: string[]
}

const LIGHT_CANVAS_CHART_COLORS: CanvasChartColors = {
  background: 'rgb(255, 255, 255)',
  foreground: 'rgb(23, 23, 23)',
  mutedForeground: 'rgb(115, 115, 115)',
  border: 'rgb(229, 229, 229)',
  primary: 'rgb(23, 23, 23)',
  chart1: 'rgb(234, 88, 12)',
  success: 'rgb(5, 150, 105)',
  warning: 'rgb(217, 119, 6)',
  destructive: 'rgb(220, 38, 38)',
  text: 'rgba(23, 23, 23, 0.58)',
  grid: 'rgba(23, 23, 23, 0.12)',
  series: [
    'rgb(23, 23, 23)',
    'rgb(64, 64, 64)',
    'rgb(82, 82, 82)',
    'rgb(115, 115, 115)',
    'rgb(234, 88, 12)',
    'rgb(194, 65, 12)',
    'rgb(251, 146, 60)',
    'rgb(5, 150, 105)',
    'rgb(217, 119, 6)',
    'rgb(220, 38, 38)',
    'rgb(163, 163, 163)',
    'rgb(212, 212, 212)',
  ],
}

const DARK_CANVAS_CHART_COLORS: CanvasChartColors = {
  background: 'rgb(30, 30, 30)',
  foreground: 'rgb(245, 245, 245)',
  mutedForeground: 'rgb(190, 190, 190)',
  border: 'rgba(255, 255, 255, 0.16)',
  primary: 'rgb(245, 245, 245)',
  chart1: 'rgb(249, 115, 22)',
  success: 'rgb(52, 211, 153)',
  warning: 'rgb(251, 191, 36)',
  destructive: 'rgb(248, 113, 113)',
  text: 'rgba(245, 245, 245, 0.68)',
  grid: 'rgba(245, 245, 245, 0.12)',
  series: [
    'rgb(245, 245, 245)',
    'rgb(214, 214, 214)',
    'rgb(180, 180, 180)',
    'rgb(145, 145, 145)',
    'rgb(249, 115, 22)',
    'rgb(251, 146, 60)',
    'rgb(194, 65, 12)',
    'rgb(52, 211, 153)',
    'rgb(251, 191, 36)',
    'rgb(248, 113, 113)',
    'rgb(115, 115, 115)',
    'rgb(82, 82, 82)',
  ],
}

export function getCanvasChartColors(theme?: string): CanvasChartColors {
  return theme === 'dark' ? DARK_CANVAS_CHART_COLORS : LIGHT_CANVAS_CHART_COLORS
}
