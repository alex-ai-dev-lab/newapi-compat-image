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
import { useEffect, useMemo } from 'react'
import { Link, getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CircleDollarSign,
  FileText,
  RadioTower,
  Timer,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  type ChannelStat,
  type OverviewStats,
  type TimeRange,
  useOverviewStats,
} from '../../stats-api'
import { AutoRefreshToggle } from '../../auto-refresh-toggle'
import { TimeRangeSelector } from '../../time-range-selector'
import { buildUsageLogsTimeSearch } from '../../time-range-utils'
import { useDashboardControls } from '../../use-dashboard-controls'

const route = getRouteApi('/_authenticated/dashboard/$section')

function formatCount(value: number): string {
  return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

function formatMs(value: number): string {
  if (!value || value <= 0) return '-'
  return `${Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}ms`
}

function formatUsd(value: number): string {
  return `$${Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value)}`
}

function formatChannelName(name: string | undefined, t: (key: string) => string) {
  const trimmed = String(name || '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'unknown') {
    return t('未知渠道')
  }
  return trimmed
}

function riskTone(rate: number): 'default' | 'secondary' | 'destructive' {
  if (rate >= 5) return 'destructive'
  if (rate > 0) return 'secondary'
  return 'default'
}

function buildChartData(stats?: OverviewStats) {
  return (
    stats?.trend.map((point) => ({
      time: new Date(point.timestamp * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
      }),
      success: point.success,
      failure: point.failure,
      requests: point.requests,
    })) ?? []
  )
}

type DrilldownSection = 'models' | 'channels' | 'users'

type DashboardDrilldownSearch = {
  channel_id?: number
  user_id?: number
  model_name?: string
  time_range?: TimeRange
}

type UsageLogsSearch = {
  channel?: string
  model?: string
  username?: string
}

export function OperationsInsightsPanel() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const {
    timeRange,
    autoRefresh,
    refreshInterval,
    setTimeRange,
    setAutoRefresh,
    setRefreshInterval,
  } = useDashboardControls('dashboard:operations-center')

  function changeTimeRange(nextTimeRange: TimeRange) {
    setTimeRange(nextTimeRange)
    if (search.time_range !== undefined) {
      void navigate({
        to: '/dashboard/$section',
        params: { section: 'overview' },
        search: { ...search, time_range: undefined },
        replace: true,
      })
    }
  }

  useEffect(() => {
    if (search.time_range && search.time_range !== timeRange) {
      setTimeRange(search.time_range)
    }
  }, [search.time_range, setTimeRange, timeRange])

  const {
    data: stats,
    isLoading,
    isFetching,
    error,
    refetch,
    dataUpdatedAt,
  } = useOverviewStats(
    timeRange,
    autoRefresh,
    refreshInterval
  )

  const chartData = useMemo(() => buildChartData(stats), [stats])
  const usageLogsTimeSearch = useMemo(
    () => buildUsageLogsTimeSearch(timeRange),
    [timeRange]
  )
  const busiestModel = stats?.top_models?.[0]
  const costliestUser = stats?.top_cost_users?.[0]
  const riskiestChannel = stats?.top_failing_channels?.[0]
  const slowestChannel = stats?.slowest_channels?.[0]

  if (error) {
    return (
      <section className='rounded-xl border bg-card p-4'>
        <div className='flex items-center gap-2 text-sm font-medium text-destructive'>
          <AlertTriangle className='size-4' aria-hidden='true' />
          {t('运维总览加载失败，请稍后重试。')}
        </div>
      </section>
    )
  }

  return (
    <section className='overflow-hidden rounded-xl border bg-card'>
      <div className='flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
        <div className='flex min-w-0 flex-col gap-1'>
          <div className='flex items-center gap-2'>
            <RadioTower className='size-4 text-muted-foreground' aria-hidden='true' />
            <h3 className='text-sm font-semibold'>{t('运维中心')}</h3>
            <Badge variant='secondary' className='font-mono text-[11px]'>
              {t('管理视角')}
            </Badge>
          </div>
          <p className='text-sm text-muted-foreground'>
            {t('统一观察全局渠道可靠性、首字延迟、模型流量与用户消费。')}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            render={
              <Link
                to='/dashboard/$section'
                params={{ section: 'channels' }}
                search={{ time_range: timeRange }}
              />
            }
          >
            {t('渠道分析')}
            <ArrowRight data-icon='inline-end' />
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            render={
              <Link
                to='/usage-logs/$section'
                params={{ section: 'common' }}
                search={{ page: 1, ...usageLogsTimeSearch }}
              />
            }
          >
            <FileText data-icon='inline-start' />
            {t('使用日志')}
          </Button>
          <AutoRefreshToggle
            value={autoRefresh}
            onChange={setAutoRefresh}
            intervalMs={refreshInterval}
            onIntervalChange={setRefreshInterval}
            onRefresh={refetch}
            isRefreshing={isFetching}
            lastUpdatedAt={dataUpdatedAt}
            className='rounded-md border px-2.5 py-1'
          />
          <TimeRangeSelector value={timeRange} onChange={changeTimeRange} />
        </div>
      </div>

      <div className='space-y-4 p-4 sm:p-5'>
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <InsightMetric
            icon={Activity}
            label={t('请求数')}
            value={stats ? formatCount(stats.total_requests) : ''}
            subvalue={
              stats
                ? t('{{success}} 成功 / {{failed}} 失败', {
                    success: formatCount(stats.success_requests),
                    failed: formatCount(stats.failed_requests),
                  })
                : ''
            }
            loading={isLoading}
          />
          <InsightMetric
            icon={AlertTriangle}
            label={t('错误率')}
            value={stats ? `${stats.error_rate.toFixed(2)}%` : ''}
            subvalue={
              riskiestChannel
                ? `${formatChannelName(riskiestChannel.channel_name, t)} #${riskiestChannel.channel_id}`
                : t('当前无失败渠道')
            }
            loading={isLoading}
            tone={stats && stats.error_rate > 0 ? 'warning' : 'success'}
          />
          <InsightMetric
            icon={Timer}
            label={t('首字延迟')}
            value={stats ? formatMs(stats.avg_first_token_time) : ''}
            subvalue={
              slowestChannel
                ? t('最慢 {{value}}', {
                    value: formatMs(slowestChannel.avg_first_token),
                  })
                : t('暂无延迟数据')
            }
            loading={isLoading}
          />
          <InsightMetric
            icon={CircleDollarSign}
            label={t('成本')}
            value={stats ? formatUsd(stats.total_cost) : ''}
            subvalue={
              stats
                ? t('{{count}} Token', {
                    count: formatCount(
                      stats.total_prompt_tokens + stats.total_output_tokens
                    ),
                  })
                : ''
            }
            loading={isLoading}
          />
        </div>

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]'>
          <Card className='rounded-lg shadow-none'>
            <CardHeader className='border-b pb-3'>
              <CardTitle className='text-sm'>{t('流量健康度')}</CardTitle>
            </CardHeader>
            <CardContent className='pt-4'>
              {isLoading ? (
                <Skeleton className='h-72 w-full rounded-lg' />
              ) : (
                <ResponsiveContainer width='100%' height={288}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id='successArea' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor='var(--success)' stopOpacity={0.28} />
                        <stop offset='95%' stopColor='var(--success)' stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id='failureArea' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor='var(--destructive)' stopOpacity={0.26} />
                        <stop offset='95%' stopColor='var(--destructive)' stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='var(--border)' />
                    <XAxis
                      dataKey='time'
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type='monotone'
                      dataKey='success'
                      stroke='var(--success)'
                      strokeWidth={2}
                      fill='url(#successArea)'
                      name={t('成功')}
                    />
                    <Area
                      type='monotone'
                      dataKey='failure'
                      stroke='var(--destructive)'
                      strokeWidth={2}
                      fill='url(#failureArea)'
                      name={t('失败')}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className='grid gap-4'>
            <RankList
              title={t('风险渠道')}
              rows={stats?.top_failing_channels ?? []}
              loading={isLoading}
              metric='error'
              timeRange={timeRange}
            />
            <RankList
              title={t('首字最慢渠道')}
              rows={stats?.slowest_channels ?? []}
              loading={isLoading}
              metric='latency'
              timeRange={timeRange}
            />
          </div>
        </div>

        <div className='grid gap-4 lg:grid-cols-3'>
          <SummaryStrip
            icon={RadioTower}
            label={t('头部渠道')}
            value={
              stats?.top_channels?.[0]
                ? formatChannelName(stats.top_channels[0].channel_name, t)
                : '-'
            }
            detail={
              stats?.top_channels?.[0]
                ? t('{{count}} 次请求', {
                    count: formatCount(stats.top_channels[0].total_requests),
                  })
                : t('暂无数据')
            }
            toSection='channels'
            search={
              stats?.top_channels?.[0]
                ? {
                    channel_id: stats.top_channels[0].channel_id,
                    time_range: timeRange,
                  }
                : undefined
            }
            logsSearch={
              stats?.top_channels?.[0]
                ? { channel: String(stats.top_channels[0].channel_id) }
                : undefined
            }
            logsTimeSearch={usageLogsTimeSearch}
          />
          <SummaryStrip
            icon={Activity}
            label={t('头部模型')}
            value={busiestModel?.model_name ?? '-'}
            detail={
              busiestModel
                ? t('{{count}} 次请求', {
                    count: formatCount(busiestModel.total_requests),
                  })
                : t('暂无数据')
            }
            toSection='models'
            search={
              busiestModel
                ? { model_name: busiestModel.model_name, time_range: timeRange }
                : undefined
            }
            logsSearch={
              busiestModel ? { model: busiestModel.model_name } : undefined
            }
            logsTimeSearch={usageLogsTimeSearch}
          />
          <SummaryStrip
            icon={Users}
            label={t('头部消费用户')}
            value={costliestUser?.username ?? '-'}
            detail={
              costliestUser
                ? t('{{cost}}，来自 {{channel}}', {
                    cost: formatUsd(costliestUser.total_cost),
                    channel: formatChannelName(costliestUser.top_channel_name, t),
                  })
                : t('暂无数据')
            }
            toSection='users'
            search={
              costliestUser
                ? { user_id: costliestUser.user_id, time_range: timeRange }
                : undefined
            }
            logsSearch={
              costliestUser ? { username: costliestUser.username } : undefined
            }
            logsTimeSearch={usageLogsTimeSearch}
          />
        </div>
      </div>
    </section>
  )
}

function InsightMetric(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  subvalue: string
  loading: boolean
  tone?: 'success' | 'warning'
}) {
  const Icon = props.icon
  return (
    <div className='rounded-lg border bg-background/60 p-3'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs font-medium text-muted-foreground'>{props.label}</span>
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-md border',
            props.tone === 'success' && 'border-success/20 bg-success/10 text-success',
            props.tone === 'warning' && 'border-warning/20 bg-warning/10 text-warning'
          )}
        >
          <Icon className='size-3.5' aria-hidden='true' />
        </span>
      </div>
      {props.loading ? (
        <Skeleton className='mt-2 h-8 w-28' />
      ) : (
        <div className='mt-2 font-mono text-2xl font-semibold tabular-nums'>
          {props.value}
        </div>
      )}
      <div className='mt-1 truncate text-xs text-muted-foreground'>{props.subvalue}</div>
    </div>
  )
}

function RankList(props: {
  title: string
  rows: ChannelStat[]
  loading: boolean
  metric: 'error' | 'latency'
  timeRange: TimeRange
}) {
  const { t } = useTranslation()
  return (
    <Card className='rounded-lg shadow-none'>
      <CardHeader className='border-b pb-3'>
        <CardTitle className='text-sm'>{props.title}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-2 pt-3'>
        {props.loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className='h-9 w-full rounded-md' />
          ))
        ) : props.rows.length === 0 ? (
          <div className='py-4 text-center text-xs text-muted-foreground'>{t('暂无数据')}</div>
        ) : (
          props.rows.slice(0, 5).map((row) => (
            <Link
              key={`${props.title}-${row.channel_id}`}
              to='/dashboard/$section'
              params={{ section: 'channels' }}
              search={{ channel_id: row.channel_id, time_range: props.timeRange }}
              className='focus-visible:ring-ring flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2'
              aria-label={t('打开 {{name}} 的渠道分析', {
                name: formatChannelName(row.channel_name, t),
              })}
            >
              <div className='min-w-0'>
                <div className='truncate text-sm font-medium'>
                  {formatChannelName(row.channel_name, t)}
                </div>
                <div className='text-xs text-muted-foreground'>
                  #{row.channel_id} · {t('{{count}} 次请求', {
                    count: formatCount(row.total_requests),
                  })}
                </div>
              </div>
              {props.metric === 'error' ? (
                <Badge variant={riskTone(row.error_rate)} className='font-mono'>
                  {row.error_rate.toFixed(2)}%
                </Badge>
              ) : (
                <span className='font-mono text-sm tabular-nums'>{formatMs(row.avg_first_token)}</span>
              )}
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function SummaryStrip(props: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  detail: string
  toSection?: DrilldownSection
  search?: DashboardDrilldownSearch
  logsSearch?: UsageLogsSearch
  logsTimeSearch?: { startTime: number; endTime: number }
}) {
  const { t } = useTranslation()
  const Icon = props.icon
  return (
    <div className='flex min-w-0 flex-col gap-3 rounded-lg border bg-background/60 p-3'>
      <div className='flex min-w-0 items-center gap-3'>
        <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-muted'>
          <Icon className='size-4 text-muted-foreground' aria-hidden='true' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='text-xs font-medium text-muted-foreground'>
            {props.label}
          </div>
          <div className='truncate text-sm font-semibold'>{props.value}</div>
          <div className='truncate text-xs text-muted-foreground'>
            {props.detail}
          </div>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        {props.toSection ? (
          <Button
            variant='outline'
            size='sm'
            className='h-7 gap-1.5'
            render={
              <Link
                to='/dashboard/$section'
                params={{ section: props.toSection }}
                search={props.search}
              />
            }
          >
            {t('分析')}
            <ArrowRight data-icon='inline-end' />
          </Button>
        ) : null}
        {props.logsSearch ? (
          <Button
            variant='ghost'
            size='sm'
            className='h-7 gap-1.5'
            render={
              <Link
                to='/usage-logs/$section'
                params={{ section: 'common' }}
                search={{
                  page: 1,
                  ...props.logsTimeSearch,
                  ...props.logsSearch,
                }}
              />
            }
          >
            <FileText data-icon='inline-start' />
            {t('日志')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
