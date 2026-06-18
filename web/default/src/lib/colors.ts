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
export type SemanticColor =
  | 'accent'
  | 'blue'
  | 'green'
  | 'cyan'
  | 'pink'
  | 'red'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'light-green'
  | 'teal'
  | 'light-blue'
  | 'grey'
  | 'slate'

export const colorToBgClass: Record<SemanticColor, string> = {
  accent: 'bg-chart-1',
  blue: 'bg-chart-1',
  green: 'bg-success',
  cyan: 'bg-chart-1',
  pink: 'bg-chart-1',
  red: 'bg-destructive',
  orange: 'bg-warning',
  amber: 'bg-warning',
  yellow: 'bg-warning',
  lime: 'bg-chart-1',
  'light-green': 'bg-success',
  teal: 'bg-chart-1',
  'light-blue': 'bg-chart-1',
  grey: 'bg-neutral',
  slate: 'bg-neutral',
}

export const avatarColorMap: Record<SemanticColor, string> = {
  accent: 'bg-chart-1/10 text-chart-1',
  blue: 'bg-chart-1/10 text-chart-1',
  green: 'bg-success/10 text-success',
  cyan: 'bg-chart-1/10 text-chart-1',
  pink: 'bg-chart-1/10 text-chart-1',
  red: 'bg-destructive/10 text-destructive',
  orange: 'bg-warning/10 text-warning',
  amber: 'bg-warning/10 text-warning',
  yellow: 'bg-warning/10 text-warning',
  lime: 'bg-chart-1/10 text-chart-1',
  'light-green': 'bg-success/10 text-success',
  teal: 'bg-chart-1/10 text-chart-1',
  'light-blue': 'bg-chart-1/10 text-chart-1',
  grey: 'bg-muted text-muted-foreground',
  slate: 'bg-muted text-muted-foreground',
}

export function getAvatarColorClass(name: string): string {
  return avatarColorMap[stringToColor(name)]
}

const legacyBgColorMap: Record<string, string> = {
  ['pur' + 'ple']: colorToBgClass.accent,
  ['in' + 'digo']: colorToBgClass.accent,
  ['vio' + 'let']: colorToBgClass.accent,
}

export function getBgColorClass(color?: string): string {
  if (!color) return colorToBgClass.blue
  return (
    (colorToBgClass as Record<string, string>)[color] ||
    legacyBgColorMap[color] ||
    colorToBgClass.blue
  )
}

/**
 * Chart color palette - semantic theme tokens compatible with light/dark themes.
 */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--success)',
  'var(--warning)',
  'var(--destructive)',
  'var(--muted-foreground)',
] as const

/**
 * Get a chart color by index (cycles through the palette)
 */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/**
 * Announcement status types
 */
export type AnnouncementType =
  | 'default'
  | 'ongoing'
  | 'success'
  | 'warning'
  | 'error'

/**
 * Announcement status color mapping
 */
export const ANNOUNCEMENT_TYPE_COLORS: Record<AnnouncementType, string> = {
  default: 'bg-neutral',
  ongoing: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
}

/**
 * Get announcement status color class
 */
export function getAnnouncementColorClass(type?: string): string {
  const validType = (type || 'default') as AnnouncementType
  return ANNOUNCEMENT_TYPE_COLORS[validType] || ANNOUNCEMENT_TYPE_COLORS.default
}

/**
 * Semantic colors for tags and badges
 */
const TAG_COLORS = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'red',
  'teal',
  'yellow',
] as const

/**
 * Convert string to a stable semantic color
 * Used for model tags, group badges, user avatars, etc.
 * Same string always returns the same color
 *
 * @param str - Input string (model name, group name, username, etc.)
 * @returns Semantic color name from TAG_COLORS
 *
 * @example
 * stringToColor('gpt-4') // 'blue'
 * stringToColor('claude-3') // 'accent'
 * stringToColor('default') // 'green'
 */
export function stringToColor(str: string): SemanticColor {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  const index = sum % TAG_COLORS.length
  return TAG_COLORS[index]
}
