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
import { useEffect, useMemo, useState } from 'react'
import { useSystemConfigStore } from '@/stores/system-config-store'
import {
  DASHBOARD_REFRESH_INTERVAL_MS_VALUES,
  DASHBOARD_TIME_RANGE_VALUES,
  DEFAULT_DASHBOARD_DEFAULTS,
  isDashboardHealthFilter,
  isDashboardPageSize,
  isDashboardTrendMode,
  type DashboardHealthFilter,
  type DashboardPageSize,
  type DashboardTrendMode,
} from '@/lib/dashboard-defaults'
import { type RefreshIntervalMs, type TimeRange } from './stats-api'

type Validator<T> = (value: unknown) => value is T

interface DashboardControls {
  timeRange: TimeRange
  autoRefresh: boolean
  refreshInterval: RefreshIntervalMs
}

const DEFAULT_CONTROLS: DashboardControls = {
  timeRange: DEFAULT_DASHBOARD_DEFAULTS.timeRange,
  autoRefresh: DEFAULT_DASHBOARD_DEFAULTS.autoRefresh,
  refreshInterval: DEFAULT_DASHBOARD_DEFAULTS.refreshInterval,
}

function isTimeRange(value: unknown): value is TimeRange {
  return (
    typeof value === 'string' &&
    DASHBOARD_TIME_RANGE_VALUES.includes(value as TimeRange)
  )
}

function isRefreshInterval(value: unknown): value is RefreshIntervalMs {
  return (
    typeof value === 'number' &&
    DASHBOARD_REFRESH_INTERVAL_MS_VALUES.includes(value as RefreshIntervalMs)
  )
}

function readControls(storageKey: string, fallback: DashboardControls) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<DashboardControls>
    return {
      timeRange: isTimeRange(parsed.timeRange)
        ? parsed.timeRange
        : fallback.timeRange,
      autoRefresh:
        typeof parsed.autoRefresh === 'boolean'
          ? parsed.autoRefresh
          : fallback.autoRefresh,
      refreshInterval: isRefreshInterval(parsed.refreshInterval)
        ? parsed.refreshInterval
        : fallback.refreshInterval,
    }
  } catch {
    return fallback
  }
}

function hasSavedControls(storageKey: string) {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(storageKey) != null
  )
}

function readPreference<T>(
  storageKey: string,
  fallback: T,
  validate?: Validator<T>
) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (validate && !validate(parsed)) return fallback
    return (validate ? parsed : (parsed ?? fallback)) as T
  } catch {
    return fallback
  }
}

function hasSavedPreference(storageKey: string) {
  return (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(storageKey) != null
  )
}

export function useDashboardControls(
  storageKey: string,
  fallback?: DashboardControls
) {
  const dashboardDefaults = useSystemConfigStore(
    (state) => state.config.dashboardDefaults
  )
  const systemConfigLoading = useSystemConfigStore((state) => state.loading)
  const resolvedFallback = fallback ?? dashboardDefaults ?? DEFAULT_CONTROLS

  const [controls, setControls] = useState<DashboardControls>(() =>
    readControls(storageKey, resolvedFallback)
  )
  const [hasLocalControls, setHasLocalControls] = useState(() =>
    hasSavedControls(storageKey)
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasSaved = hasSavedControls(storageKey)
    setHasLocalControls(hasSaved)
    if (!hasSaved && !systemConfigLoading) {
      setControls(resolvedFallback)
    }
  }, [
    resolvedFallback.autoRefresh,
    resolvedFallback.refreshInterval,
    resolvedFallback.timeRange,
    storageKey,
    systemConfigLoading,
  ])

  useEffect(() => {
    if (!hasLocalControls || systemConfigLoading) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(controls))
    } catch {
      // localStorage can be unavailable in strict browser privacy modes.
    }
  }, [controls, hasLocalControls, storageKey, systemConfigLoading])

  const updateControls = (
    updater: (current: DashboardControls) => DashboardControls
  ) => {
    setHasLocalControls(true)
    setControls(updater)
  }

  return {
    ...controls,
    setTimeRange: (timeRange: TimeRange) =>
      updateControls((current) => ({ ...current, timeRange })),
    setAutoRefresh: (autoRefresh: boolean) =>
      updateControls((current) => ({ ...current, autoRefresh })),
    setRefreshInterval: (refreshInterval: RefreshIntervalMs) =>
      updateControls((current) => ({ ...current, refreshInterval })),
  }
}

export function useDashboardPreference<T>(
  storageKey: string,
  fallback: T,
  validate?: Validator<T>
) {
  const [value, setValue] = useState<T>(() =>
    readPreference(storageKey, fallback, validate)
  )

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // localStorage can be unavailable in strict browser privacy modes.
    }
  }, [storageKey, value])

  return [value, setValue] as const
}

export function useDashboardDefaultPreference<T>(
  storageKey: string,
  fallback: T,
  validate?: Validator<T>
) {
  const systemConfigLoading = useSystemConfigStore((state) => state.loading)
  const [value, setValue] = useState<T>(() =>
    readPreference(storageKey, fallback, validate)
  )
  const [hasLocalPreference, setHasLocalPreference] = useState(() =>
    hasSavedPreference(storageKey)
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasSaved = hasSavedPreference(storageKey)
    setHasLocalPreference(hasSaved)
    if (!hasSaved && !systemConfigLoading) {
      setValue(fallback)
    }
  }, [fallback, storageKey, systemConfigLoading])

  useEffect(() => {
    if (!hasLocalPreference || systemConfigLoading) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value))
    } catch {
      // localStorage can be unavailable in strict browser privacy modes.
    }
  }, [hasLocalPreference, storageKey, systemConfigLoading, value])

  const setPreference = (next: T | ((current: T) => T)) => {
    setHasLocalPreference(true)
    setValue(next)
  }

  return [value, setPreference] as const
}

export function useDashboardDefaultPageSize() {
  return useSystemConfigStore((state) => {
    const value = state.config.dashboardDefaults.pageSize
    return isDashboardPageSize(value)
      ? value
      : DEFAULT_DASHBOARD_DEFAULTS.pageSize
  })
}

export function useDashboardDefaultHealthFilter() {
  return useSystemConfigStore((state) => {
    const value = state.config.dashboardDefaults.healthFilter
    return isDashboardHealthFilter(value)
      ? value
      : DEFAULT_DASHBOARD_DEFAULTS.healthFilter
  })
}

export function useDashboardDefaultTrendMode() {
  return useSystemConfigStore((state) => {
    const value = state.config.dashboardDefaults.trendMode
    return isDashboardTrendMode(value)
      ? value
      : DEFAULT_DASHBOARD_DEFAULTS.trendMode
  })
}

export function useDashboardHealthThresholds() {
  const slowFirstTokenThresholdMs = useSystemConfigStore(
    (state) =>
      state.config.dashboardDefaults.slowFirstTokenThresholdMs ??
      DEFAULT_DASHBOARD_DEFAULTS.slowFirstTokenThresholdMs
  )
  const errorRateWarningThreshold = useSystemConfigStore(
    (state) =>
      state.config.dashboardDefaults.errorRateWarningThreshold ??
      DEFAULT_DASHBOARD_DEFAULTS.errorRateWarningThreshold
  )
  const errorRateCriticalThreshold = useSystemConfigStore(
    (state) =>
      state.config.dashboardDefaults.errorRateCriticalThreshold ??
      DEFAULT_DASHBOARD_DEFAULTS.errorRateCriticalThreshold
  )
  const successRateGoodThreshold = useSystemConfigStore(
    (state) =>
      state.config.dashboardDefaults.successRateGoodThreshold ??
      DEFAULT_DASHBOARD_DEFAULTS.successRateGoodThreshold
  )
  const successRateDegradedThreshold = useSystemConfigStore(
    (state) =>
      state.config.dashboardDefaults.successRateDegradedThreshold ??
      DEFAULT_DASHBOARD_DEFAULTS.successRateDegradedThreshold
  )

  return useMemo(
    () => ({
      slowFirstTokenThresholdMs,
      errorRateWarningThreshold,
      errorRateCriticalThreshold,
      successRateGoodThreshold,
      successRateDegradedThreshold,
    }),
    [
      slowFirstTokenThresholdMs,
      errorRateWarningThreshold,
      errorRateCriticalThreshold,
      successRateGoodThreshold,
      successRateDegradedThreshold,
    ]
  )
}

export type { DashboardHealthFilter, DashboardPageSize, DashboardTrendMode }
