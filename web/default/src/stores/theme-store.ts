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
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeColors {
  primary: string
  accent: string
  background: string
  foreground: string
}

interface ThemeStore {
  mode: ThemeMode
  fontSize: number
  primaryColor: string
  accentColor: string
  setMode: (mode: ThemeMode) => void
  setFontSize: (size: number) => void
  setPrimaryColor: (color: string) => void
  setAccentColor: (color: string) => void
  reset: () => void
}

const defaultTheme = {
  mode: 'system' as ThemeMode,
  fontSize: 14,
  primaryColor: '#0070f3', // v3 primary blue
  accentColor: '#3aa89f', // v3 teal accent (was #8b5cf6 violet)
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      ...defaultTheme,
      setMode: (mode) => {
        set({ mode })
        applyThemeMode(mode)
      },
      setFontSize: (fontSize) => {
        set({ fontSize })
        applyFontSize(fontSize)
      },
      setPrimaryColor: (primaryColor) => {
        set({ primaryColor })
        applyPrimaryColor(primaryColor)
      },
      setAccentColor: (accentColor) => {
        set({ accentColor })
        applyAccentColor(accentColor)
      },
      reset: () => {
        set(defaultTheme)
        applyThemeMode(defaultTheme.mode)
        applyFontSize(defaultTheme.fontSize)
        applyPrimaryColor(defaultTheme.primaryColor)
        applyAccentColor(defaultTheme.accentColor)
      },
    }),
    {
      name: 'newapi-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme immediately after rehydration
          applyThemeMode(state.mode)
          applyFontSize(state.fontSize)
          applyPrimaryColor(state.primaryColor)
          applyAccentColor(state.accentColor)
        }
      },
    }
  )
)

// Apply theme mode to document
function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

// Apply font size to document
function applyFontSize(size: number) {
  document.documentElement.style.setProperty('--font-size-base', `${size}px`)
}

// Convert hex to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 0 }

  let r = parseInt(result[1], 16) / 255
  let g = parseInt(result[2], 16) / 255
  let b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

// Apply primary color to document
function applyPrimaryColor(color: string) {
  const hsl = hexToHSL(color)
  document.documentElement.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`)
  // Adjust primary-foreground for contrast
  const fgLightness = hsl.l > 50 ? 10 : 98
  document.documentElement.style.setProperty(
    '--primary-foreground',
    `${hsl.h} ${hsl.s}% ${fgLightness}%`
  )
}

// Apply accent color to document
function applyAccentColor(color: string) {
  const hsl = hexToHSL(color)
  document.documentElement.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`)
  // Adjust accent-foreground for contrast
  const fgLightness = hsl.l > 50 ? 10 : 98
  document.documentElement.style.setProperty(
    '--accent-foreground',
    `${hsl.h} ${hsl.s}% ${fgLightness}%`
  )
}

// Listen to system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState()
    if (state.mode === 'system') {
      applyThemeMode('system')
    }
  })
}
