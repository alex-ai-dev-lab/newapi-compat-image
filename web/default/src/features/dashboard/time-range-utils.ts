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
import type { TimeRange } from './stats-api'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const ALL_TIME_START_MS = 1

const TIME_RANGE_MS: Record<Exclude<TimeRange, 'all'>, number> = {
  '1d': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
  '1y': 365 * DAY_MS,
}

export const DASHBOARD_TIME_RANGES: TimeRange[] = ['1d', '7d', '30d', '1y', 'all']

export function isDashboardTimeRange(value: unknown): value is TimeRange {
  return (
    typeof value === 'string' &&
    DASHBOARD_TIME_RANGES.includes(value as TimeRange)
  )
}

export function buildUsageLogsTimeSearch(
  timeRange: TimeRange,
  nowMs: number = Date.now()
): { startTime: number; endTime: number } {
  const endTime = nowMs + HOUR_MS
  if (timeRange === 'all') {
    return {
      startTime: ALL_TIME_START_MS,
      endTime,
    }
  }

  return {
    startTime: nowMs - TIME_RANGE_MS[timeRange],
    endTime,
  }
}
