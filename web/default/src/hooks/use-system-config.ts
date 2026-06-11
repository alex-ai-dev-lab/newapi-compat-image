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
import { useEffect, useCallback } from 'react'
import {
  useSystemConfigStore,
  type CurrencyConfig,
  type CurrencyDisplayType,
  type SystemConfig,
  DEFAULT_CURRENCY_CONFIG,
} from '@/stores/system-config-store'
import { DEFAULT_SYSTEM_NAME, DEFAULT_LOGO } from '@/lib/constants'
import {
  DEFAULT_DASHBOARD_DEFAULTS,
  isDashboardChartTimeGranularity,
  isDashboardChartTimeRangeDays,
  isDashboardConsumptionChart,
  isDashboardModelAnalyticsChart,
  isDashboardTimeRange,
  isDashboardHealthFilter,
  isDashboardPageSize,
  isDashboardTrendMode,
  normalizeDashboardPercentThreshold,
  normalizeSlowFirstTokenThresholdMs,
  parseDashboardVisibleSections,
  secondsToDashboardRefreshIntervalMs,
} from '@/lib/dashboard-defaults'
import { applyFaviconToDom } from '@/lib/dom-utils'
import {
  CONTENT_LAYOUT_VALUES,
  DEFAULT_THEME_CUSTOMIZATION,
  THEME_FONT_VALUES,
  THEME_PRESET_VALUES,
  THEME_RADIUS_VALUES,
  THEME_SCALE_VALUES,
  type ContentLayout,
  type ThemeCustomization,
  type ThemeFont,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/theme-customization'

interface UseSystemConfigOptions {
  /** Automatically fetch config from backend (use only in root component) */
  autoLoad?: boolean
}

interface StatusApiResponse {
  success: boolean
  data: {
    system_name?: string
    logo?: string
    footer_html?: string
    demo_site_enabled?: boolean
    display_token_stat_enabled?: boolean
    display_in_currency?: boolean
    quota_display_type?: CurrencyDisplayType
    quota_per_unit?: number
    usd_exchange_rate?: number
    custom_currency_symbol?: string
    custom_currency_exchange_rate?: number
    dashboard_default_time_range?: string
    dashboard_auto_refresh?: boolean
    dashboard_refresh_interval?: number
    dashboard_default_page_size?: number
    dashboard_default_health?: string
    dashboard_default_trend_mode?: string
    dashboard_default_chart_days?: number
    dashboard_default_consumption_chart?: string
    dashboard_default_model_chart?: string
    dashboard_visible_sections?: string
    data_export_default_time?: string
    dashboard_slow_first_token_ms?: number
    dashboard_error_warning?: number
    dashboard_error_critical?: number
    dashboard_success_good?: number
    dashboard_success_degraded?: number
    theme_customization?: {
      preset?: string
      font?: string
      radius?: string
      scale?: string
      content_layout?: string
      custom_accent_enabled?: boolean
      custom_accent_color?: string
      custom_palette_enabled?: boolean
      custom_background_color?: string
      custom_surface_color?: string
      custom_sidebar_color?: string
      custom_chart_color?: string
    }
    SystemSettingsNavigation?: string
  }
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return fallback
}

function toAllowedValue<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  fallback: T
): T {
  return typeof value === 'string' && allowed.has(value as T)
    ? (value as T)
    : fallback
}

/**
 * Map `/api/status` response data to our persisted system config structure
 */
export function mapStatusDataToConfig(
  data: StatusApiResponse['data'] | undefined
): Partial<SystemConfig> {
  if (!data) return {}

  const quotaDisplayType =
    (data.quota_display_type as CurrencyDisplayType | undefined) ??
    DEFAULT_CURRENCY_CONFIG.quotaDisplayType

  const currency: CurrencyConfig = {
    displayInCurrency:
      data.display_in_currency ?? DEFAULT_CURRENCY_CONFIG.displayInCurrency,
    quotaDisplayType,
    quotaPerUnit: toNumber(
      data.quota_per_unit,
      DEFAULT_CURRENCY_CONFIG.quotaPerUnit
    ),
    usdExchangeRate: toNumber(
      data.usd_exchange_rate,
      DEFAULT_CURRENCY_CONFIG.usdExchangeRate
    ),
    customCurrencySymbol:
      data.custom_currency_symbol?.trim() ||
      DEFAULT_CURRENCY_CONFIG.customCurrencySymbol,
    customCurrencyExchangeRate: toNumber(
      data.custom_currency_exchange_rate,
      DEFAULT_CURRENCY_CONFIG.customCurrencyExchangeRate
    ),
  }

  const themeCustomization: ThemeCustomization = {
    preset: toAllowedValue<ThemePreset>(
      data.theme_customization?.preset,
      THEME_PRESET_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.preset
    ),
    font: toAllowedValue<ThemeFont>(
      data.theme_customization?.font,
      THEME_FONT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.font
    ),
    radius: toAllowedValue<ThemeRadius>(
      data.theme_customization?.radius,
      THEME_RADIUS_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.radius
    ),
    scale: toAllowedValue<ThemeScale>(
      data.theme_customization?.scale,
      THEME_SCALE_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.scale
    ),
    contentLayout: toAllowedValue<ContentLayout>(
      data.theme_customization?.content_layout,
      CONTENT_LAYOUT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.contentLayout
    ),
    customAccentEnabled:
      typeof data.theme_customization?.custom_accent_enabled === 'boolean'
        ? data.theme_customization.custom_accent_enabled
        : DEFAULT_THEME_CUSTOMIZATION.customAccentEnabled,
    customAccentColor:
      typeof data.theme_customization?.custom_accent_color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(data.theme_customization.custom_accent_color)
        ? data.theme_customization.custom_accent_color
        : DEFAULT_THEME_CUSTOMIZATION.customAccentColor,
    customPaletteEnabled:
      typeof data.theme_customization?.custom_palette_enabled === 'boolean'
        ? data.theme_customization.custom_palette_enabled
        : DEFAULT_THEME_CUSTOMIZATION.customPaletteEnabled,
    customBackgroundColor:
      typeof data.theme_customization?.custom_background_color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(data.theme_customization.custom_background_color)
        ? data.theme_customization.custom_background_color
        : DEFAULT_THEME_CUSTOMIZATION.customBackgroundColor,
    customSurfaceColor:
      typeof data.theme_customization?.custom_surface_color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(data.theme_customization.custom_surface_color)
        ? data.theme_customization.custom_surface_color
        : DEFAULT_THEME_CUSTOMIZATION.customSurfaceColor,
    customSidebarColor:
      typeof data.theme_customization?.custom_sidebar_color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(data.theme_customization.custom_sidebar_color)
        ? data.theme_customization.custom_sidebar_color
        : DEFAULT_THEME_CUSTOMIZATION.customSidebarColor,
    customChartColor:
      typeof data.theme_customization?.custom_chart_color === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(data.theme_customization.custom_chart_color)
        ? data.theme_customization.custom_chart_color
        : DEFAULT_THEME_CUSTOMIZATION.customChartColor,
  }

  const dashboardDefaults = {
    timeRange: isDashboardTimeRange(data.dashboard_default_time_range)
      ? data.dashboard_default_time_range
      : DEFAULT_DASHBOARD_DEFAULTS.timeRange,
    autoRefresh:
      typeof data.dashboard_auto_refresh === 'boolean'
        ? data.dashboard_auto_refresh
        : DEFAULT_DASHBOARD_DEFAULTS.autoRefresh,
    refreshInterval: secondsToDashboardRefreshIntervalMs(
      data.dashboard_refresh_interval,
      DEFAULT_DASHBOARD_DEFAULTS.refreshInterval
    ),
    pageSize: isDashboardPageSize(data.dashboard_default_page_size)
      ? data.dashboard_default_page_size
      : DEFAULT_DASHBOARD_DEFAULTS.pageSize,
    healthFilter: isDashboardHealthFilter(data.dashboard_default_health)
      ? data.dashboard_default_health
      : DEFAULT_DASHBOARD_DEFAULTS.healthFilter,
    trendMode: isDashboardTrendMode(data.dashboard_default_trend_mode)
      ? data.dashboard_default_trend_mode
      : DEFAULT_DASHBOARD_DEFAULTS.trendMode,
    chartTimeRangeDays: isDashboardChartTimeRangeDays(
      data.dashboard_default_chart_days
    )
      ? data.dashboard_default_chart_days
      : DEFAULT_DASHBOARD_DEFAULTS.chartTimeRangeDays,
    chartTimeGranularity: isDashboardChartTimeGranularity(
      data.data_export_default_time
    )
      ? data.data_export_default_time
      : DEFAULT_DASHBOARD_DEFAULTS.chartTimeGranularity,
    consumptionChart: isDashboardConsumptionChart(
      data.dashboard_default_consumption_chart
    )
      ? data.dashboard_default_consumption_chart
      : DEFAULT_DASHBOARD_DEFAULTS.consumptionChart,
    modelAnalyticsChart: isDashboardModelAnalyticsChart(
      data.dashboard_default_model_chart
    )
      ? data.dashboard_default_model_chart
      : DEFAULT_DASHBOARD_DEFAULTS.modelAnalyticsChart,
    visibleSections: parseDashboardVisibleSections(
      data.dashboard_visible_sections,
      DEFAULT_DASHBOARD_DEFAULTS.visibleSections
    ),
    slowFirstTokenThresholdMs: normalizeSlowFirstTokenThresholdMs(
      data.dashboard_slow_first_token_ms,
      DEFAULT_DASHBOARD_DEFAULTS.slowFirstTokenThresholdMs
    ),
    errorRateWarningThreshold: normalizeDashboardPercentThreshold(
      data.dashboard_error_warning,
      DEFAULT_DASHBOARD_DEFAULTS.errorRateWarningThreshold
    ),
    errorRateCriticalThreshold: normalizeDashboardPercentThreshold(
      data.dashboard_error_critical,
      DEFAULT_DASHBOARD_DEFAULTS.errorRateCriticalThreshold
    ),
    successRateGoodThreshold: normalizeDashboardPercentThreshold(
      data.dashboard_success_good,
      DEFAULT_DASHBOARD_DEFAULTS.successRateGoodThreshold
    ),
    successRateDegradedThreshold: normalizeDashboardPercentThreshold(
      data.dashboard_success_degraded,
      DEFAULT_DASHBOARD_DEFAULTS.successRateDegradedThreshold
    ),
  }

  return {
    systemName: data.system_name || DEFAULT_SYSTEM_NAME,
    logo: data.logo || DEFAULT_LOGO,
    footerHtml: data.footer_html,
    demoSiteEnabled: data.demo_site_enabled,
    displayTokenStatEnabled: data.display_token_stat_enabled,
    currency,
    themeCustomization,
    dashboardDefaults,
    systemSettingsNavigation:
      typeof data.SystemSettingsNavigation === 'string'
        ? data.SystemSettingsNavigation
        : '',
  }
}

// Fetch system config from API
async function fetchSystemConfig(): Promise<Partial<SystemConfig>> {
  const response = await fetch('/api/status')
  if (!response.ok) throw new Error('Failed to fetch status')

  const data: StatusApiResponse = await response.json()
  if (!data.success) throw new Error('API returned error')

  return mapStatusDataToConfig(data.data)
}

// Preload image and return cleanup function
function preloadImage(
  src: string,
  onLoad: () => void,
  onError: () => void
): () => void {
  const img = new Image()
  img.onload = onLoad
  img.onerror = onError
  img.src = src

  return () => {
    img.onload = null
    img.onerror = null
  }
}

/**
 * System configuration hook with auto-loading and logo preloading
 *
 * @example
 * // Root component - auto-load from backend
 * useSystemConfig({ autoLoad: true })
 *
 * @example
 * // Other components - use cached config
 * const { systemName, logo, loading } = useSystemConfig()
 */
export function useSystemConfig(options: UseSystemConfigOptions = {}) {
  const { autoLoad = false } = options
  const {
    config,
    loading,
    loadedLogoUrl,
    setConfig,
    setLoadedLogoUrl,
    setLoading,
  } = useSystemConfigStore()

  // Load config from backend
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const newConfig = await fetchSystemConfig()
      setConfig(newConfig)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load system config:', error)
    } finally {
      setLoading(false)
    }
  }, [setConfig, setLoading])

  useEffect(() => {
    if (autoLoad) loadConfig()
  }, [autoLoad, loadConfig])

  // Preload logo image when URL changes
  useEffect(() => {
    const { logo } = config

    // Skip if logo is already loaded
    if (!logo || logo === loadedLogoUrl) return

    // Preload new logo
    return preloadImage(
      logo,
      () => {
        setLoadedLogoUrl(logo)
        applyFaviconToDom(logo)
      },
      () => {
        if (logo !== DEFAULT_LOGO) {
          // eslint-disable-next-line no-console
          console.error('Failed to load logo:', logo)
        }
        // Mark as loaded even on error to prevent infinite retry
        setLoadedLogoUrl(logo)
      }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.logo, loadedLogoUrl, setLoadedLogoUrl])

  return {
    ...config,
    loading,
    logoLoaded: config.logo === loadedLogoUrl && !!loadedLogoUrl,
  }
}
