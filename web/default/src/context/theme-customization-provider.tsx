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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useSystemConfigStore } from '@/stores/system-config-store'
import { getCookie, removeCookie, setCookie } from '@/lib/cookies'
import {
  CONTENT_LAYOUT_VALUES,
  type ContentLayout,
  DEFAULT_THEME_CUSTOMIZATION,
  resolveThemeFont,
  THEME_COOKIE_KEYS,
  THEME_FONT_VALUES,
  THEME_PRESET_VALUES,
  THEME_RADIUS_VALUES,
  THEME_SCALE_VALUES,
  type ThemeCustomization,
  type ThemeFont,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/theme-customization'

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function readCookie<T extends string>(
  name: string,
  allowed: ReadonlySet<T>,
  fallback: T
): T {
  const value = getCookie(name)
  return value && allowed.has(value as T) ? (value as T) : fallback
}

function applyAttribute(name: string, value: string | null) {
  if (typeof document === 'undefined') return
  const body = document.body
  if (!body) return
  if (value === null) {
    body.removeAttribute(name)
  } else {
    body.setAttribute(name, value)
  }
}

function applyCssVariable(name: string, value: string | null) {
  if (typeof document === 'undefined') return
  const body = document.body
  if (!body) return
  if (value === null) {
    body.style.removeProperty(name)
  } else {
    body.style.setProperty(name, value)
  }
}

function getReadableForeground(hex: string) {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#2563eb'
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? 'oklch(0.145 0 0)' : 'oklch(0.985 0 0)'
}

const CUSTOM_ACCENT_VARIABLES = [
  '--primary',
  '--primary-foreground',
  '--ring',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-ring',
] as const

const CUSTOM_PALETTE_VARIABLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--border',
  '--input',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const

type ThemeCustomizationContextType = {
  defaults: ThemeCustomization
  customization: ThemeCustomization
  setPreset: (preset: ThemePreset) => void
  setFont: (font: ThemeFont) => void
  setRadius: (radius: ThemeRadius) => void
  setScale: (scale: ThemeScale) => void
  setContentLayout: (contentLayout: ContentLayout) => void
  resetCustomization: () => void
}

// Fallback used when a consumer renders outside the provider (e.g. an error
// route mounted before providers are ready, or stale HMR boundaries). Keeping
// it permissive prevents the whole tree from crashing — the UI just behaves
// like the defaults until the real provider re-mounts.
const FALLBACK_CONTEXT: ThemeCustomizationContextType = {
  defaults: DEFAULT_THEME_CUSTOMIZATION,
  customization: DEFAULT_THEME_CUSTOMIZATION,
  setPreset: () => {},
  setFont: () => {},
  setRadius: () => {},
  setScale: () => {},
  setContentLayout: () => {},
  resetCustomization: () => {},
}

const ThemeCustomizationContext =
  createContext<ThemeCustomizationContextType>(FALLBACK_CONTEXT)

export function ThemeCustomizationProvider(props: {
  children: React.ReactNode
}) {
  const defaults =
    useSystemConfigStore((state) => state.config.themeCustomization) ??
    DEFAULT_THEME_CUSTOMIZATION
  const [preset, _setPreset] = useState<ThemePreset>(() =>
    readCookie<ThemePreset>(
      THEME_COOKIE_KEYS.preset,
      THEME_PRESET_VALUES,
      defaults.preset
    )
  )
  const [font, _setFont] = useState<ThemeFont>(() =>
    readCookie<ThemeFont>(
      THEME_COOKIE_KEYS.font,
      THEME_FONT_VALUES,
      defaults.font
    )
  )
  const [radius, _setRadius] = useState<ThemeRadius>(() =>
    readCookie<ThemeRadius>(
      THEME_COOKIE_KEYS.radius,
      THEME_RADIUS_VALUES,
      defaults.radius
    )
  )
  const [scale, _setScale] = useState<ThemeScale>(() =>
    readCookie<ThemeScale>(
      THEME_COOKIE_KEYS.scale,
      THEME_SCALE_VALUES,
      defaults.scale
    )
  )
  const [contentLayout, _setContentLayout] = useState<ContentLayout>(() =>
    readCookie<ContentLayout>(
      THEME_COOKIE_KEYS.contentLayout,
      CONTENT_LAYOUT_VALUES,
      defaults.contentLayout
    )
  )

  useEffect(() => {
    if (!getCookie(THEME_COOKIE_KEYS.preset)) _setPreset(defaults.preset)
    if (!getCookie(THEME_COOKIE_KEYS.font)) _setFont(defaults.font)
    if (!getCookie(THEME_COOKIE_KEYS.radius)) _setRadius(defaults.radius)
    if (!getCookie(THEME_COOKIE_KEYS.scale)) _setScale(defaults.scale)
    if (!getCookie(THEME_COOKIE_KEYS.contentLayout)) {
      _setContentLayout(defaults.contentLayout)
    }
  }, [defaults])

  // Mirror state to the <body> via data-* attributes so theme-presets.css can
  // override CSS variables at the right cascade layer.
  useEffect(() => {
    applyAttribute(
      'data-theme-preset',
      preset === DEFAULT_THEME_CUSTOMIZATION.preset ? null : preset
    )
  }, [preset])

  // Font is the one axis where we resolve before writing the attribute:
  // the persisted preference may be `default`, but CSS works in terms of
  // the concrete `sans`/`serif` choice that should drive the cascade.
  // Resolving here (instead of in CSS via `:not()` selectors) keeps the
  // stylesheet to one simple `[data-theme-font='serif']` selector and lets
  // future presets opt into typography via `PRESET_DEFAULT_FONT` alone.
  useEffect(() => {
    applyAttribute('data-theme-font', resolveThemeFont(font, preset))
  }, [font, preset])

  useEffect(() => {
    applyAttribute(
      'data-theme-radius',
      radius === DEFAULT_THEME_CUSTOMIZATION.radius ? null : radius
    )
  }, [radius])

  useEffect(() => {
    applyAttribute(
      'data-theme-scale',
      scale === DEFAULT_THEME_CUSTOMIZATION.scale ? null : scale
    )
  }, [scale])

  useEffect(() => {
    applyAttribute('data-theme-content-layout', contentLayout)
  }, [contentLayout])

  useEffect(() => {
    if (
      !defaults.customAccentEnabled ||
      !/^#[0-9a-fA-F]{6}$/.test(defaults.customAccentColor)
    ) {
      CUSTOM_ACCENT_VARIABLES.forEach((name) => applyCssVariable(name, null))
      return
    }

    const foreground = getReadableForeground(defaults.customAccentColor)
    applyCssVariable('--primary', defaults.customAccentColor)
    applyCssVariable('--primary-foreground', foreground)
    applyCssVariable('--ring', defaults.customAccentColor)
    applyCssVariable('--sidebar-primary', defaults.customAccentColor)
    applyCssVariable('--sidebar-primary-foreground', foreground)
    applyCssVariable('--sidebar-ring', defaults.customAccentColor)
  }, [defaults.customAccentEnabled, defaults.customAccentColor])

  useEffect(() => {
    const colors = [
      defaults.customBackgroundColor,
      defaults.customSurfaceColor,
      defaults.customSidebarColor,
      defaults.customChartColor,
    ]
    const valid =
      defaults.customPaletteEnabled &&
      colors.every((color) => /^#[0-9a-fA-F]{6}$/.test(color))

    if (!valid) {
      CUSTOM_PALETTE_VARIABLES.forEach((name) => applyCssVariable(name, null))
      return
    }

    const backgroundForeground = getReadableForeground(
      defaults.customBackgroundColor
    )
    const surfaceForeground = getReadableForeground(defaults.customSurfaceColor)
    const sidebarForeground = getReadableForeground(defaults.customSidebarColor)
    const mutedForeground =
      surfaceForeground === 'oklch(0.145 0 0)'
        ? 'oklch(0.42 0 0)'
        : 'oklch(0.78 0 0)'

    applyCssVariable('--background', defaults.customBackgroundColor)
    applyCssVariable('--foreground', backgroundForeground)
    applyCssVariable('--card', defaults.customSurfaceColor)
    applyCssVariable('--card-foreground', surfaceForeground)
    applyCssVariable('--popover', defaults.customSurfaceColor)
    applyCssVariable('--popover-foreground', surfaceForeground)
    applyCssVariable(
      '--secondary',
      `color-mix(in oklab, ${defaults.customSurfaceColor} 88%, ${backgroundForeground} 12%)`
    )
    applyCssVariable('--secondary-foreground', surfaceForeground)
    applyCssVariable(
      '--muted',
      `color-mix(in oklab, ${defaults.customSurfaceColor} 92%, ${backgroundForeground} 8%)`
    )
    applyCssVariable('--muted-foreground', mutedForeground)
    applyCssVariable(
      '--accent',
      `color-mix(in oklab, ${defaults.customSurfaceColor} 84%, ${backgroundForeground} 16%)`
    )
    applyCssVariable('--accent-foreground', surfaceForeground)
    applyCssVariable(
      '--border',
      `color-mix(in oklab, ${defaults.customSurfaceColor} 78%, ${backgroundForeground} 22%)`
    )
    applyCssVariable(
      '--input',
      `color-mix(in oklab, ${defaults.customSurfaceColor} 72%, ${backgroundForeground} 28%)`
    )
    applyCssVariable('--sidebar', defaults.customSidebarColor)
    applyCssVariable('--sidebar-foreground', sidebarForeground)
    applyCssVariable(
      '--sidebar-accent',
      `color-mix(in oklab, ${defaults.customSidebarColor} 82%, ${sidebarForeground} 18%)`
    )
    applyCssVariable('--sidebar-accent-foreground', sidebarForeground)
    applyCssVariable(
      '--sidebar-border',
      `color-mix(in oklab, ${defaults.customSidebarColor} 76%, ${sidebarForeground} 24%)`
    )
    applyCssVariable('--chart-1', defaults.customChartColor)
    applyCssVariable(
      '--chart-2',
      `color-mix(in oklab, ${defaults.customChartColor} 82%, ${backgroundForeground} 18%)`
    )
    applyCssVariable(
      '--chart-3',
      `color-mix(in oklab, ${defaults.customChartColor} 70%, ${backgroundForeground} 30%)`
    )
    applyCssVariable(
      '--chart-4',
      `color-mix(in oklab, ${defaults.customChartColor} 50%, ${defaults.customSurfaceColor} 50%)`
    )
    applyCssVariable(
      '--chart-5',
      `color-mix(in oklab, ${defaults.customChartColor} 64%, ${defaults.customBackgroundColor} 36%)`
    )
  }, [
    defaults.customPaletteEnabled,
    defaults.customBackgroundColor,
    defaults.customSurfaceColor,
    defaults.customSidebarColor,
    defaults.customChartColor,
  ])

  const setPreset = useCallback(
    (value: ThemePreset) => {
      _setPreset(value)
      if (value === defaults.preset) {
        removeCookie(THEME_COOKIE_KEYS.preset)
      } else {
        setCookie(THEME_COOKIE_KEYS.preset, value, COOKIE_MAX_AGE)
      }
    },
    [defaults.preset]
  )

  const setFont = useCallback(
    (value: ThemeFont) => {
      _setFont(value)
      if (value === defaults.font) {
        removeCookie(THEME_COOKIE_KEYS.font)
      } else {
        setCookie(THEME_COOKIE_KEYS.font, value, COOKIE_MAX_AGE)
      }
    },
    [defaults.font]
  )

  const setRadius = useCallback(
    (value: ThemeRadius) => {
      _setRadius(value)
      if (value === defaults.radius) {
        removeCookie(THEME_COOKIE_KEYS.radius)
      } else {
        setCookie(THEME_COOKIE_KEYS.radius, value, COOKIE_MAX_AGE)
      }
    },
    [defaults.radius]
  )

  const setScale = useCallback(
    (value: ThemeScale) => {
      _setScale(value)
      if (value === defaults.scale) {
        removeCookie(THEME_COOKIE_KEYS.scale)
      } else {
        setCookie(THEME_COOKIE_KEYS.scale, value, COOKIE_MAX_AGE)
      }
    },
    [defaults.scale]
  )

  const setContentLayout = useCallback(
    (value: ContentLayout) => {
      _setContentLayout(value)
      if (value === defaults.contentLayout) {
        removeCookie(THEME_COOKIE_KEYS.contentLayout)
      } else {
        setCookie(THEME_COOKIE_KEYS.contentLayout, value, COOKIE_MAX_AGE)
      }
    },
    [defaults.contentLayout]
  )

  const resetCustomization = useCallback(() => {
    setPreset(defaults.preset)
    setFont(defaults.font)
    setRadius(defaults.radius)
    setScale(defaults.scale)
    setContentLayout(defaults.contentLayout)
  }, [defaults, setPreset, setFont, setRadius, setScale, setContentLayout])

  const value = useMemo<ThemeCustomizationContextType>(
    () => ({
      defaults,
      customization: {
        preset,
        font,
        radius,
        scale,
        contentLayout,
        customAccentEnabled: defaults.customAccentEnabled,
        customAccentColor: defaults.customAccentColor,
        customPaletteEnabled: defaults.customPaletteEnabled,
        customBackgroundColor: defaults.customBackgroundColor,
        customSurfaceColor: defaults.customSurfaceColor,
        customSidebarColor: defaults.customSidebarColor,
        customChartColor: defaults.customChartColor,
      },
      setPreset,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    }),
    [
      preset,
      font,
      radius,
      scale,
      contentLayout,
      defaults,
      setPreset,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    ]
  )

  return (
    <ThemeCustomizationContext.Provider value={value}>
      {props.children}
    </ThemeCustomizationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeCustomization() {
  return useContext(ThemeCustomizationContext)
}
