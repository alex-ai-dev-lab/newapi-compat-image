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

interface ThemeStore {
  mode: ThemeMode
  fontSize: number
  setMode: (mode: ThemeMode) => void
  setFontSize: (size: number) => void
  reset: () => void
}

const defaultTheme = {
  mode: 'system' as ThemeMode,
  fontSize: 14,
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
      reset: () => {
        set(defaultTheme)
        applyThemeMode(defaultTheme.mode)
        applyFontSize(defaultTheme.fontSize)
      },
    }),
    {
      name: 'newapi-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme immediately after rehydration
          applyThemeMode(state.mode)
          applyFontSize(state.fontSize)
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

// Listen to system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useThemeStore.getState()
    if (state.mode === 'system') {
      applyThemeMode('system')
    }
  })
}
